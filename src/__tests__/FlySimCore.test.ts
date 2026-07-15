import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlySimCore } from '../core/FlySimCore.js';
import { JSBSimLoadError, JSBSimPropertyError } from '../core/errors.js';

type MockExec = ReturnType<typeof createMockExec>;

const CoreCtor = FlySimCore as unknown as {
  new (exec: MockExec, vfs: MockVfs): FlySimCore;
};

class MockVfs {
  writeRuntimeFile = vi.fn((path: string) => `/runtime/${path}`);
  readRuntimeFile = vi.fn((path: string) => `read:${path}`);
  syncToPersistence = vi.fn(async () => undefined);
}

function createMockExec() {
  const properties = new Map<string, number>([
    ['fcs/aileron-cmd-norm', 0],
    ['fcs/elevator-cmd-norm', 0],
    ['fcs/throttle-cmd-norm', 0],
    ['simulation/sim-time-sec', 0],
  ]);

  return {
    properties,
    LoadModel: vi.fn(() => true),
    LoadScript: vi.fn(() => true),
    Run: vi.fn(() => true),
    RunIC: vi.fn(() => true),
    SetRootDir: vi.fn(),
    SetAircraftPath: vi.fn(),
    SetEnginePath: vi.fn(),
    SetSystemsPath: vi.fn(),
    SetOutputPath: vi.fn(),
    GetPropertyValue: vi.fn((path: string) => properties.get(path) ?? 0),
    SetPropertyValue: vi.fn((path: string, value: number) => {
      properties.set(path, value);
    }),
    QueryPropertyCatalog: vi.fn((check: string) => {
      return [...properties.keys()]
        .filter(path => path.includes(check))
        .join('\n');
    }),
    GetSimTime: vi.fn(() => properties.get('simulation/sim-time-sec') ?? 0),
    delete: vi.fn(),
  };
}

function createCore(exec = createMockExec()) {
  return {
    exec,
    vfs: new MockVfs(),
    core: new CoreCtor(exec, new MockVfs()),
  };
}

describe('FlySimCore', () => {
  beforeEach(() => {
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frees the embind exec during destroy', () => {
    const { core, exec } = createCore();

    core.destroy();

    expect(exec.delete).toHaveBeenCalledOnce();
  });

  it('loads scripts through LoadScript and RunIC', () => {
    const { core, exec } = createCore();
    const listener = vi.fn();
    core.on('aircraft-loaded', listener);

    expect(core.loadAircraftScript('scripts/takeoff.xml', 0.008, 'reset00')).toBe(true);

    expect(exec.LoadScript).toHaveBeenCalledWith('scripts/takeoff.xml', 0.008, 'reset00');
    expect(exec.RunIC).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ model: 'scripts/takeoff.xml' });
  });

  it('throws typed load errors when LoadModel fails', () => {
    const exec = createMockExec();
    exec.LoadModel.mockReturnValue(false);
    const { core } = createCore(exec);

    expect(() => core.loadModel('missing')).toThrow(JSBSimLoadError);
  });

  it('distinguishes missing properties from zero-valued properties', () => {
    const { core, exec } = createCore();
    exec.properties.set('fcs/zero-value', 0);

    expect(core.hasProperty('fcs/zero-value')).toBe(true);
    expect(core.getPropertyOrNull('fcs/zero-value')).toBe(0);
    expect(core.hasProperty('fcs/missing')).toBe(false);
    expect(core.getPropertyOrNull('fcs/missing')).toBeNull();
    expect(() => core.getPropertyStrict('fcs/missing')).toThrow(JSBSimPropertyError);
  });

  it('writes named and extended control channels', () => {
    const { core, exec } = createCore();

    core.setChannels(new Float32Array([0.1, -0.2, 0, 0.4, 0.5, -0.6]));

    expect(exec.properties.get('fcs/aileron-cmd-norm')).toBeCloseTo(0.1);
    expect(exec.properties.get('fcs/elevator-cmd-norm')).toBeCloseTo(-0.2);
    expect(exec.properties.get('fcs/throttle-cmd-norm')).toBe(0);
    // Rudder is negated at the SDK boundary: channel +0.4 (RC convention,
    // nose right) becomes JSBSim rudder-cmd -0.4 (aero convention).
    expect(exec.properties.get('fcs/rudder-cmd-norm')).toBeCloseTo(-0.4);
    expect(exec.properties.get('fcs/channel-5-norm')).toBeCloseTo(0.5);
    expect(exec.properties.get('fcs/channel-6-norm')).toBeCloseTo(-0.6);
  });
});
