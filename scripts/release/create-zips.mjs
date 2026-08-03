#!/usr/bin/env node
/**
 * Creates the four store zips from the built dist directories.
 *
 * Usage:
 *   node scripts/release/create-zips.mjs [version]
 *
 * If [version] is omitted it is read from package.json. The tag workflow passes
 * the git tag (e.g. v1.0.0 → 1.0.0) so the zip names always match the release.
 *
 * Output: artifacts/release/zips/adhd-tab-manager-{chrome,edge,firefox,safari}-<version>.zip
 *
 * Requires the system `zip` binary (present on macOS and ubuntu-latest).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ZIPS_DIR = join(ROOT, 'artifacts', 'release', 'zips');

const argVersion = process.argv[2]?.replace(/^v/, '');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = argVersion || pkg.version;

const TARGETS = [
  { dir: 'dist', name: 'chrome' },
  { dir: 'dist', name: 'edge' },
  { dir: 'dist-firefox', name: 'firefox' },
  { dir: 'dist-safari', name: 'safari' },
];

mkdirSync(ZIPS_DIR, { recursive: true });

// Remove only the zips we are about to regenerate (no broad rm of the dir).
for (const file of readdirSync(ZIPS_DIR)) {
  if (file.startsWith('adhd-tab-manager-')) {
    rmSync(join(ZIPS_DIR, file), { force: true });
  }
}

let built = 0;
for (const { dir, name } of TARGETS) {
  const src = join(ROOT, dir);
  if (!existsSync(src)) {
    console.warn(`[create-zips] skip ${dir} (not built)`);
    continue;
  }
  const out = join(ZIPS_DIR, `adhd-tab-manager-${name}-${version}.zip`);
  execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: src, stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(`[create-zips] ✅ ${dir} → ${out}`);
  built += 1;
}

console.log(`[create-zips] ${built} zip(s) created for v${version}`);
