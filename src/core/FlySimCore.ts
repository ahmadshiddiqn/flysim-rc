/**
 * FlySim-RC Core - TypeScript SDK for JSBSim WASM
 * Modern architecture with auto-generated bindings
 */

import type {
  AircraftControls,
  AircraftState,
  FlySimOptions,
  FlySimEventMap,
  FlySimEvent,
  LoadAircraftOptions,
} from './types.js';
import { WasmVfsManager } from './vfs.js';
import { EngineManager } from './EngineManager.js';
import { AircraftLoader } from './AircraftLoader.js';
import { JSBSimLoadError, JSBSimPropertyError } from './errors.js';

interface EmscriptenModule {
  FGFDMExec: new () => FGFDMExec;
  FS: any;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}

interface FGFDMExec {
  LoadModel(model: string, addModelToPath?: boolean): boolean;
  LoadModel(
    aircraftPath: string,
    enginePath: string,
    systemsPath: string,
    model: string,
    addModelToPath?: boolean
  ): boolean;
  LoadScript(path: string, deltaT?: number, initFile?: string): boolean;
  Run(): boolean;
  RunIC(): boolean;
  SetRootDir(path: string): void;
  SetAircraftPath(path: string): void;
  SetEnginePath(path: string): void;
  SetSystemsPath(path: string): void;
  SetOutputPath(path: string): void;
  GetPropertyValue(path: string): number;
  SetPropertyValue(path: string, value: number): void;
  QueryPropertyCatalog(check: string): string;
  GetSimTime(): number;
  /** Embind destructor — frees the WASM-heap FGFDMExec. */
  delete(): void;
}

export class FlySimCore {
  private exec: FGFDMExec | null = null;
  private module: EmscriptenModule | null = null;
  private vfs: WasmVfsManager | null = null;
  private isRunning = false;
  private modelLoaded = false;
  private pathConfig: {
    rootDir: string; aircraftPath: string; enginePath: string; systemsPath: string;
  } = { rootDir: '/runtime', aircraftPath: 'aircraft', enginePath: 'engine', systemsPath: 'systems' };
  private engine!: EngineManager;
  private physicsRate = 120; // Hz
  private physicsDt = 1000 / this.physicsRate; // ms
  private accumulator = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private _physicsStepsLastFrame = 0;
  private aircraftLoader!: AircraftLoader;
  private logListeners: Map<FlySimEvent, Set<(data: any) => void>> = new Map();

  private constructor(exec: FGFDMExec, vfs: WasmVfsManager, module: EmscriptenModule) {
    this.exec = exec;
    this.vfs = vfs;
    this.module = module;

    this.logListeners.set('update', new Set());
    this.logListeners.set('error', new Set());
    this.logListeners.set('stdout', new Set());
    this.logListeners.set('stderr', new Set());
    this.logListeners.set('engine-started', new Set());
    this.logListeners.set('engine-stopped', new Set());
    this.logListeners.set('aircraft-loaded', new Set());

    this.aircraftLoader = new AircraftLoader(vfs);

    this.engine = new EngineManager(
      {
        getProperty: (p) => this.getProperty(p),
        setProperty: (p, v) => this.setProperty(p, v),
      },
      {
        onStarted: (data) => this.emit('engine-started', data),
        onStopped: () => this.emit('engine-stopped', {}),
      },
    );
  }

  /**
   * Creates a new FlySimCore instance with initialized WASM module
   */
  static async create(options: FlySimOptions): Promise<FlySimCore> {
    const engine = await FlySimEngine.load(options);
    return engine.createCore();
  }

  /** @internal Used by FlySimEngine to mint instances on a shared module. */
  static _fromModule(module: EmscriptenModule, vfs: WasmVfsManager): FlySimCore {
    const exec = new module.FGFDMExec();
    const core = new FlySimCore(exec, vfs, module);
    core.configurePaths();
    return core;
  }

