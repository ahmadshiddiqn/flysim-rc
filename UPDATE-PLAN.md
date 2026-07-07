# flysim-rc — Handoff & Build Plan

**Last updated:** 2026-06-27 — This file is the canonical handoff for continuing development.

## Goal

Make `flysim-rc` a robust, privately-maintained JSBSim→WASM wrapper consumed exclusively by `codename-bentang-langit` (sibling project at `F:\code\Coding\2026\codename-bentang-langit`), with an easy, verified path to track the latest stable JSBSim release.

## Scope (locked)

- **Private.** No public npm publish. WASM artifacts committed so bentang-langit needs zero toolchain.
- **Original.** All scripts/generator/CI written originally — no verbatim derivation from `0x62/jsbsim-wasm`. Architecture (embind + submodule + patches + generator) is general industry knowledge; the code is ours.
- **Pure library + minimal smoke test.** No demo SPA — bentang-langit owns all UI.
- **Target JSBSim v1.3.0 currently.** v1.3.1 exists (2026-05-17) and can be upgraded via `npm run update:jsbsim -- --tag v1.3.1`.

## Status Overview

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 0 | Collapse to one build + cleanup | **done** | Deleted dead cwrap build, stale artifacts, dead tests. Archived 7 journal files. |
| 1 | Pin to JSBSim v1.3.0 + harden update scripts | **done** | Repinned from master. All 6 scripts hardened (original code). Pipeline verified idempotent. |
| 3 | Fix SDK bugs (leak, VFS, LoadModel, controls) | **done** | Lifecycle fix, Symbol.dispose, RAF cancel, property introspection, typed errors, QueryPropertyCatalog binding. WASM rebuilt. |
| 2 | Finish original bindings generator | **done** | Source scanner verified, renderers rewritten, clang AST path removed, generated embind output compiled. |
| 5 | Headless smoke test + unit tests | **done** | Vitest unit tests + Node WASM smoke test. `verify-build.sh` now runs `npm test`. |
| 4 | CI workflows | **done** | Added CI + scheduled/manual JSBSim update workflow. Update flow regenerates bindings before verification. |
| 6 | Consumption + docs + originality audit | **done** | Fixed package WASM exports, added docs/license/changelog, added bentang WASM sync, ran originality audit. |

---

## COMPLETED WORK

### Phase 0 — Collapse to one build + cleanup

**What was done:**
- Deleted root `CMakeLists.txt` (dead cwrap build)
- Deleted `src/core/jsbsim_wrapper.cpp` and `jsbsim_wrapper.h`
- Deleted stale cwrap artifacts from `build/` and `public/wasm/`
- Deleted `public/wasm/jsbsim_wasm.js` (byte-identical dup of `.mjs`)
- Deleted 6 cwrap test files (`test-*.html`, `test-*.js`)
- Deleted `scripts/bindings-generator/type-utils.mjs` (orphaned)
- Deleted `initial.yaml` (stray Playwright artifact)
- Archived 7 root `.md` journal files to `docs/history/` (includes `IMPLEMENTATION_COMPARISON.md` which has LoadModel root-cause notes)
- Edited `src/core/vfs.ts`: removed cwrap branch (embind-only FS)
- Edited `tsconfig.json`: removed unused `@sdk/*` and `@core/*` aliases
- Edited `package.json`: removed `generate:bindings` from `build` chain

### Phase 1 — Pin to JSBSim v1.3.0 + harden update scripts

**What was done:**
- **Repinned** from master `e588b1ff` to release tag **v1.3.0** (`01ea7816288dce9e9f6a1a6dc048014bc65d699e`)
- Package version → `1.3.0-beta.1`
- **Patches rebased** onto v1.3.0. Patch 02 CMakeLists hunk reworked to be **additive** (prepend `if(EMSCRIPTEN)` block instead of rewriting upstream lines)

