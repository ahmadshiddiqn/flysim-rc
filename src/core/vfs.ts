/**
 * Virtual File System Manager for JSBSim WASM (embind build)
 * Handles MEMFS (in-memory) and IDBFS (IndexedDB persistence)
 * Uses the Emscripten FS API exposed via -sEXPORTED_RUNTIME_METHODS=['FS'].
 */

import type { VfsManager } from './types.js';

interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array, options?: { encoding?: string }): void;
  readFile(path: string, options?: { encoding?: string }): string | Uint8Array;
  mkdir(path: string, mode?: number): void;
  analyzePath(path: string, dontResolveLastLink?: boolean): { exists: boolean; object: any };
  createPath(parent: string, path: string, canRead?: boolean, canWrite?: boolean): void;
  readdir(path: string): string[];
  unlink(path: string): void;
  rmdir(path: string): void;
  filesystems: {
    IDBFS: object;
  };
  mount(type: object, opts: object, mountpoint: string): void;
  syncfs(populate: boolean, callback: (err?: Error) => void): void;
}

interface EmscriptenModule {
  FS: EmscriptenFS;
}

const DEFAULT_RUNTIME_ROOT = '/runtime';
const DEFAULT_IDB_ROOT = '/persist';

export class WasmVfsManager implements VfsManager {
  private fs: EmscriptenFS;
  readonly runtimeRoot: string;
  readonly idbMountPath: string;
  private persistenceEnabled = false;

  constructor(module: EmscriptenModule, runtimeRoot?: string, idbMountPath?: string) {
    if (!module.FS) {
      throw new Error('FS not available in Emscripten module. Ensure -sFORCE_FILESYSTEM=1 is set.');
    }
    this.fs = module.FS;
    this.runtimeRoot = runtimeRoot ?? DEFAULT_RUNTIME_ROOT;
    this.idbMountPath = idbMountPath ?? DEFAULT_IDB_ROOT;
    
    // Ensure runtime root exists
    this.ensureDir(this.runtimeRoot);
  }

  /**
   * Resolves a path relative to runtime root
   */
  private resolveRuntimePath(path: string): string {
    return path.startsWith('/') ? path : `${this.runtimeRoot}/${path}`;
  }

  /**
   * Check if a path exists (embind FS API)
   */
  private pathExists(path: string): boolean {
    return this.fs.analyzePath(path, false).exists;
  }

  /**
   * Ensures directory exists (creates recursively via createPath)
   */
  private ensureDir(path: string): void {
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      const parent = current || '/';
      current += `/${part}`;
      if (!this.pathExists(current)) {
        this.fs.createPath(parent, part, true, true);
      }
    }
  }

  /**
   * Writes data to runtime filesystem
   */
  writeRuntimeFile(path: string, data: string | Uint8Array): string {
    const fullPath = this.resolveRuntimePath(path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    
    if (dir && dir !== '/') {
      this.ensureDir(dir);
    }
    
    this.fs.writeFile(fullPath, data);
    return fullPath;
  }

  /**
   * Reads data from runtime filesystem
   */
  readRuntimeFile(path: string, encoding: 'utf8' | 'binary' = 'utf8'): string | Uint8Array {
    const fullPath = this.resolveRuntimePath(path);
    const options = encoding === 'utf8' ? { encoding: 'utf8' } : undefined;
    return this.fs.readFile(fullPath, options);
  }

  /**
   * Creates a directory
   */
  mkdir(path: string): string {
    const fullPath = this.resolveRuntimePath(path);
    this.ensureDir(fullPath);
    return fullPath;
  }

  /**
   * Checks if a file or directory exists
   */
  exists(path: string): boolean {
    const fullPath = this.resolveRuntimePath(path);
    return this.pathExists(fullPath);
  }

  /**
   * Checks if IDBFS is available in this environment
   */
  private hasIdbfsSupport(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Syncs filesystem (promisified wrapper around Emscripten's syncfs)
   */
  private syncFs(populate: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fs.syncfs(populate, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Enables persistence by mounting IDBFS
   */
  async enablePersistence(): Promise<void> {
    if (!this.hasIdbfsSupport()) {
      throw new Error('IDBFS is unavailable in this environment');
    }
    
    if (this.persistenceEnabled) {
      return;
    }

    // Mount IDBFS
    this.fs.mount(this.fs.filesystems.IDBFS, {}, this.idbMountPath);
    
    // Sync from persistent storage
    await this.syncFromPersistence();
    
    this.persistenceEnabled = true;
  }

  /**
   * Syncs data from persistent storage (IDBFS) to runtime
   */
  async syncFromPersistence(): Promise<void> {
    await this.syncFs(true);
  }

  /**
   * Syncs data from runtime to persistent storage (IDBFS)
   */
  async syncToPersistence(): Promise<void> {
    if (!this.persistenceEnabled) {
      throw new Error('Persistence is not enabled');
    }
    await this.syncFs(false);
  }
}
