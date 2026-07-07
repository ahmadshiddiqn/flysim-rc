#!/usr/bin/env bash
set -euo pipefail

# Applies the WASM compatibility patches to the JSBSim source tree.
# Patches are applied in alphabetical order (the 01-/02- prefix enforces it;
# see patches/MANIFEST.json for the canonical order and descriptions).
# Uses --3way so a failed apply falls back to a 3-way merge when possible.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$ROOT_DIR/patches"
JSBSIM_DIR="${JSBSIM_SOURCE_DIR:-$ROOT_DIR/vendor/jsbsim}"

if [[ ! -d "$JSBSIM_DIR/.git" && ! -f "$JSBSIM_DIR/.git" ]]; then
  echo "error: JSBSim not found at $JSBSIM_DIR — run 'npm run prepare:jsbsim' first" >&2
  exit 1
fi

shopt -s nullglob
PATCH_FILES=( "$PATCH_DIR"/*.patch )
shopt -u nullglob

if [[ ${#PATCH_FILES[@]} -eq 0 ]]; then
  echo "No patches found in $PATCH_DIR"
  exit 0
fi

for PATCH_FILE in "${PATCH_FILES[@]}"; do
  BASENAME="$(basename "$PATCH_FILE")"
  if git -C "$JSBSIM_DIR" apply --check "$PATCH_FILE" >/dev/null 2>&1; then
    git -C "$JSBSIM_DIR" apply "$PATCH_FILE"
    echo "Applied: $BASENAME"
  elif git -C "$JSBSIM_DIR" apply --reverse --check "$PATCH_FILE" >/dev/null 2>&1; then
    echo "Already applied: $BASENAME"
  else
    # Last resort: 3-way merge (uses the blob hashes recorded in the patch).
    if git -C "$JSBSIM_DIR" apply --3way "$PATCH_FILE" 2>/dev/null; then
      echo "Applied (3-way): $BASENAME"
    else
      echo "error: could not apply patch: $BASENAME" >&2
      echo "       JSBSim was updated and the patch needs rebasing." >&2
      echo "       Inspect with: git -C \"$JSBSIM_DIR\" apply --reject --3way \"$PATCH_FILE\"" >&2
      exit 1
    fi
  fi
done