**Hardened scripts (all original code, all in `scripts/`):**
- `prepare-jsbsim.sh` — enforces pin on every checkout, records tag+SHA+commit
- `apply-patches.sh` — honors `$JSBSIM_SOURCE_DIR`, `git apply --3way` fallback
- `update-jsbsim.sh` — `git reset --hard && git clean -fdx`, gates pin bump on `verify-build.sh`
- `set-pin.mjs` — Node helper, OS-agnostic, keeps tag/SHA/commit in sync
- `verify-build.sh` — runs `build:wasm && typecheck` as the gate
- `build-wasm.sh` — multi-form `emcmake` detection (`emcmake` / `emcmake.bat` / `emcmake.py`)
- `patches/MANIFEST.json` — explicit ordering + per-patch description + touched files

### Phase 3 — Fix SDK bugs

Files modified: `generated/FGFDMExecBindings.cpp`, `src/core/FlySimCore.ts`, `src/core/errors.ts`, `src/core/vfs.ts` (confirmed embind-only), `src/index.ts`.

**What was done:**
- **Lifecycle leak fixed:** `FlySimCore.destroy()` calls `this.exec?.delete()` before nulling. Added `Symbol.dispose` / `Symbol.asyncDispose`.
- **RAF cancel:** `stop()` cancels pending `requestAnimationFrame` immediately.
- **Primary aircraft loading path:** `loadAircraftScript(path, deltaT?, initFile?)` (LoadScript + RunIC) per `docs/history/IMPLEMENTATION_COMPARISON.md`. `loadModel` demoted to lower-level, throws `JSBSimLoadError`.
- **Property introspection:** `queryPropertyCatalog(prefix)`, `hasProperty(path)`, `getPropertyOrNull(path): number | null`, `getPropertyStrict(path)` (throws `JSBSimPropertyError`).
- **Typed errors:** `JSBSimLoadError` and `JSBSimPropertyError` in `src/core/errors.ts`, exported from package.
- **16-channel controls** already implemented (Phase 3 confirmed, no change needed).
- **String property access N/A:** `FGFDMExec` only has `double GetPropertyValue(string)` / `void SetPropertyValue(string, double)`. String access requires binding `SGPropertyNode` tree — out of scope.
- **QueryPropertyCatalog binding** added to `generated/FGFDMExecBindings.cpp`, WASM rebuilt.

### Phase 2 — Finish original bindings generator

Files modified: `scripts/bindings-generator/header-scan.mjs`, `scripts/bindings-generator/render-cpp.mjs`, `scripts/bindings-generator/render-ts.mjs`, `scripts/bindings-generator/index.mjs`, `generated/FGFDMExecBindings.cpp`, `src/generated/jsbsim-api.ts`, `package.json`. Deleted `scripts/bindings-generator/clang-ast.mjs`.

**What was done:**
- Fixed `header-scan.mjs` against real `vendor/jsbsim/src/FGFDMExec.h`; it now extracts 88 public methods, including inline public methods such as `Run`, path setters, property access, hold/suspend helpers, and timing accessors.
- Rewrote `render-cpp.mjs` as valid `.mjs`, with bindability filtering for pointers/shared_ptr/vector/internal types, `SGPath` string wrappers, `LoadModel` overload selection, `LoadScript` wrapper, `QueryPropertyCatalog` default-argument wrapper, and runtime-required method validation.
- Rewrote `render-ts.mjs` as valid `.mjs`; it emits `src/generated/jsbsim-api.ts` as a conservative PascalCase embind-surface reference interface.
- Rewrote `index.mjs` to use the source-text scanner, default to `vendor/jsbsim`, write `generated/FGFDMExecBindings.cpp`, write `src/generated/jsbsim-api.ts`, and maintain `generated/.fgfdmexec.hash`.
- Deleted the clang AST generator path after verification.
- Re-added `generate:bindings` to the normal `npm run build` chain.
- Regenerated `generated/FGFDMExecBindings.cpp`; the generated binding output is a superset of the old hand-curated file and compiled successfully with Emscripten.

**Verification:**
- `node .\scripts\bindings-generator\index.mjs` — staleness check passes.
- `npm run typecheck` — passes.
- `npm run build:wasm` — passes when MSYS/Git Bash is first on `PATH` (`C:\msys64\usr\bin` before WSL).
- `npm run build:sdk` — passes.

