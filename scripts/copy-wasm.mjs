#!/usr/bin/env node
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'public', 'wasm');
const targetDir = join(root, 'dist', 'wasm');
const files = ['jsbsim_wasm.mjs', 'jsbsim_wasm.wasm'];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file);
  statSync(source);
  copyFileSync(source, target);
  console.log(`copied ${source} -> ${target}`);
}
