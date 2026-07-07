#!/usr/bin/env bash
set -euo pipefail

# Resolves and prepares the pinned JSBSim source tree (clone if missing,
# enforce the pin if present), then applies the WASM patches.
# Override the source location with JSBSIM_SOURCE_DIR.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSBSIM_DIR="${JSBSIM_SOURCE_DIR:-$ROOT_DIR/vendor/jsbsim}"
JSBSIM_UPSTREAM="https://github.com/JSBSim-Team/jsbsim.git"

# Pinned JSBSim release. Update via 'npm run update:jsbsim -- --tag <vX.Y.Z>'.
# set-pin.mjs keeps all three in sync; JSBSIM_PINNED_COMMIT mirrors the SHA
# for backward compatibility with older tooling.
JSBSIM_PINNED_TAG="v1.3.0"
JSBSIM_PINNED_SHA="01ea7816288dce9e9f6a1a6dc048014bc65d699e"
JSBSIM_PINNED_COMMIT="01ea7816288dce9e9f6a1a6dc048014bc65d699e"

echo "Preparing JSBSim ($JSBSIM_PINNED_TAG @ ${JSBSIM_PINNED_SHA:0:8})..."
echo "JSBSim directory: $JSBSIM_DIR"

if [[ ! -d "$JSBSIM_DIR/.git" && ! -f "$JSBSIM_DIR/.git" ]]; then
  echo "JSBSim not found — cloning from $JSBSIM_UPSTREAM..."
  git clone "$JSBSIM_UPSTREAM" "$JSBSIM_DIR"
fi

# Always enforce the pin: fetch, then checkout the pinned SHA.
# This prevents silent drift if the submodule was manually bumped.
git -C "$JSBSIM_DIR" fetch origin --tags --quiet
git -C "$JSBSIM_DIR" checkout "$JSBSIM_PINNED_SHA" --quiet
echo "JSBSim pinned to $(git -C "$JSBSIM_DIR" describe --tags --always HEAD) ($(git -C "$JSBSIM_DIR" rev-parse --short HEAD))"

"$ROOT_DIR/scripts/apply-patches.sh"
echo "JSBSim preparation complete."
