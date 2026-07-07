// Main entry point for FGFDMExec binding generation.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFgfdmExec } from './header-scan.mjs';
import { renderCppBindings } from './render-cpp.mjs';
import { renderTsApi } from './render-ts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

const jsbsimSourceDir = process.env.JSBSIM_SOURCE_DIR || join(projectRoot, 'vendor/jsbsim');
const headerPath = join(jsbsimSourceDir, 'src/FGFDMExec.h');
const outputCpp = join(projectRoot, 'generated/FGFDMExecBindings.cpp');
const outputHash = join(projectRoot, 'generated/.fgfdmexec.hash');
const outputTs = join(projectRoot, 'src/generated/jsbsim-api.ts');
const force = process.argv.includes('--force');

function main() {
  if (!existsSync(headerPath)) {
    throw new Error(`FGFDMExec.h not found at ${headerPath}`);
  }

  const headerHash = hashFile(headerPath);
  if (!force && isFresh(headerHash)) {
    console.log(`FGFDMExec bindings are current (${headerHash}).`);
    return;
  }

  console.log(`Scanning ${headerPath}`);
  const methods = scanFgfdmExec(headerPath);
  console.log(`Found ${methods.length} public FGFDMExec methods.`);

  mkdirSync(dirname(outputCpp), { recursive: true });
  mkdirSync(dirname(outputTs), { recursive: true });

  writeFileSync(outputCpp, renderCppBindings(methods));
  writeFileSync(outputTs, renderTsApi(methods));
  writeFileSync(outputHash, `${headerHash}\n`);

  console.log(`Wrote ${outputCpp}`);
  console.log(`Wrote ${outputTs}`);
  console.log(`Wrote ${outputHash}`);
}

function isFresh(headerHash) {
  if (!existsSync(outputHash) || !existsSync(outputCpp) || !existsSync(outputTs)) return false;
  return readFileSync(outputHash, 'utf8').trim() === headerHash;
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