  /**
   * Configure JSBSim search paths
   */
  configurePaths(options?: {
    rootDir?: string;
    aircraftPath?: string;
    enginePath?: string;
    systemsPath?: string;
  }): void {
    if (!this.exec) return;
    
    this.pathConfig = {
      rootDir:      options?.rootDir      || this.pathConfig.rootDir,
      aircraftPath: options?.aircraftPath || this.pathConfig.aircraftPath,
      enginePath:   options?.enginePath   || this.pathConfig.enginePath,
      systemsPath:  options?.systemsPath  || this.pathConfig.systemsPath,
    };
    this.exec.SetRootDir(this.pathConfig.rootDir);
    this.exec.SetAircraftPath(this.pathConfig.aircraftPath);
    this.exec.SetEnginePath(this.pathConfig.enginePath);
    this.exec.SetSystemsPath(this.pathConfig.systemsPath);
  }

  /**
   * Replace the FGFDMExec with a fresh one. JSBSim's model re-load path is
   * broken under WASM — a second LoadModel on the same exec corrupts the
   * vtable (later virtual calls trap with "table index is out of bounds"),
   * so aircraft switching must recreate the exec.
   */
  private recreateExec(): void {
    if (!this.module) throw new Error('Not initialized');
    this.stop();
    this.engine.resetState();
    this.exec?.delete();
    this.exec = new this.module.FGFDMExec();
    this.configurePaths(this.pathConfig);
    this.modelLoaded = false;
  }

  /**
   * Load aircraft files from URL into the VFS, then load the model.
   * Returns true when LoadModel succeeds. Use AircraftLoader directly for richer results.
   */
  async loadAircraftFromUrl(
    aircraftName: string,
    baseUrl: string,
    files?: string[],
  ): Promise<boolean> {
    await this.aircraftLoader.loadFromUrl(aircraftName, baseUrl, files);
    return this.loadModel(aircraftName);
  }

  /**
   * Load aircraft model directly via FGFDMExec::LoadModel.
   * Lower-level path — prefer loadAircraftScript() when a script is available,
   * as LoadModel can surface embind error codes that are awkward to interpret.
   * Throws JSBSimLoadError on failure.
   */
  loadModel(model: string, options?: LoadAircraftOptions): boolean {
    if (!this.exec) {
      throw new Error('Not initialized');
    }

    const addModelToPath = options?.addModelToPath ?? true;

    // Switching aircraft requires a fresh exec (see recreateExec).
    if (this.modelLoaded) this.recreateExec();

    try {
      const loaded = this.exec!.LoadModel(model, addModelToPath);
      // Defensive: embind should return a boolean; a non-boolean (e.g. a leaked
      // numeric pointer) is treated as a failure rather than falsey "success".
      const ok = typeof loaded === 'boolean' ? loaded : false;
      if (!ok) {
        throw new JSBSimLoadError(`LoadModel failed for "${model}"`, { model, detail: loaded });
      }
      this.modelLoaded = true;
      this.emit('aircraft-loaded', { model });
      return true;
    } catch (error) {
      if (error instanceof JSBSimLoadError) throw error;
      throw new JSBSimLoadError(`LoadModel failed for "${model}": ${error}`, { model, detail: error });
    }
  }

  /**
   * Primary aircraft-loading path: load a JSBSim script then run initial
   * conditions. This mirrors the proven script-based approach and avoids the
   * LoadModel error-code edge cases (see docs/history/IMPLEMENTATION_COMPARISON.md).
   * Throws JSBSimLoadError on failure.
   */
  loadAircraftScript(scriptPath: string, deltaT = 0, initFile = ''): boolean {
    if (!this.exec) {
      throw new Error('Not initialized');
    }
    if (this.modelLoaded) this.recreateExec();
    try {
      const ok = this.exec!.LoadScript(scriptPath, deltaT, initFile);
      if (!ok) {
        throw new JSBSimLoadError(`LoadScript failed for "${scriptPath}"`, { model: scriptPath });
      }
      this.exec!.RunIC();
      this.modelLoaded = true;
      this.emit('aircraft-loaded', { model: scriptPath });
      return true;
    } catch (error) {
      if (error instanceof JSBSimLoadError) throw error;
      throw new JSBSimLoadError(`loadAircraftScript failed for "${scriptPath}": ${error}`, { model: scriptPath, detail: error });
    }
  }

