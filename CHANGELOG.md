# Changelog

## 1.3.0-beta.1 - 2026-06-27

- Pinned JSBSim to `v1.3.0`.
- Hardened JSBSim preparation, patching, update, pin, and build scripts.
- Collapsed the project to the embind WASM build path and removed dead cwrap-era files.
- Added an original source-text `FGFDMExec` binding generator and removed the clang AST generator path.
- Regenerated embind bindings and added a generated TypeScript API reference.
- Fixed SDK lifecycle cleanup so embind `FGFDMExec.delete()` is called.
- Added script-based aircraft loading, typed load/property errors, property catalog queries, and strict property access helpers.
- Added Vitest unit tests and a Node-native WASM smoke test.
- Added GitHub Actions workflows for CI and scheduled/manual JSBSim updates.
- Fixed package WASM exports by copying built WASM artifacts into `dist/wasm`.
