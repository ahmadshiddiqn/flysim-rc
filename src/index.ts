// Main entry point for FlySim-RC SDK

export { FlySimCore } from './core/FlySimCore.js';
export { WasmVfsManager } from './core/vfs.js';
export { EngineManager } from './core/EngineManager.js';
export { AircraftLoader, DefaultFileResolver } from './core/AircraftLoader.js';
export { JSBSimLoadError, JSBSimPropertyError } from './core/errors.js';
export type { AircraftFileResolver, LoadResult, FileCategory } from './core/AircraftLoader.js';
export type {
  AircraftControls,
  AircraftState,
  FlySimOptions,
  LoadAircraftOptions,
  FlySimEvent,
  FlySimEventMap,
  PropertyAccess,
  JSBSimLogEntry,
  VfsManager
} from './core/types.js';
