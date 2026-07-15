# flysim-rc — Architecture & Codebase Analysis

> **Version:** 1.3.0-beta.1 | **Type:** TypeScript SDK library (zero UI) | **License:** MIT (wrapping code), LGPL-2.1 (JSBSim)

**Purpose:** Browser-based RC flight simulator SDK — wraps JSBSim C++ compiled to WebAssembly via Emscripten embind. Consumed by `codename-bentang-langit`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Build System](#2-build-system)
3. [Dependencies](#3-dependencies)
4. [Directory Structure](#4-directory-structure)
5. [Architecture](#5-architecture)
6. [Key Architectural Decisions](#6-key-architectural-decisions)
7. [Testing Strategy](#7-testing-strategy)
8. [CI/CD](#8-cicd)
9. [Complete File Index](#9-complete-file-index)

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| **Name** | `flysim-rc` |
| **Version** | `1.3.0-beta.1` |
| **Description** | Browser-based RC flight simulator using JSBSim compiled to WebAssembly |
| **Node** | `>=20` |
| **JSBSim** | `v1.3.0` (fixed via git submodule + pinned tag) |
| **Emscripten** | `5.0.2` |
| **Module type** | ES Module (`"type": "module"`) |
| **Repository** | Private; consumed by `codename-bentang-langit` |

**Key docs:**
- `README.md` — Build/update/consume instructions
- `CHANGELOG.md` — Release notes (1.3.0-beta.1, 2026-06-27)
- `UPDATE-PLAN.md` — Full handoff document with file mapping and build plan (309 lines)
- `docs/PRD.md` — Product Requirements Document (327 lines)
- `docs/FRD.md` — Functional Requirements Document (765 lines)
- `docs/INPUT_ABSTRACTION_LAYER.md` — IAL blueprint (208 lines)

**Test pages (not real UI):**
- `index.html` — Minimal browser test harness (545 lines, uses `FlySimCore`)
- `test-modern.html` — Updated test page (307 lines)

---

## 2. Build System

### TypeScript Config (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "generated/**/*"]
}
```

All strict flags enabled: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`.

### tsup Config (`tsup.config.ts`)

- **Entry:** `['src/index.ts', 'src/wasm.ts']`
- **Format:** `['esm']`
- **DTS:** true (generates type declarations)
- **Splitting:** false
- **Sourcemaps:** true
- **Platform:** browser
- **Minify:** false

### Vitest Config (`vitest.config.ts`)

- **Environment:** `node`
- **Include:** `src/**/*.test.ts`, `test/**/*.test.ts`
- **restoreMocks:** true
- **Timeout:** 30s

### CMake WASM Build (`cmake/CMakeLists.txt`)

Builds JSBSim as static lib via `add_subdirectory()`, then creates WASM executable `jsbsim_wasm` with embind bindings.

**Emscripten link flags:**
- `--bind` (enable embind)
- `-O3`
- `-sMODULARIZE=1`, `-sEXPORT_ES6=1`
- `-sENVIRONMENT=web,worker,node`
- `-sFILESYSTEM=1`, `-sFORCE_FILESYSTEM=1`
- `-sALLOW_MEMORY_GROWTH=1`
- `-sWASM_BIGINT=1`
- `-sNO_DISABLE_EXCEPTION_CATCHING`
- Exports: `['FS']`
- Post-build copies WASM files to `public/wasm/`

### npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `prepare:jsbsim` | `bash ./scripts/prepare-jsbsim.sh` | Clone/fetch JSBSim, enforce pinned tag, apply patches |
| `update:jsbsim` | `bash ./scripts/update-jsbsim.sh` | Full update flow: reset → fetch → patch → generate → verify → pin |
| `generate:bindings` | `node ./scripts/bindings-generator/index.mjs` | Scan FGFDMExec.h, generate C++ + TS bindings |
| `build:wasm` | `bash ./scripts/build-wasm.sh` | Emscripten cmake wrapper |
| `copy:wasm` | `node ./scripts/copy-wasm.mjs` | Copy WASM files to `dist/wasm/` |
| `build:sdk` | `tsup && npm run copy:wasm` | Build TS SDK + copy WASM |
| `build` | `generate:bindings && build:wasm && build:sdk` | Full pipeline |
| `test` | `vitest run` | Run tests |
| `typecheck` | `tsc --noEmit` | TypeScript type check |
| `clean` | `rm -rf build dist generated src/generated` | Clean all artifacts |

---

## 3. Dependencies

### Dev Dependencies (5)

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | `^20.0.0` | Node.js types |
| `puppeteer` | `^24.38.0` | Browser automation |
| `tsup` | `^8.5.0` | TypeScript bundler |
| `typescript` | `^5.8.0` | Language compiler |
| `vitest` | `^4.1.9` | Test framework |

### Production Dependencies: NONE

Zero runtime dependencies — pure TypeScript SDK wrapping pre-built WASM binary.

### Package Exports

```json
{
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./wasm": { "types": "./dist/wasm.d.ts", "import": "./dist/wasm.js" },
  "./wasm/module": { "default": "./dist/wasm/jsbsim_wasm.mjs" },
  "./wasm/binary": { "default": "./dist/wasm/jsbsim_wasm.wasm" }
}
```

Consumers import:
- `import { FlySimCore } from 'flysim-rc'` — main SDK
- `import { moduleUrl, binaryUrl } from 'flysim-rc/wasm'` — WASM URLs
- `import 'flysim-rc/wasm/module'` — raw WASM JS module
- `import 'flysim-rc/wasm/binary'` — raw WASM binary

---

## 4. Directory Structure

### 4.1 Source (`src/`)

```
src/
├── index.ts                    # Package entry — exports all public API
├── wasm.ts                     # WASM URL exports (moduleUrl, binaryUrl)
├── core/
│   ├── FlySimCore.ts           # Main SDK class + FlySimEngine factory (642 lines)
│   ├── errors.ts               # JSBSimLoadError, JSBSimPropertyError (21 lines)
│   ├── types.ts                # All TypeScript interfaces (115 lines)
│   ├── vfs.ts                  # WASM VFS manager (MEMFS + IDBFS) (176 lines)
│   ├── EngineManager.ts        # Engine start state machine (115 lines)
│   └── AircraftLoader.ts       # Fetch aircraft files, write to VFS (113 lines)
├── generated/
│   └── jsbsim-api.ts           # Auto-generated embind TS interfaces
└── __tests__/
    ├── errors.test.ts          # Typed error unit tests
    └── FlySimCore.test.ts      # Core SDK unit tests (mocked embind exec)
```

### 4.2 Bridge (`bridge/`)

```
bridge/
├── README.md                   # Bridge documentation (59 lines)
├── bridge.py                   # Python MAVLink JSON bridge (pymavlink + websockets, 263 lines)
├── udp-bridge.py               # Raw MAVLink v2 UDP <-> WebSocket passthrough (142 lines)
└── ardupilot-json-bridge.py    # ArduPilot JSON backend bridge (207 lines)
```

**Requirements:** `pip install websockets`. `bridge.py` additionally needs `pip install pymavlink`.

**Supported:** ArduPilot 4.6.3, PX4, MAVProxy, Mission Planner, QGroundControl.

### 4.3 Engine Definitions (`engine/`) — 93 XML files

Real JSBSim engine and propeller definitions:
- Electric: `DJI_E305.xml`, `DJI_9450.xml`, `electric_1mw.xml`, `electric147kW.xml`
- Piston: `eng_io320.xml`, `eng_O-200.xml`
- Turboprop: `PT6A-27.xml`, `t56.xml`
- Turbofan/jet: `F100-PW-229.xml`, `J85-GE-5.xml`
- Rocket: `SSME.xml`, `RL10.xml`
- Historical: `Oberursel-UrII.xml`, `Clerget9B.xml`

### 4.4 Aircraft Models (`aircraft/`) — 62 models

Includes:
- `ball/` — Minimal test rig for WASM smoke tests
- `c172p/`, `c172r/`, `c172x/` — Cessna 172 series
- `J3Cub/` — Piper J-3 Cub
- `f16/`, `f15/`, `f22/` — Fighters
- `b747/`, `737/`, `A320/` — Commercial
- `F450/` — DJI F450 quadcopter
- `Tri450/`, `Hexa550/`, `Octo650/` — Generated multirotors
- `p51d/`, `dr1/`, `Camel/` — Historical/WWII
- `Shuttle/`, `X15/`, `x24b/` — Spacecraft

**Note:** `aircraft/` and `public/aircraft/` contain the same data (latter serves the test page).

### 4.5 System Definitions (`systems/`) — 30 XML files

JSBSim system configs: `Autopilot.xml`, `FCS-pitch.xml`, `FCS-roll.xml`, `FCS-yaw.xml`, `flaps.xml`, `gear.xml`, `SensorBaro.xml`, `SensorGps.xml`, `SensorImu.xml`, `rpm_governor.xml`, `hydrodynamics.xml`, etc.

### 4.6 Public Assets (`public/`)

```
public/
├── wasm/
│   ├── jsbsim_wasm.mjs         # WASM JS loader
│   └── jsbsim_wasm.wasm        # WASM binary (~2-5 MB)
└── aircraft/                   # Aircraft data copy (symlinked to aircraft/)
    ├── ball/, c172p/, J3Cub/, ...
    └── ... (185 entries including engines, systems)
```

### 4.7 Generated (`generated/`)

```
generated/
├── .fgfdmexec.hash            # SHA-256 hash of FGFDMExec.h for staleness detection
└── FGFDMExecBindings.cpp      # Auto-generated embind C++ bindings
```

### 4.8 Build Artifacts (`build/`)

WASM build output from CMake/Ninja: `build.ninja`, `CMakeCache.txt`, `jsbsim_wasm.mjs`, `jsbsim_wasm.wasm`.

### 4.9 Distribution (`dist/`)

Output of tsup build:
```
dist/
├── index.js           # Bundled ESM entry
├── index.d.ts         # Type declarations
├── index.js.map       # Sourcemap
├── wasm.js            # WASM URL exports
├── wasm.d.ts
├── wasm.js.map
└── wasm/
    ├── jsbsim_wasm.mjs   # Copied from public/wasm/
    └── jsbsim_wasm.wasm
```

### 4.10 Vendor (`vendor/`)

```
vendor/
└── jsbsim/                 # Git submodule: https://github.com/JSBSim-Team/jsbsim.git
    ├── src/                # Full JSBSim C++ source
    │   ├── FGFDMExec.h     # Head scanned for bindings (722 lines, 88 public methods)
    │   ├── models/         # FDM models
    │   ├── math/           # Math library
    │   ├── input_output/   # I/O classes
    │   └── simgear/        # SimGear infrastructure
    ├── CMakeLists.txt      # JSBSim main build
    └── utils/              # Utilities (aeromatic++ aircraft generator)
```

### 4.11 Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `prepare-jsbsim.sh` | Clone/fetch JSBSim, enforce pinned tag, apply patches |
| `build-wasm.sh` | Emscripten cmake wrapper (multi-format emcmake detection) |
| `update-jsbsim.sh` | Full update: reset → fetch → patch → generate → verify → pin |
| `verify-build.sh` | Gate: build:wasm + typecheck + test |
| `apply-patches.sh` | Apply patches with --3way fallback |
| `copy-wasm.mjs` | Copy WASM files to dist/wasm/ |
| `set-pin.mjs` | Rewrite pinned tag/SHA in prepare-jsbsim.sh |
| `generate-multirotor.mjs` | Generate Tri450/Hexa550/Octo650 aircraft (403 lines) |
| `bindings-generator/index.mjs` | Entry: scan → render with staleness check (62 lines) |
| `bindings-generator/header-scan.mjs` | Source-text scanner for FGFDMExec.h (212 lines) |
| `bindings-generator/render-cpp.mjs` | embind C++ renderer (204 lines) |
| `bindings-generator/render-ts.mjs` | TypeScript API renderer (108 lines) |

### 4.12 Patches (`patches/`)

```
patches/
├── MANIFEST.json                    # Patch manifest with descriptions
├── 01-emscripten-compat.patch       # Emscripten libc compat (ANSI escapes, sockets, strerror_r)
└── 02-emscripten-io-guards.patch    # Disable socket/network I/O for WASM compile
```

**`01-emscripten-compat.patch`** — 3 files:
- `src/FGJSBBase.cpp` — Replace ANSI terminal color escapes with empty strings
- `src/input_output/FGfdmSocket.cpp` — Add BSD socket include path for Emscripten
- `src/simgear/misc/strutils.cxx` — Fix strerror_r POSIX vs GNU selection

**`02-emscripten-io-guards.patch`** — 4 files:
- `src/JSBSim.cpp` — Comment out `feenableexcept` under Emscripten
- `src/input_output/CMakeLists.txt` — Conditionally exclude socket/net I/O sources
- `src/models/FGInput.cpp` — Gracefully disable socket/UDP input under WASM
- `src/models/FGOutput.cpp` — Gracefully disable socket/FlightGear output under WASM

### 4.13 Tests (`test/`)

```
test/
├── smoke.test.ts           # Node WASM smoke test: load 'ball', run 5 steps, verify time
├── channels.test.ts        # 16-channel round-trip via fcs/channel-N-norm properties
└── multi.test.ts           # Multi-instance test: FlySimEngine, shared module, separate execs
```

### 4.14 Documentation (`docs/`)

```
docs/
├── PRD.md                               # Product Requirements Document
├── FRD.md                               # Functional Requirements Document
├── INPUT_ABSTRACTION_LAYER.md           # IAL blueprint
└── history/                             # Archived work logs (8 files)
    ├── FINAL_SUMMARY.md
    ├── FIXES_APPLIED.md
    ├── FIXES.md
    ├── IMPLEMENTATION_COMPARISON.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── PHASE1_COMPLETE.md
    └── TESTING.md
```

---

## 5. Architecture

### 5.1 Overall Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    codename-bentang-langit (UI Application)              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Scene/3D │  │ Instruments  │  │ IAL          │  │ SITLManager      │ │
│  │ (Three)  │  │ (Canvas 2D)  │  │ (Input Mgmt) │  │ (MAVLink WS)     │ │
│  └──────────┘  └──────────────┘  └──────┬───────┘  └────────┬─────────┘ │
└──────────────────────────────────────────┼────────────────────┼───────────┘
                                           │ WebSocket (JSON/MAVLink) │
                                           │                            │
        ┌──────────────────────────────────┼────────────────────────────┼────────────┐
        │          flysim-rc (SDK)         │                            │            │
        │  ┌───────────────────────────────┴───────────────┐            │            │
        │  │  FlySimCore                                    │            │            │
        │  │  - FDM exec lifecycle                          │            │            │
        │  │  - Property access (get/set)                   │            │            │
        │  │  - 16-channel control                          │            │            │
        │  │  - Fixed-timestep loop (120 Hz)                │            │            │
        │  │  - RAF + setTimeout fallback                   │            │            │
        │  └────────────────────┬──────────────────────────────┘            │            │
        │                       │                                          │            │
        │  ┌────────────────────▼────────────────┐  ┌────────────────────┐ │            │
        │  │  WasmVfsManager                     │  │  EngineManager     │ │            │
        │  │  (MEMFS + IDBFS persistence)         │  │  (Engine start     │ │            │
        │  └─────────────────────────────────────┘  │   state machine)   │ │            │
        │                                           └────────────────────┘ │            │
        │                                                                  │            │
        │  ┌──────────────────────────────────────────────────────────────┐ │            │
        │  │  JSBSim WASM (Emscripten embind)                            │ │            │
        │  │  FGFDMExec class (47 bound methods of 88 public)            │ │            │
        │  │  Auto-generated: generated/FGFDMExecBindings.cpp            │ │            │
        │  └──────────────────────────────────────────────────────────────┘ │            │
        └──────────────────────────────────────────────────────────────────┘────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Bridges (Python, standalone)                                                         │
│  bridge.py ←→ pymavlink ←→ ArduPilot/PX4 SITL/HITL                                  │
│  udp-bridge.py ←→ Raw MAVLink v2 UDP/WS passthrough                                  │
│  ardupilot-json-bridge.py ←→ ArduPilot JSON backend                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Core SDK Components

#### FlySimCore (`src/core/FlySimCore.ts`, 642 lines)

The primary public API. **Key methods:**

| Method | Purpose |
|--------|---------|
| `FlySimCore.create(options)` | Async factory — loads WASM module, creates FDM, inits VFS |
| `loadAircraftScript(path, deltaT?, initFile?)` | Main load path — loads a JSBSim script |
| `loadModel(model, options?)` | Lower-level load when script isn't available |
| `start()` / `stop()` | Start/stop the simulation loop |
| `getProperty(path)` / `setProperty(path, value)` | Property access |
| `setControls(controls)` | Set named controls (aileron, elevator, etc.) |
| `setChannels(ch)` | Set all 16 RC channels |
| `stepOnce()` | Single physics step (for headless use) |
| `destroy()` | Cleanup — calls `exec.delete()`, avoids WASM heap leak |
| `Symbol.dispose` / `Symbol.asyncDispose` | Explicit resource management |

**Simulation loop details:**
- Fixed timestep: 120 Hz (dt = 1/120 s)
- Uses `requestAnimationFrame` with `setTimeout` fallback for background tabs
- On aircraft change: calls `recreateExec()` — creates new FGFDMExec (JSBSim's `LoadModel` corrupts vtable under WASM)

#### FlySimEngine (lines 610-640 in FlySimCore.ts)

Shared module factory for multi-aircraft scenarios:
- `FlySimEngine.load(options)` — Load WASM module once
- `engine.createCore()` — Create independent sim instances sharing the same module
- `engine.sharedVfs` — Shared VFS across all cores

#### EngineManager (`src/core/EngineManager.ts`, 115 lines)

Engine start state machine for piston engines:
- Simulates starter cranking for up to 5 seconds (600 steps)
- Force-starts (`set-running = -1`) on failure
- Auto-releases brakes
- Driven by `onPhysicsStep()` — coupled to main sim loop

#### WasmVfsManager (`src/core/vfs.ts`, 176 lines)

Emscripten virtual filesystem wrapper:
- **MEMFS** — In-memory FS (always available)
- **IDBFS** — IndexedDB persistence (browser only)
- Paths resolved relative to `/runtime`
- Auto-creates directories
- `writeRuntimeFile` / `readRuntimeFile` / `mkdir` / `exists`

#### AircraftLoader (`src/core/AircraftLoader.ts`, 113 lines)

Fetches aircraft files from URLs and writes to VFS:
- File classification (aircraft/engine/system)
- Dedup cache
- Strict/non-strict modes
- Heuristic system/engine path resolution

#### Errors (`src/core/errors.ts`, 21 lines)

Two typed errors:
- `JSBSimLoadError` — Model metadata + error details
- `JSBSimPropertyError` — Property path

#### Types (`src/core/types.ts`, 115 lines)

All core interfaces:
- `AircraftControls` — `aileron`, `elevator`, `rudder`, `throttle`, `channels` (16-array)
- `AircraftState` — Position, attitude, velocity, controls, body rates, accelerations, NED velocities
- `FlySimOptions` — Module URL, WASM URL, persistence, logging
- `FlySimEventMap` — 7 events: `update`, `error`, `stdout`, `stderr`, `engine-started`, `engine-stopped`, `aircraft-loaded`
- `VfsManager`, `PropertyAccess` interfaces
- `ScenarioConfig`, `JSBSimLogEntry`, `BinaryLike`

### 5.3 Bindings Generator Pipeline

Custom pipeline (not derived from `0x62/jsbsim-wasm`):

1. **`header-scan.mjs`** — Plain-text scanner extracts 88 public methods from `FGFDMExec.h`. No clang AST needed (clang AST dump on Windows is 512 MB).

2. **`render-cpp.mjs`** — Generates `generated/FGFDMExecBindings.cpp` with 47 bound methods. Filters out pointers, vectors, shared pointers, internal classes. Wraps `SGPath` parameters. Validates only runtime-necessary methods.

3. **`render-ts.mjs`** — Generates `src/generated/jsbsim-api.ts` as TypeScript interface for the embind surface.

4. **`index.mjs`** — Orchestrator with SHA-256 staleness check on `FGFDMExec.h`.

**47 bound FGFDMExec methods:**
- **Core:** `Run`, `RunIC`, `LoadModel`, `LoadScript`, `GetPropertyValue`, `SetPropertyValue`, `QueryPropertyCatalog`, `GetSimTime`, `GetDeltaT`
- **Paths:** `SetAircraftPath`, `SetEnginePath`, `SetSystemsPath`, `SetOutputPath`, `SetRootDir`
- **Control:** `Hold`, `Resume`, `SuspendIntegration`, `ResumeIntegration`, `Holding`, `IntegrationSuspended`
- **Output:** `DisableOutput`, `EnableOutput`, `ForceOutput`, `SetLoggingRate`, `SetOutputDirectives`, `GetOutputFileName`
- **Maintenance:** `GetModelName`, `GetFDMCount`, `GetFrame`, `GetDebugLevel`, `SetDebugLevel`, `PrintPropertyCatalog`, `PrintSimulationConfiguration`
- **Trim:** `DoTrim`, `DoLinearization`, `SetTrimStatus`, `GetTrimStatus`, `SetTrimMode`, `GetTrimMode`
- **State:** `SetHoldDown`, `GetHoldDown`, `Setsim_time`, `Setdt`, `IncrTime`, `SetChild`, `Unbind`, `ResetToInitialConditions`, `LoadPlanet`, `CheckIncrementalHold`, `EnableIncrementThenHold`, `GetPropulsionTankReport`

### 5.4 Data Flow

```
Input (Gamepad / Keyboard / SITL)
  ↓
16-channel normalized (-1..1 / 0..1)
  ↓
FlySimCore.setChannels() / setControls()
  ↓
fcs/aileron-cmd-norm, fcs/elevator-cmd-norm, fcs/throttle-cmd-norm,
fcs/rudder-cmd-norm, fcs/channel-5-norm through fcs/channel-16-norm
  ↓
JSBSim FGFDMExec::SetPropertyValue()
  ↓
FGFDMExec::Run() (physics step, 120 Hz fixed)
  ↓
JSBSim FGFDMExec::GetPropertyValue() for state reads
  ↓
AircraftState struct → 'update' event → UI consumers
```

---

## 6. Key Architectural Decisions

1. **JSBSim as submodule, pinned at v1.3.0** — No rolling updates. Pinned tag + SHA stored in `scripts/prepare-jsbsim.sh`.

2. **Emscripten embind, not cwrap** — C++ object mapping, not C-style function tables.

3. **Source-text binding generator, not clang AST** — Cross-platform, lightweight (vs 512 MB clang AST dump on Windows).

4. **`recreateExec()` for aircraft switching** — JSBSim's `LoadModel` corrupts vtable under WASM. Always `destroy()` + create new exec.

5. **Fixed 120 Hz timestep** — RAF-driven with setTimeout fallback for hidden tabs.

6. **Shared module architecture** — `FlySimEngine` loads WASM once; `createCore()` produces multiple FDM instances.

7. **16-channel control model** — Ch 0-3 for primary surfaces, ch 4-15 extended (mapped to `fcs/channel-N-norm`).

8. **Zero production dependencies** — Pure TypeScript + pre-built WASM binary.

9. **Python bridges are standalone** — Exist in project but not imported by SDK.

10. **Aggressive memory management** — `destroy()` calls `exec.delete()`. `Symbol.dispose` / `Symbol.asyncDispose` for explicit resource management.

---

## 7. Testing Strategy

5 test files, 8 tests total:

| File | Location | Type | What it tests |
|------|----------|------|---------------|
| `errors.test.ts` | `src/__tests__/` | Unit | `JSBSimLoadError`, `JSBSimPropertyError` (2 tests) |
| `FlySimCore.test.ts` | `src/__tests__/` | Unit | Mocked embind exec; destroy, script load, typed errors, property introspection, 16-channels (5 tests) |
| `smoke.test.ts` | `test/` | WASM integration | Node WASM load; 'ball' aircraft, 5 steps, verify time (1 test) |
| `channels.test.ts` | `test/` | WASM integration | 16-channel round-trip via `fcs/channel-N-norm` (1 test) |
| `multi.test.ts` | `test/` | SDK integration | FlySimEngine multi-instance; independent sims, reload safety (2 tests) |

---

## 8. CI/CD

### CI Workflow (`.github/workflows/ci.yml`)
- **Trigger:** Push to main, PR to main
- **Runner:** ubuntu-latest
- **Steps:** Checkout → Node 22 → cmake/ninja → Cache/install emsdk 5.0.2 → `npm ci` → Source emsdk_env → `npm run build` → `npm run typecheck` → `npm test`

### Update JSBSim Workflow (`.github/workflows/update-jsbsim.yml`)
- **Trigger:** Scheduled (Mon 03:17 UTC) + manual
- Resolves requested tag or latest upstream tag
- Runs `npm run update:jsbsim -- --tag <tag>` + `npm run build:sdk`
- Creates automated PR if files changed

---

## 9. Complete File Index

### Root configs (7)
- `F:\code\Coding\2026\flysim-rc\package.json`
- `F:\code\Coding\2026\flysim-rc\tsconfig.json`
- `F:\code\Coding\2026\flysim-rc\tsup.config.ts`
- `F:\code\Coding\2026\flysim-rc\vitest.config.ts`
- `F:\code\Coding\2026\flysim-rc\.gitmodules`
- `F:\code\Coding\2026\flysim-rc\.gitignore`
- `F:\code\Coding\2026\flysim-rc\LICENSE`

### Documentation (10)
- `README.md`, `CHANGELOG.md`, `UPDATE-PLAN.md`
- `docs/PRD.md`, `docs/FRD.md`, `docs/INPUT_ABSTRACTION_LAYER.md`
- `docs/history/README.md`, `docs/history/FINAL_SUMMARY.md`, `docs/history/FIXES_APPLIED.md`, `docs/history/FIXES.md`
- `docs/history/IMPLEMENTATION_COMPARISON.md`, `docs/history/IMPLEMENTATION_SUMMARY.md`, `docs/history/PHASE1_COMPLETE.md`, `docs/history/TESTING.md`

### Source (8)
- `src/index.ts`, `src/wasm.ts`
- `src/core/FlySimCore.ts`, `src/core/errors.ts`, `src/core/types.ts`, `src/core/vfs.ts`, `src/core/EngineManager.ts`, `src/core/AircraftLoader.ts`
- `src/generated/jsbsim-api.ts`

### Generated bindings (2)
- `generated/FGFDMExecBindings.cpp`
- `generated/.fgfdmexec.hash`

### Scripts (12)
- `scripts/prepare-jsbsim.sh`, `scripts/update-jsbsim.sh`, `scripts/build-wasm.sh`, `scripts/verify-build.sh`, `scripts/apply-patches.sh`
- `scripts/copy-wasm.mjs`, `scripts/set-pin.mjs`, `scripts/generate-multirotor.mjs`
- `scripts/bindings-generator/index.mjs`, `scripts/bindings-generator/header-scan.mjs`, `scripts/bindings-generator/render-cpp.mjs`, `scripts/bindings-generator/render-ts.mjs`

### Tests (5)
- `src/__tests__/errors.test.ts`, `src/__tests__/FlySimCore.test.ts`
- `test/smoke.test.ts`, `test/channels.test.ts`, `test/multi.test.ts`

### Test pages (2)
- `index.html`, `test-modern.html`

### Bridges (4)
- `bridge/README.md`, `bridge/bridge.py`, `bridge/udp-bridge.py`, `bridge/ardupilot-json-bridge.py`

### Patches (3)
- `patches/MANIFEST.json`, `patches/01-emscripten-compat.patch`, `patches/02-emscripten-io-guards.patch`

### CMake (1)
- `cmake/CMakeLists.txt`

### CI (2)
- `.github/workflows/ci.yml`, `.github/workflows/update-jsbsim.yml`

### WASM artifacts (2)
- `public/wasm/jsbsim_wasm.mjs`, `public/wasm/jsbsim_wasm.wasm`

### Claude config (1)
- `.claude/settings.local.json`

### Aircraft data (burden but not source code)
- `aircraft/` — 62 models
- `engine/` — 93 engine XMLs
- `systems/` — 30 system XMLs
