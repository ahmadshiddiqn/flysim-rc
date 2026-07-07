#!/usr/bin/env node
// OS-agnostic helper: rewrites the JSBSim pin (tag + SHA) in prepare-jsbsim.sh.
// Called by update-jsbsim.sh after a verified successful update.
// Usage: node scripts/set-pin.mjs <tag> <full-sha>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, 'prepare-jsbsim.sh');
const [tag, sha] = process.argv.slice(2);

if (!tag || !sha) {
  console.error('usage: node scripts/set-pin.mjs <tag> <full-sha>');
  process.exit(2);
}

let src = readFileSync(target, 'utf8');
src = src.replace(/^JSBSIM_PINNED_TAG=.*$/m, `JSBSIM_PINNED_TAG="${tag}"`);
src = src.replace(/^JSBSIM_PINNED_SHA=.*$/m, `JSBSIM_PINNED_SHA="${sha}"`);
src = src.replace(/^JSBSIM_PINNED_COMMIT=.*$/m, `JSBSIM_PINNED_COMMIT="${sha}"`);
writeFileSync(target, src);
console.log(`pin updated: tag=${tag} sha=${sha}`);
