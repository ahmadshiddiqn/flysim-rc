#!/usr/bin/env bash
set -euo pipefail
# Verifies the patched JSBSim tree builds to WASM, typechecks, and passes tests.
# This is the gate that update-jsbsim.sh requires before bumping the pin.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[verify] building WASM..."
npm run build:wasm

echo "[verify] typechecking SDK..."
npm run typecheck

echo "[verify] running tests..."
npm test

echo "[verify] OK"
