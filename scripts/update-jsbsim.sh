#!/usr/bin/env bash
set -euo pipefail
# Usage: npm run update:jsbsim -- [--tag vX.Y.Z | --ref <sha>]
# Moves vendor/jsbsim to a new JSBSim version, re-applies WASM patches,
# verifies the build + typecheck pass, and ONLY THEN bumps the pin.
# If verification fails the pin is left untouched so the tree stays valid.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSBSIM_DIR="${JSBSIM_SOURCE_DIR:-$ROOT_DIR/vendor/jsbsim}"
TARGET_TAG=""
TARGET_REF=""

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --tag <vX.Y.Z>   checkout a specific JSBSim release tag (e.g. v1.3.0)
  --ref <sha>      checkout a specific commit SHA or branch ref
  (no args)        pull latest master from upstream

The pin in prepare-jsbsim.sh is only updated after the patched tree builds
and typechecks successfully (see scripts/verify-build.sh).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TARGET_TAG="${2:-}"; shift 2 ;;
    --ref) TARGET_REF="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

# Ensure vendor/jsbsim exists at the current pin.
"$ROOT_DIR/scripts/prepare-jsbsim.sh"

# Hard reset + clean: remove any applied patches and untracked files so we
# start from a pristine upstream tree (stronger than 'git checkout -- .').
# On Windows, a stray untracked file named `nul` (a reserved device name that
# some redirects create and normal tools cannot delete) is excluded so clean
# does not abort; it is harmless and ignored by the build.
echo "Resetting vendor/jsbsim to pristine state..."
git -C "$JSBSIM_DIR" reset --hard HEAD --quiet
git -C "$JSBSIM_DIR" clean -fdx -e nul --quiet

git -C "$JSBSIM_DIR" fetch origin --tags --quiet

if [[ -n "$TARGET_TAG" ]]; then
  git -C "$JSBSIM_DIR" checkout "tags/$TARGET_TAG" --quiet
  echo "Checked out JSBSim tag: $TARGET_TAG"
elif [[ -n "$TARGET_REF" ]]; then
  git -C "$JSBSIM_DIR" checkout "$TARGET_REF" --quiet
  echo "Checked out JSBSim ref: $TARGET_REF"
else
  git -C "$JSBSIM_DIR" checkout master --quiet 2>/dev/null || git -C "$JSBSIM_DIR" checkout -b master origin/master --quiet
  git -C "$JSBSIM_DIR" pull --ff-only origin master --quiet
  echo "Updated JSBSim to latest master"
fi

NEW_SHA="$(git -C "$JSBSIM_DIR" rev-parse HEAD)"
NEW_TAG="$TARGET_TAG"
if [[ -z "$NEW_TAG" ]]; then
  NEW_TAG="$(git -C "$JSBSIM_DIR" describe --tags --always HEAD)"
fi
echo "JSBSim is now at: ${NEW_SHA:0:8} ($NEW_TAG)"

# Re-apply patches onto the new tree.
"$ROOT_DIR/scripts/apply-patches.sh"

# Regenerate bindings against the selected JSBSim header before verification.
echo ""
echo "Regenerating bindings..."
npm run generate:bindings

# Verify the patched tree builds, typechecks, and passes tests before bumping the pin.
echo ""
echo "Verifying build + typecheck + tests (pin will not be bumped if this fails)..."
if ! "$ROOT_DIR/scripts/verify-build.sh"; then
  echo "error: verification failed — pin left at previous value." >&2
  echo "       Fix the patches/build, then re-run this script." >&2
  exit 1
fi

# Success: bump the pin (OS-agnostic, no sed -i portability issues).
node "$ROOT_DIR/scripts/set-pin.mjs" "$NEW_TAG" "$NEW_SHA"
echo ""
echo "Done. Pin updated to $NEW_TAG (${NEW_SHA:0:8})."
