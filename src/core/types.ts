/**
 * FlySim-RC Core Type Definitions
 */

export interface AircraftControls {
  aileron?: number;    // -1.0 to 1.0
  elevator?: number;   // -1.0 to 1.0
  rudder?: number;     // -1.0 to 1.0
  throttle?: number;   // 0.0 to 1.0
  /** Full 16-channel array (ch[0]=ail, ch[1]=elev, ch[2]=thr, ch[3]=rud, ch[4..15]=extended).
   *  When present, indices 0–3 take precedence over the named fields above. */
  channels?: number[];
}

export interface AircraftState {
  latitude: number;
  longitude: number;
  altitude: number;        // feet
  roll: number;            // radians
  pitch: number;           // radians
  heading: number;         // radians
  airspeed: number;        // knots
  groundspeed: number;     // knots
  verticalSpeed: number;   // ft/s
  aileron: number;
  elevator: number;
  rudder: number;
  throttle: number;
  leftBrake: number;
  rightBrake: number;
  centerBrake: number;
  steering: number;
  simTime: number;
  systemTimeMs: number;   // wall-clock ms (performance.now()), for SITL time sync
}

export interface FlySimOptions {
  moduleUrl: string;
  wasmUrl: string;
  persistence?: {
    enabled: boolean;
  };
  log?: {
    console?: boolean;
    stripAnsi?: boolean;
  };
  runtimeRoot?: string;
}

export interface LoadAircraftOptions {
  aircraftPath?: string;
  enginePath?: string;
  systemsPath?: string;
  addModelToPath?: boolean;
}

export interface FlySimEventMap {
  'update':          AircraftState;
  'error':           Error;
  'stdout':          string;
  'stderr':          string;
  'engine-started':  { rpm: number; attempts: number };
  'engine-stopped':  Record<string, never>;
  'aircraft-loaded': { model: string };
}

export type FlySimEvent = keyof FlySimEventMap;

export interface VfsManager {
  writeRuntimeFile(path: string, data: string | Uint8Array): string;
  readRuntimeFile(path: string, encoding?: 'utf8' | 'binary'): string | Uint8Array;
  mkdir(path: string): string;
  exists(path: string): boolean;
  enablePersistence(): Promise<void>;
  syncToPersistence(): Promise<void>;
  syncFromPersistence(): Promise<void>;
}

export interface JSBSimLogEntry {
  stream: 'stdout' | 'stderr';
  message: string;
  timestamp: number;
}

export interface ScenarioConfig {
  name: string;
  aircraft: string;
  initialization?: string;
  controls?: Partial<AircraftControls>;
  telemetry?: string[];
}

export interface BinaryLike {
  [Symbol.toStringTag]: 'Uint8Array' | 'ArrayBuffer' | 'string';
}

export interface PropertyAccess {
  getProperty(path: string): number;
  setProperty(path: string, value: number): void;
}

export interface PhysicsStep {
  runSingle(): boolean;
}