### Phase 5 — Headless smoke test + unit tests

Files added/modified: `vitest.config.ts`, `src/__tests__/errors.test.ts`, `src/__tests__/FlySimCore.test.ts`, `test/smoke.test.ts`, `package.json`, `package-lock.json`, `scripts/verify-build.sh`.

**What was done:**
- Added Vitest as the test runner and wired `npm test`.
- Added typed-error unit tests for `JSBSimLoadError` and `JSBSimPropertyError`.
- Added `FlySimCore` unit tests for embind lifecycle cleanup, script loading, typed load errors, strict/missing property access, and 16-channel control writes.
- Added a Node-native WASM smoke test using MEMFS with the minimal `aircraft/ball` fixture; it loads the model, runs initial conditions, steps physics, and asserts simulation time advances.
- Updated `scripts/verify-build.sh` so the update gate now runs `build:wasm`, `typecheck`, and `npm test`.

**Verification:**
- `npm test` — 3 files / 8 tests pass.
- `npm run typecheck` — passes.
- `npm run build:sdk` — passes.
- `bash ./scripts/verify-build.sh` — passes when MSYS/Git Bash is first on `PATH` on Windows.

### Phase 4 — CI workflows

Files added/modified: `.github/workflows/ci.yml`, `.github/workflows/update-jsbsim.yml`, `scripts/update-jsbsim.sh`, `scripts/build-wasm.sh`.

**What was done:**
- Added a push/PR CI workflow for Ubuntu that installs Node 22, installs Emscripten SDK 5.0.2, runs `npm ci`, then runs `npm run build`, `npm run typecheck`, and `npm test`.
- Added a scheduled/manual JSBSim update workflow. It resolves a requested tag or latest upstream tag, runs `npm run update:jsbsim -- --tag <tag>`, rebuilds the SDK, and opens/updates an automation PR when files change.
- Updated `scripts/update-jsbsim.sh` so JSBSim updates regenerate bindings against the selected header before running the verification gate.
- Removed stale Phase 2 wording from `scripts/build-wasm.sh`.

**Verification:**
- `bash -n scripts/update-jsbsim.sh` — passes.
- `bash -n scripts/verify-build.sh` — passes.
- `bash -n scripts/build-wasm.sh` — passes.
- `npm test` — passes.
- `npm run typecheck` — passes.

### Phase 6 — Consumption + docs + originality audit

Files added/modified: `README.md`, `LICENSE`, `CHANGELOG.md`, `scripts/copy-wasm.mjs`, `package.json`, `tsup.config.ts`, `F:\code\Coding\2026\codename-bentang-langit\scripts\sync-flysim-wasm.mjs`, `F:\code\Coding\2026\codename-bentang-langit\package.json`, `F:\code\Coding\2026\codename-bentang-langit\public\wasm\jsbsim_wasm.mjs`, `F:\code\Coding\2026\codename-bentang-langit\public\wasm\jsbsim_wasm.wasm`.

**What was done:**
- Fixed package WASM exports by copying `public/wasm/jsbsim_wasm.{mjs,wasm}` into `dist/wasm` during `npm run build:sdk`.
- Verified `npm pack --dry-run` includes `dist/wasm/jsbsim_wasm.mjs`, `dist/wasm/jsbsim_wasm.wasm`, declarations, README, LICENSE, and package metadata.
- Added `README.md` with build, test, JSBSim update, and `bentang-langit` consumption instructions.
- Added `LICENSE` as MIT for wrapper code, with an explicit note that JSBSim is separately LGPL-licensed upstream.
- Added `CHANGELOG.md` for `1.3.0-beta.1`.
- Added `codename-bentang-langit/scripts/sync-flysim-wasm.mjs` and wired it into `predev`/`prebuild`, so the app refreshes public WASM artifacts from the local `flysim-rc` dependency.
- Removed the unnecessary `"use client"` tsup banner that caused downstream Vite bundle warnings.
- Ran an originality string audit for `0x62` outside dependency/build folders; no matches found.

