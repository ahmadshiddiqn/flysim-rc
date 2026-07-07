import type { PropertyAccess } from './types.js';

const MAX_SPIN_UP_STEPS = 100; // ~1 second at 120 Hz

type EngineEventCallback = {
  onStarted: (data: { rpm: number; attempts: number }) => void;
  onStopped: () => void;
};

export class EngineManager {
  private _running = false;
  private spinUpResolve: (() => void) | null = null;
  private spinUpAttempts = 0;

  constructor(
    private props: PropertyAccess,
    private callbacks: EngineEventCallback,
  ) {}

  get isRunning(): boolean { return this._running; }

  /** True when a spin-up is in progress and the main physics loop should drive it. */
  get isSpinningUp(): boolean { return this.spinUpResolve !== null; }

  /**
   * Start the engine. Returns when the engine is running (or spin-up gives up).
   * Spin-up steps are driven by the main physics loop via onPhysicsStep() to
   * avoid running exec.Run() concurrently with the RAF loop.
   */
  async start(): Promise<void> {
    if (this._running || this.spinUpResolve !== null) return;

    this.props.setProperty('fcs/mixture-cmd-norm', 1.0);
    this.props.setProperty('propulsion/magneto_cmd', 3);
    this.props.setProperty('propulsion/starter_cmd', 1);
    this.spinUpAttempts = 0;

    return new Promise<void>((resolve) => {
      this.spinUpResolve = resolve;
    });
  }

  /**
   * Called by FlySimCore.updatePhysics() on every physics step.
   * Drives spin-up if pending; no-op otherwise.
   */
  onPhysicsStep(): void {
    if (!this.spinUpResolve) return;

    this.spinUpAttempts++;
    const rpm = this.props.getProperty('propulsion/engine[0]/rpm');

    if (rpm > 440 || this.spinUpAttempts >= MAX_SPIN_UP_STEPS) {
      this.props.setProperty('propulsion/starter_cmd', 0);
      this._running = true;
      const resolve = this.spinUpResolve;
      this.spinUpResolve = null;
      this.callbacks.onStarted({ rpm, attempts: this.spinUpAttempts });
      resolve();
    }
  }

  stop(): void {
    this.props.setProperty('propulsion/magneto_cmd', 0);
    this.props.setProperty('propulsion/starter_cmd', 0);
    this._running = false;
    if (this.spinUpResolve) {
      const resolve = this.spinUpResolve;
      this.spinUpResolve = null;
      resolve();
    }
    this.callbacks.onStopped();
  }

  releaseBrakes(): void {
    this.props.setProperty('fcs/left-brake-cmd-norm', 0);
    this.props.setProperty('fcs/right-brake-cmd-norm', 0);
    this.props.setProperty('fcs/center-brake-cmd-norm', 0);
  }

  /** Auto-start if not running and throttle is applied. */
  ensureRunning(): void {
    if (!this._running && !this.spinUpResolve) {
      this.releaseBrakes();
      this.start();
    }
  }

  destroy(): void {
    if (this.spinUpResolve) {
      const resolve = this.spinUpResolve;
      this.spinUpResolve = null;
      resolve();
    }
  }
}
