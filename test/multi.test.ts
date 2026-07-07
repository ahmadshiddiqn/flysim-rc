import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FlySimEngine } from '../src/index.js';

const OPTS = {
  moduleUrl: 'file://' + resolve('public/wasm/jsbsim_wasm.mjs').replace(/\\/g, '/'),
  wasmUrl: resolve('public/wasm/jsbsim_wasm.wasm'),
};

function writeBall(engine: FlySimEngine): void {
  engine.sharedVfs.writeRuntimeFile('aircraft/ball/ball.xml', readFileSync('aircraft/ball/ball.xml', 'utf8'));
  engine.sharedVfs.writeRuntimeFile('aircraft/ball/reset00.xml', readFileSync('aircraft/ball/reset00.xml', 'utf8'));
}

describe('FlySimEngine multi-instance', () => {
  it('two cores share one module and simulate independently', async () => {
    const engine = await FlySimEngine.load(OPTS);
    writeBall(engine);

    const a = engine.createCore();
    const b = engine.createCore();
    try {
      expect(a.loadModel('ball')).toBe(true);
      expect(b.loadModel('ball')).toBe(true);
      a.runIC();
      b.runIC();

      // Advance only core A — B's clock must not move (independent execs).
      for (let i = 0; i < 60; i++) a.stepOnce();
      expect(a.getSimTime()).toBeGreaterThan(0.4);
      expect(b.getSimTime()).toBe(0);
    } finally {
      a.destroy();
      b.destroy();
    }
  });

  it('re-loading a model on the same core recreates the exec (no vtable trap)', async () => {
    const engine = await FlySimEngine.load(OPTS);
    writeBall(engine);

    const core = engine.createCore();
    try {
      expect(core.loadModel('ball')).toBe(true);
      core.runIC();
      for (let i = 0; i < 30; i++) core.stepOnce();

      // Second load used to corrupt the WASM vtable ("table index is out of
      // bounds" on the next virtual call). Must be safe now.
      expect(core.loadModel('ball')).toBe(true);
      core.runIC();
      expect(core.getSimTime()).toBe(0);      // fresh exec, fresh clock
      for (let i = 0; i < 30; i++) core.stepOnce();
      expect(core.getSimTime()).toBeGreaterThan(0.2);
    } finally {
      core.destroy();                          // destructor must not trap
    }
  });
});