**Verification:**
- `npm run build` in `flysim-rc` — passes.
- `npm run typecheck` in `flysim-rc` — passes.
- `npm test` in `flysim-rc` — passes.
- `bash ./scripts/verify-build.sh` in `flysim-rc` — passes when MSYS/Git Bash is first on `PATH` on Windows.
- `npm pack --dry-run` in `flysim-rc` — package includes docs and WASM exports.
- `npm run sync:flysim-wasm` in `codename-bentang-langit` — passes.
- `npm run check` in `codename-bentang-langit` — passes.
- `npm run build` in `codename-bentang-langit` — passes; remaining Vite warning is only the existing chunk-size warning.

---

## REMAINING WORK

No planned phases remain in this handoff. Future work should start from the normal product backlog, not from this stabilization plan.

**2026-07-07 follow-up (FLYSIM-BENTANG-PLAN.md):** fixed test-page WASM
paths (`index.html`, `test-modern.html`), updated the IAL doc to the
16-channel reality, added `docs/history/README.md`, added a 16-channel
end-to-end test (`test/channels.test.ts`), added `bridge/udp-bridge.py`
(raw MAVLink UDP↔WebSocket passthrough), and synced FRD §4.1 to the
actual `FlySimCore` API.

---

## CRITICAL ENVIRONMENT CONTEXT

### Windows-specific toolchain quirks

1. **Emscripten SDK at `F:\code\Coding\2026\emsdk`** — `emcmake` is ONLY available as `.bat`, `.ps1`, `.py` (no native bash executable). `build-wasm.sh` detects `emcmake.bat` via `command -v emcmake.bat` in Git Bash.

