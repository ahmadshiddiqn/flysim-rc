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
    GetPropertyValue(path: string): number;
    SetPropertyValue(path: string, value: number): void;
    delete(): void;
  };
}

/**
 * End-to-end 16-channel verification (plan §C3): writing the extended-channel
 * properties used by FlySimCore.setChannels() must round-trip through the
 * JSBSim property tree. Channel index i maps to fcs/channel-(i+1)-norm.
 */
describe('16-channel property round-trip', () => {
  it('extended channels 4-15 round-trip via fcs/channel-N-norm', async () => {
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

      // Send a value on channel 5 (0-based) → read fcs/channel-6-norm.
      exec.SetPropertyValue('fcs/channel-6-norm', 0.42);
      expect(exec.GetPropertyValue('fcs/channel-6-norm')).toBeCloseTo(0.42);

      // All extended channels 4-15 follow the same mapping.
      for (let i = 4; i < 16; i++) {
        const value = (i - 4) / 12 - 0.5;
        exec.SetPropertyValue(`fcs/channel-${i + 1}-norm`, value);
      }
      for (let i = 4; i < 16; i++) {
        const value = (i - 4) / 12 - 0.5;
        expect(exec.GetPropertyValue(`fcs/channel-${i + 1}-norm`)).toBeCloseTo(value);
      }

      // Values must survive simulation steps.
      for (let i = 0; i < 5; i++) expect(exec.Run()).toBe(true);
      expect(exec.GetPropertyValue('fcs/channel-6-norm')).toBeCloseTo((6 - 5) / 12 - 0.5);
    } finally {
      exec.delete();
    }
  });
});
