#!/usr/bin/env node
/**
 * Shared-runtime packaging step (M1).
 *
 * 1. Compiles the shared TypeScript runtime to CommonJS in `shared/dist/`.
 * 2. Copies the compiled runtime into every cloud function's `lib/shared/`
 *    so the cloud functions execute the SAME validators / services as the
 *    tests, with NO duplicated, hand-maintained validators and NO symlinks.
 *
 * Design notes (Windows-friendly, no symlinks, no committed artifacts):
 *  - The compiled output is treated as a GENERATED artifact: `shared/dist/` and
 *    `cloudfunctions/<fn>/lib/shared/` are git-ignored; only `shared/*.ts` is
 *    the source of truth.
 *  - Copying (not symlinking) keeps each cloud function a self-contained deploy
 *    unit that WeChat DevTools can upload as-is.
 *  - A `package.json` with `{ "type": "commonjs" }` is written into each
 *    `lib/shared/` so Node resolves the copied `.js` files as CommonJS.
 *
 * Run via `npm run build:shared` (which first invokes `tsc`).
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
  copyFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shared/dist');
const CLOUD_ROOT = join(ROOT, 'cloudfunctions');
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// 1. Compile shared TypeScript -> CommonJS.
execFileSync(process.execPath, [TSC, '-p', join(ROOT, 'shared/tsconfig.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});
writeFileSync(
  join(DIST, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);

// 2. Package compiled runtime into each cloud function (generated, ignored).
if (existsSync(CLOUD_ROOT)) {
  for (const fn of readdirSync(CLOUD_ROOT)) {
    if (fn.startsWith('.')) continue; // skip helper dirs like .shared-src
    const fnDir = join(CLOUD_ROOT, fn);
    if (!statSync(fnDir).isDirectory()) continue;

    const target = join(fnDir, 'lib/shared');
    rmSync(target, { recursive: true, force: true });
    copyDir(DIST, target);
    writeFileSync(
      join(target, 'package.json'),
      JSON.stringify({ type: 'commonjs' }, null, 2),
    );
    console.log(`[build] shared runtime packaged -> cloudfunctions/${fn}/lib/shared`);
  }
}

// 3. Package the SAME runtime for the Mini Program client (M2). The client
//    cannot reliably import shared source outside miniprogramRoot, so it runs
//    the compiled CommonJS runtime from here. Generated + git-ignored; rebuilt
//    by every `npm run build:shared`. Windows-friendly (copy, no symlink).
const MINI_ROOT = join(ROOT, 'miniprogram/lib/shared');
rmSync(MINI_ROOT, { recursive: true, force: true });
copyDir(DIST, MINI_ROOT);
writeFileSync(
  join(MINI_ROOT, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);
console.log('[build] shared runtime packaged -> miniprogram/lib/shared');

console.log('[build] shared runtime build complete.');