2. **WSL bash vs Git Bash:** `npm run build:wasm` invokes `bash ./scripts/build-wasm.sh`. If WSL's `bash.exe` is first on PATH, the script fails because WSL can't find `emcmake.bat` (Windows `.bat` files aren't executable in WSL). **Solution:** ensure Git Bash's `bash.exe` is before WSL on PATH, or run scripts from Git Bash directly. The full `update-jsbsim.sh` flow was verified end-to-end through Git Bash with `emsdk_env.sh` sourced.

3. **`clang++.exe` at `C:\Program Files\LLVM\bin\`** (LLVM 18.1.8). Standalone clang++ cannot find C++ stdlib headers on Windows without the libc++ sysroot flag. Not a problem for the source-text scanner approach since clang is not needed.

4. **Windows `nul` reserved-name file** may reappear in `vendor/jsbsim` (created by `NUL` redirect artifacts). `update-jsbsim.sh` excludes it from `git clean` via `-e nul`.

5. **`build/CMakeCache.txt` staleness:** If you rebuild after switching branches or pins, delete `build/` entirely (`Remove-Item -Recurse -Force build`) before re-running `build:wasm` to avoid stale `JSBSIM_SOURCE_DIR` pointing at the wrong checkout.

### Key decisions for the next model

1. **Bindings generator: source-text scanner, NOT clang AST.** The clang AST dump is 512 MB on this Windows machine (libc++ template expansion). The scanner is fast, dependency-free, cross-platform, and original.

2. **Phase order:** 0→1→3→2→5→4→6. This is already the order used.

3. **Test framework:** Vitest is wired. The WASM smoke test uses Node-native WebAssembly loading with a minimal MEMFS aircraft fixture.

4. **CI platform:** Ubuntu. Workflows install Emscripten SDK 5.0.2 via `emsdk`, then run the same build/typecheck/test gates.

5. **Package versioning:** `<jsbsim-version>-beta.<N>` scheme. Currently `1.3.0-beta.1`.

## FILE MAP (for orientation)

```
flysim-rc/
├── UPDATE-PLAN.md                  ← THIS FILE — canonical handoff
├── package.json                    ← v1.3.0-beta.1, scripts, exports
├── README.md                       ← build/update/consumption docs
├── LICENSE                         ← MIT wrapper license + JSBSim LGPL note
├── CHANGELOG.md                    ← release summary
├── tsconfig.json                   ← strict TS config
├── tsup.config.ts                  ← bundler config
├── .github/
│   └── workflows/
│       ├── ci.yml                  ← build/typecheck/test gate
│       └── update-jsbsim.yml       ← scheduled/manual update PR workflow
│
├── generated/
│   ├── FGFDMExecBindings.cpp       ← generated embind bindings
│   └── .fgfdmexec.hash             ← FGFDMExec.h SHA-256 staleness marker
│
├── scripts/
│   ├── prepare-jsbsim.sh           ← enforces pin, fetches submodule
│   ├── update-jsbsim.sh            ← full update flow, gated on verify
│   ├── apply-patches.sh            ← applies patches with --3way
│   ├── build-wasm.sh               ← emcmake + cmake --build
│   ├── copy-wasm.mjs               ← copies public/wasm artifacts to dist/wasm
│   ├── verify-build.sh             ← build:wasm + typecheck + test gate
│   ├── set-pin.mjs                 ← OS-agnostic pin rewrite
│   │
│   └── bindings-generator/
│       ├── header-scan.mjs         ← source-text scanner
│       ├── render-cpp.mjs          ← embind C++ renderer
│       ├── render-ts.mjs           ← TypeScript API renderer
│       └── index.mjs               ← scan/render/staleness entrypoint
│
├── src/
│   ├── index.ts                    ← package exports
│   ├── generated/
│   │   └── jsbsim-api.ts           ← generated embind-surface TS reference
│   │
│   └── core/
│       ├── FlySimCore.ts           ← main SDK class (Phase 3 fixes applied)
│       ├── errors.ts               ← JSBSimLoadError, JSBSimPropertyError
│       ├── types.ts                ← AircraftControls, AircraftState, etc.
│       ├── vfs.ts                  ← embind-only FS (cwrap removed)
│       ├── EngineManager.ts        ← engine state machine
│       └── AircraftLoader.ts       ← VFS fetch+inject aircraft files
│
├── src/__tests__/                  ← SDK unit tests
│
├── cmake/
│   └── CMakeLists.txt              ← embind-only build config
│
├── patches/
│   ├── 01-emscripten-compat.patch
│   ├── 02-emscripten-io-guards.patch
│   └── MANIFEST.json
│
├── vendor/
│   └── jsbsim/                     ← submodule at v1.3.0, 7 patched files
│
├── public/
│   └── wasm/
│       ├── jsbsim_wasm.mjs         ← built WASM module
│       └── jsbsim_wasm.wasm        ← built WASM binary
│
├── test/
│   └── smoke.test.ts               ← Node WASM smoke test
│
├── docs/
│   ├── PRD.md
│   ├── FRD.md
│   ├── INPUT_ABSTRACTION_LAYER.md   ← 16-channel IAL spec
│   └── history/                    ← 7 archived journal files
│
├── dist/                           ← SDK build output (tsup + copied WASM)
├── build/                          ← CMake build directory (wasm build)
├── bridge/                         ← SITL/HITL MAVLink bridge
└── aircraft/                       ← bundled aircraft (for test pages)
```

## QUICK START (for the next model)

1. **Build everything:**
   ```bash
   # From Git Bash with emsdk_env.sh sourced:
   npm run build
   ```

2. **Update JSBSim to a new tag:**
   ```bash
   npm run update:jsbsim -- --tag v1.3.1
   ```

3. **Run bindings generator (after Phase 2 is complete):**
   ```bash
   npm run generate:bindings
   ```

4. **Typecheck:**
   ```bash
   npm run typecheck
   ```

5. **Build wasm only:**
   ```bash
   npm run build:wasm
   ```

## QUESTIONS FOR THE USER

- **Test framework:** vitest (recommended)? Playwright? Other?
- **Browser smoke test:** Node-native WASM loading (simpler) or headless browser (more realistic)?
- **License:** MIT (current `package.json` claim) or LGPL-2.1 (matching JSBSim)?
- **Workspace setup:** Does bentang-langit use pnpm workspaces, or a `file:` dependency?