  /**
   * Load initialization script
   */
  loadScript(path: string, deltaT = 0, initFile = ''): boolean {
    if (!this.exec) {
      throw new Error('Not initialized');
    }
    return this.exec.LoadScript(path, deltaT, initFile);
  }

  /**
   * Run initialization conditions
   */
  runIC(): boolean {
    if (!this.exec) {
      throw new Error('Not initialized');
    }
    return this.exec.RunIC();
  }

  /**
   * Start simulation loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    
    console.log('Simulation started');
    this.loop();
  }

  /**
   * Stop simulation loop and cancel any pending animation frame immediately.
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('Simulation stopped');
  }

  /**
   * Main simulation loop
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame(this.loop);

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Prevent spiral of death
    const clampedFrameTime = Math.min(frameTime, 250);
    this.accumulator += clampedFrameTime;

    // Run physics at fixed timestep
    let steps = 0;
    while (this.accumulator >= this.physicsDt) {
      this.updatePhysics();
      this.accumulator -= this.physicsDt;
      steps++;
    }
    this._physicsStepsLastFrame = steps;

    const s = this.getState();
    if (s) this.emit('update', s);
  };

  /**
   * Update physics - runs at fixed rate
   */
  private updatePhysics(): void {
    if (!this.exec) return;

    try {
      const result = this.exec.Run();
      if (!result) {
        this.emit('error', new Error('Simulation step failed'));
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }

    this.engine.onPhysicsStep();
  }

  /**
   * Write a file into the JSBSim runtime VFS (path relative to the runtime
   * root, e.g. "aircraft/myplane/myplane.xml" or "engine/mymotor.xml").
   * Enables user-supplied aircraft uploads without going through fetch.
   */
  writeRuntimeFile(path: string, data: string | Uint8Array): void {
    if (!this.vfs) throw new Error('Not initialized');
    this.vfs.writeRuntimeFile(path, data);
  }

  /**
   * Advance the simulation by exactly one physics step. For headless use
   * (Node, workers, multiplayer servers) where the RAF-driven start() loop
   * is unavailable; also drives engine spin-up.
   */
  stepOnce(): boolean {
    if (!this.exec) throw new Error('Not initialized');
    const ok = this.exec.Run();
    this.engine.onPhysicsStep();
    return ok;
  }

  /**
   * Get property value
   */
  getProperty(path: string): number {
    if (!this.exec) return 0;
    return this.exec.GetPropertyValue(path);
  }

  /**
   * Set property value
   */
  setProperty(path: string, value: number): void {
    if (!this.exec) return;
    this.exec.SetPropertyValue(path, value);
  }

  /**
   * Query the JSBSim property catalog for names matching a prefix/substring.
   * Returns a newline-delimited string of matching property names.
   */
  queryPropertyCatalog(prefix: string): string {
    if (!this.exec) throw new Error('Not initialized');
    return this.exec.QueryPropertyCatalog(prefix);
  }

  /**
   * Returns true when a property node exists in the loaded model's catalog.
   * (FGFDMExec exposes only double-valued Get/SetPropertyValue; string-valued
   * property access would require binding the SGPropertyNode tree, which is
   * out of scope for this phase.)
   */
  hasProperty(path: string): boolean {
    if (!this.exec) return false;
    const catalog = this.exec.QueryPropertyCatalog(path);
    return catalog.split('\n').map(l => l.trim()).includes(path);
  }

  /**
   * Returns the property value, or null when the property node is missing.
   * Use this to distinguish "missing" from "zero" (getProperty returns 0 for both).
   */
  getPropertyOrNull(path: string): number | null {
    if (!this.exec) return null;
    if (!this.hasProperty(path)) return null;
    return this.exec.GetPropertyValue(path);
  }

  /**
   * Returns the property value, throwing JSBSimPropertyError when the node is
   * missing. Strict variant of getProperty.
   */
  getPropertyStrict(path: string): number {
    if (!this.exec) throw new Error('Not initialized');
    if (!this.hasProperty(path)) throw new JSBSimPropertyError(path);
    return this.exec.GetPropertyValue(path);
  }

  /**
   * Get simulation time
   */
  getSimTime(): number {
    if (!this.exec) return 0;
    return this.exec.GetSimTime();
  }

  /**
   * Get aircraft state
   */
  getState(): AircraftState | null {
    if (!this.exec) return null;

    return {
      latitude: this.getProperty('position/lat-gc-deg'),
      longitude: this.getProperty('position/long-gc-deg'),
      altitude: this.getProperty('position/h-agl-ft'),
      roll: this.getProperty('attitude/roll-rad'),
      pitch: this.getProperty('attitude/pitch-rad'),
      heading: this.getProperty('attitude/heading-true-rad'),
      airspeed: this.getProperty('velocities/vc-fps'),
      groundspeed: this.getProperty('velocities/vg-fps'),
      verticalSpeed: this.getProperty('velocities/h-dot-fps'),
      aileron: this.getProperty('fcs/aileron-cmd-norm'),
      elevator: this.getProperty('fcs/elevator-cmd-norm'),
      rudder: this.getProperty('fcs/rudder-cmd-norm'),
      throttle: this.getProperty('fcs/throttle-cmd-norm'),
      leftBrake: this.getProperty('fcs/left-brake-cmd-norm'),
      rightBrake: this.getProperty('fcs/right-brake-cmd-norm'),
      centerBrake: this.getProperty('fcs/center-brake-cmd-norm'),
      steering: this.getProperty('fcs/steer-cmd-norm'),
      simTime: this.getSimTime(),
      systemTimeMs: performance.now()
    };
  }

  /**
   * Set control inputs (named-field API — backwards compatible).
   * If controls.channels is present, indices 0–3 override the named fields.
   */
  setControls(controls: AircraftControls): void {
    if (!this.exec) return;

    // Resolve the four primary channels from either the channels array or named fields.
    const ch = controls.channels;
    const aileron  = ch ? ch[0] : controls.aileron;
    const elevator = ch ? ch[1] : controls.elevator;
    const throttle = ch ? ch[2] : controls.throttle;
    const rudder   = ch ? ch[3] : controls.rudder;

    if (throttle !== undefined && throttle > 0.1) {
      this.engine.ensureRunning();
    }

    if (aileron  !== undefined) this.setProperty('fcs/aileron-cmd-norm',  aileron);
    if (elevator !== undefined) this.setProperty('fcs/elevator-cmd-norm', elevator);
    if (rudder   !== undefined) this.setProperty('fcs/rudder-cmd-norm',   rudder);
    if (throttle !== undefined) this.setProperty('fcs/throttle-cmd-norm', throttle);

    // Extended channels 4–15: write to generic fcs/channel-N-norm properties.
    // Aircraft XML can bind these via property rules; unbound writes are no-ops.
    if (ch) {
      for (let i = 4; i < Math.min(ch.length, 16); i++) {
        this.setProperty(`fcs/channel-${i + 1}-norm`, ch[i]);
      }
    }
  }

  /**
   * Set all 16 channels at once. ch[0]=ail, ch[1]=elev, ch[2]=thr, ch[3]=rud, ch[4..15]=extended.
   * Convenience wrapper used by the IAL.
   */
  setChannels(ch: number[] | Float32Array): void {
    this.setControls({ channels: Array.from(ch) });
  }

  releaseBrakes(): void {
    this.engine.releaseBrakes();
  }

  async startEngine(): Promise<void> {
    return this.engine.start();
  }

  stopEngine(): void {
    this.engine.stop();
  }

  on<E extends FlySimEvent>(event: E, listener: (data: FlySimEventMap[E]) => void): this {
    this.logListeners.get(event)?.add(listener as (data: any) => void);
    return this;
  }

  off<E extends FlySimEvent>(event: E, listener: (data: FlySimEventMap[E]) => void): this {
    this.logListeners.get(event)?.delete(listener as (data: any) => void);
    return this;
  }

  private emit<E extends FlySimEvent>(event: E, data: FlySimEventMap[E]): void {
    this.logListeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Event listener error for ${event}:`, error);
      }
    });
  }

  /**
   * Write file to runtime filesystem
   */
  writeDataFile(path: string, data: string | Uint8Array): string {
    if (!this.vfs) {
      throw new Error('VFS not initialized');
    }
    return this.vfs.writeRuntimeFile(path, data);
  }

  /**
   * Read file from runtime filesystem
   */
  readDataFile(path: string): string | Uint8Array {
    if (!this.vfs) {
      throw new Error('VFS not initialized');
    }
    return this.vfs.readRuntimeFile(path);
  }

  /**
   * Sync to persistent storage
   */
  async syncToPersistence(): Promise<void> {
    if (!this.vfs) {
      throw new Error('VFS not initialized');
    }
    await this.vfs.syncToPersistence();
  }

  /**
   * Number of physics steps executed in the last render frame.
   * Typically 2 at 60 FPS / 120 Hz physics.
   */
  get physicsStepsLastFrame(): number {
    return this._physicsStepsLastFrame;
  }

  /**
   * Cleanup resources. Frees the embind FGFDMExec on the WASM heap (prevents
   * a heap leak on every create/destroy cycle).
   */
  destroy(): void {
    this.stop();
    this.engine.destroy();
    this.logListeners.forEach(listeners => listeners.clear());
    this.exec?.delete();
    this.exec = null;
    this.vfs = null;
  }

  /** Explicit Resource Management: `using core = await FlySimCore.create(...)` */
  [Symbol.dispose](): void {
    this.destroy();
  }

  /** Explicit Resource Management: `await using core = await FlySimCore.create(...)` */
  [Symbol.asyncDispose](): Promise<void> {
    this.destroy();
    return Promise.resolve();
  }
}

/**
 * Loads the JSBSim WASM module once and mints FlySimCore instances that share
 * it (module + VFS). Each instance owns its own FGFDMExec, so multiple
 * aircraft can be simulated simultaneously — the basis for multiplayer.
 *
 * ```ts
 * const engine = await FlySimEngine.load({ moduleUrl, wasmUrl });
 * const ownship = engine.createCore();
 * const traffic = engine.createCore();  // shares WASM + aircraft files
 * ```
 */
export class FlySimEngine {
  private constructor(
    private module: EmscriptenModule,
    private vfs: WasmVfsManager,
  ) {}

  static async load(options: FlySimOptions): Promise<FlySimEngine> {
    const moduleFactory = await import(/* @vite-ignore */ options.moduleUrl);
    const module = await moduleFactory.default({
      locateFile: (path: string) => path.endsWith('.wasm') ? options.wasmUrl : path,
      print:    (text: string) => { console.log('[JSBSim]', text); },
      printErr: (text: string) => { console.error('[JSBSim]', text); },
    }) as EmscriptenModule;

    const vfs = new WasmVfsManager(module, options.runtimeRoot || '/runtime');
    if (options.persistence?.enabled) {
      await vfs.enablePersistence();
    }
    return new FlySimEngine(module, vfs);
  }

  /** Create a new independent simulation instance on the shared module. */
  createCore(): FlySimCore {
    return FlySimCore._fromModule(this.module, this.vfs);
  }

  /** Shared VFS — aircraft files written here are visible to every core. */
  get sharedVfs(): WasmVfsManager {
    return this.vfs;
  }
}

export default FlySimCore;
