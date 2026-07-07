import type { VfsManager } from './types.js';

export type FileCategory = 'aircraft' | 'engine' | 'system';

export interface AircraftFileResolver {
  resolveDefaultFiles(aircraftName: string): string[];
  classifyFile(aircraftName: string, file: string): FileCategory;
  resolveFetchUrl(aircraftName: string, file: string, baseUrl: string): string;
  resolveVfsPath(aircraftName: string, file: string): string;
}

export interface LoadResult {
  loaded: string[];
  failed: Array<{ file: string; reason: string }>;
}

export class DefaultFileResolver implements AircraftFileResolver {
  resolveDefaultFiles(aircraftName: string): string[] {
    return [
      `${aircraftName}/${aircraftName}.xml`,
      `${aircraftName}/reset00.xml`,
      `${aircraftName}/reset01.xml`,
    ];
  }

  classifyFile(aircraftName: string, file: string): FileCategory {
    // Aircraft-relative paths (p51d/Engines/…) always belong to the aircraft tree.
    if (file.startsWith(`${aircraftName}/`)) return 'aircraft';
    // Explicit prefixes are authoritative — heuristics can't cover names
    // like F100-PW-229.xml or wright1903_propellers.xml.
    if (file.startsWith('engine/')) return 'engine';
    if (file.startsWith('systems/')) return 'system';
    if (file.includes('eng_') || file.includes('prop_')) return 'engine';
    if (file.includes('GNC') || file.includes('Autopilot')) return 'system';
    return 'aircraft';
  }

  resolveFetchUrl(aircraftName: string, file: string, baseUrl: string): string {
    const category = this.classifyFile(aircraftName, file);
    const isAircraftFile = file.startsWith(`${aircraftName}/`);
    if (category === 'engine' && !isAircraftFile) return `/engine/${file.replace(/^engine\//, '')}`;
    if (category === 'system' && !isAircraftFile) return `/systems/${file.replace(/^systems\//, '')}`;
    return `${baseUrl}/${file}`;
  }

  resolveVfsPath(aircraftName: string, file: string): string {
    const category = this.classifyFile(aircraftName, file);
    if (category === 'engine') return `engine/${file.replace(/^engine\//, '')}`;
    if (category === 'system') return `systems/${file.replace(/^systems\//, '')}`;
    return `aircraft/${file}`;
  }
}

export class AircraftLoader {
  private loadedFiles = new Set<string>();

  constructor(
    private vfs: VfsManager,
    private resolver: AircraftFileResolver = new DefaultFileResolver(),
  ) {}

  async loadFromUrl(
    aircraftName: string,
    baseUrl: string,
    files?: string[],
    options?: { strict?: boolean },
  ): Promise<LoadResult> {
    const filesToLoad = files ?? this.resolver.resolveDefaultFiles(aircraftName);
    const loaded: string[] = [];
    const failed: Array<{ file: string; reason: string }> = [];

    for (const file of filesToLoad) {
      const cacheKey = `${baseUrl}/${file}`;
      if (this.loadedFiles.has(cacheKey)) {
        loaded.push(file);
        continue;
      }

      const fetchUrl = this.resolver.resolveFetchUrl(aircraftName, file, baseUrl);

      try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          const reason = `HTTP ${response.status}`;
          if (options?.strict) {
            throw new Error(`Failed to fetch ${file}: ${reason}`);
          }
          failed.push({ file, reason });
          console.warn(`Aircraft file not found: ${file} (${reason})`);
          continue;
        }

        const content = await response.text();
        const vfsPath = this.resolver.resolveVfsPath(aircraftName, file);
        this.vfs.writeRuntimeFile(vfsPath, content);
        this.loadedFiles.add(cacheKey);
        loaded.push(file);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (options?.strict) throw error;
        failed.push({ file, reason });
        console.warn(`Failed to load ${file}:`, error);
      }
    }

    return { loaded, failed };
  }

  /** Transfer the loaded-file cache to a pre-existing Set (used by FlySimCore). */
  copyLoadedFilesTo(target: Set<string>): void {
    for (const key of this.loadedFiles) target.add(key);
  }
}
