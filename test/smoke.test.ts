import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import moduleFactory from '../public/wasm/jsbsim_wasm.mjs';

interface JSBSimModule {
  FS: {
    createPath(parent: string, path: string, canRead: boolean, canWrite: boolean): void;
    writeFile(path: string, data: string): void;
  };
  FGFDMExec: new () => {
    SetRootDir(path: string): void;
    SetAircraftPath(path: string): void;
    SetEnginePath(path: string): void;
    SetSystemsPath(path: string): void;
    LoadModel(model: string, addModelToPath: boolean): boolean;
    RunIC(): boolean;
    Run(): boolean;
    GetSimTime(): number;
    GetPropertyValue(path: string): number;
    delete(): void;
  };
}

describe('JSBSim WASM smoke test', () => {
  it('loads a minimal aircraft model and advances simulation time', async () => {
    const module = await moduleFactory({
      locateFile: (path: string) => resolve('public/wasm', path),
      print: () => undefined,
      printErr: () => undefined,
    }) as JSBSimModule;

    module.FS.createPath('/', 'runtime', true, true);
    module.FS.createPath('/runtime', 'aircraft', true, true);
    module.FS.createPath('/runtime/aircraft', 'ball', true, true);
    module.FS.writeFile('/runtime/aircraft/ball/ball.xml', readFileSync('aircraft/ball/ball.xml', 'utf8'));
    module.FS.writeFile('/runtime/aircraft/ball/reset00.xml', readFileSync('aircraft/ball/reset00.xml', 'utf8'));

    const exec = new module.FGFDMExec();
    try {
      exec.SetRootDir('/runtime');
      exec.SetAircraftPath('aircraft');
      exec.SetEnginePath('engine');
      exec.SetSystemsPath('systems');

      expect(exec.LoadModel('ball', true)).toBe(true);
      expect(exec.RunIC()).toBe(true);

      const initialTime = exec.GetSimTime();
      for (let i = 0; i < 5; i++) {
        expect(exec.Run()).toBe(true);
      }

      expect(exec.GetSimTime()).toBeGreaterThan(initialTime);
      expect(exec.GetPropertyValue('simulation/sim-time-sec')).toBeCloseTo(exec.GetSimTime());
    } finally {
      exec.delete();
    }
  });
});
