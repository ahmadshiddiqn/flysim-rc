#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
JSBSIM_DIR="${JSBSIM_SOURCE_DIR:-$ROOT_DIR/vendor/jsbsim}"
BINDINGS_FILE="$ROOT_DIR/generated/FGFDMExecBindings.cpp"

# Locate the Emscripten cmake wrapper across platforms.
# Unix:   emcmake          (shell script on PATH)
# Windows: emcmake.bat     (cmd wrapper on PATH; found by Git Bash)
# Fallback: emcmake.py     (invoke via python)
EMCMAKE=""
if command -v emcmake >/dev/null 2>&1; then
  EMCMAKE="emcmake"
elif command -v emcmake.bat >/dev/null 2>&1; then
  EMCMAKE="emcmake.bat"
elif command -v emcmake.py >/dev/null 2>&1; then
  EMCMAKE="python emcmake.py"
else
  echo "error: emcmake not found — activate the Emscripten SDK first" >&2
  echo "       (source <emsdk>/emsdk_env.sh on Unix, or run emsdk_env.bat on Windows)" >&2
  exit 1
fi

# Ensure JSBSim is cloned + pinned + patched.
"$ROOT_DIR/scripts/prepare-jsbsim.sh"

# The generated embind bindings file must exist.
if [[ ! -f "$BINDINGS_FILE" ]]; then
  echo "error: embind bindings not found at $BINDINGS_FILE" >&2
  echo "       Run 'npm run generate:bindings'." >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"

echo "Configuring JSBSim WASM build..."
# shellcheck disable=SC2086
$EMCMAKE cmake \
  -S "$ROOT_DIR/cmake" \
  -B "$BUILD_DIR" \
  -DJSBSIM_SOURCE_DIR="$JSBSIM_DIR" \
  -DCMAKE_BUILD_TYPE=Release

echo "Building JSBSim WASM..."
cmake --build "$BUILD_DIR" --target jsbsim_wasm --parallel

echo "Build complete. WASM files written to public/wasm/"
