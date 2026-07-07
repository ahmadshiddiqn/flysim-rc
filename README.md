# flysim-rc

Private JSBSim-to-WASM wrapper for `codename-bentang-langit`.

`flysim-rc` builds a pinned JSBSim release with Emscripten embind, exposes a small TypeScript SDK, and commits browser-ready WASM artifacts so the front-end simulator does not need a native toolchain.

## Current Target

- JSBSim: `v1.3.0`
- Package: `1.3.0-beta.1`
- Emscripten verified locally: `5.0.2`
- Node: `>=20`

## Layout

- `vendor/jsbsim` - pinned JSBSim source tree with local WASM patches
- `patches` - ordered patches applied by `scripts/apply-patches.sh`
- `scripts/bindings-generator` - source-text scanner and embind renderer for `FGFDMExec`
- `generated/FGFDMExecBindings.cpp` - generated embind binding file
- `src/core` - TypeScript SDK
- `public/wasm` - committed WASM artifacts for direct app serving
- `dist/wasm` - package-exported WASM artifacts created by `npm run build:sdk`

## Build

Activate Emscripten before building. On this Windows workspace, use MSYS/Git Bash before WSL on `PATH`:

```powershell
$env:PATH='C:\msys64\usr\bin;' + $env:PATH
npm run build
```

Useful commands:

```bash
npm run generate:bindings
npm run build:wasm
npm run build:sdk
npm run typecheck
npm test
```

The full verification gate is:

```bash
bash ./scripts/verify-build.sh
```

## Updating JSBSim

Use the update script so patches, generated bindings, WASM, typecheck, and tests stay aligned:

```bash
npm run update:jsbsim -- --tag v1.3.1
```

The pin is only updated after verification succeeds.

## Consuming From bentang-langit

`codename-bentang-langit` depends on this package with:

```json
"flysim-rc": "file:../flysim-rc"
```

The app serves WASM from its own `public/wasm` directory. Run this in `codename-bentang-langit` to refresh those files from the built `flysim-rc` package:

```bash
npm run sync:flysim-wasm
```

That sync is wired into `predev` and `prebuild` in the app.

### FRD feature split

The FRD (`docs/FRD.md`) covers the whole product. Features are split
between the two repositories as follows:

| FRD area | Lives in | As |
|----------|----------|----|
| `FlySimCore` (WASM engine, lifecycle, properties, 16-channel controls) | flysim-rc | `src/core/FlySimCore.ts` |
| Input Abstraction Layer / `InputManager` / gamepad profiles | codename-bentang-langit | `src/input/IAL.ts`, `GamepadProfile.ts` |
| `SITLManager` (autopilot connectivity) | codename-bentang-langit | `src/sim/SitlHitlLayer.ts` + `src/sim/mavlink.ts` |
| SITL/HITL bridges (Python) | flysim-rc | `bridge/bridge.py` (JSON↔pymavlink), `bridge/udp-bridge.py` (raw MAVLink passthrough) |
| UI (scene, instruments, recording, replay) | codename-bentang-langit | `src/` |

## License

The wrapper code in this repository is MIT licensed. JSBSim is licensed separately under the GNU Lesser General Public License; see `vendor/jsbsim` for upstream terms.
