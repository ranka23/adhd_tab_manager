/**
 * Safari build helper.
 *
 * Safari does NOT support the side panel API (neither Chromium's
 * `side_panel`/`sidePanel` nor Firefox's `sidebar_action`), so the Safari
 * artifact keeps the classic toolbar POPUP as its only surface. Everything
 * else is identical to the Firefox build (Safari uses `background.scripts`
 * event pages — the exact shape `dist-firefox/` already has).
 *
 * Pipeline:
 *
 *  1. Requires `dist-firefox/` (produced by `pnpm build:all`).
 *  2. Copies it to `dist-safari/`.
 *  3. Rewrites the manifest:
 *     - removes `sidebar_action` (Safari: unsupported),
 *     - removes `browser_specific_settings.gecko` (Firefox-only; ignored by
 *       Safari but cleaner to drop),
 *     - restores `action.default_popup` so the toolbar button opens the popup,
 *     - keeps `background.scripts` (Safari event page shape).
 *
 * The result is a drop-in source directory for `safari-web-extension-packager`
 * (or the App Store Connect web packager) — see adhd-prod-todo.md §11 for the
 * full Safari wrapper effort (≈1–2 days, no code changes needed).
 *
 * Usage: `pnpm build:safari` (runs `pnpm build:all` first, then this script).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'dist-firefox');
const outDir = join(root, 'dist-safari');

if (!existsSync(join(srcDir, 'manifest.json'))) {
  console.error(
    '[build-safari] dist-firefox/ not found. Run `pnpm build:all` first (or use `pnpm build:safari`).',
  );
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(srcDir, outDir, { recursive: true });

const manifestPath = join(outDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Safari: no side panel / sidebar API — remove both surfaces' manifest keys.
delete manifest.side_panel;
delete manifest.sidebar_action;
manifest.permissions = (manifest.permissions ?? []).filter((p) => p !== 'sidePanel');

// Safari: the toolbar button opens the classic popup (the only surface).
manifest.action = {
  ...(manifest.action ?? {}),
  default_popup: 'src/popup/index.html',
};

// Safari ignores gecko settings; drop them so the packager sees a clean manifest.
delete manifest.browser_specific_settings;

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  '[build-safari] ✅ dist-safari/ ready — event-page background, popup surface (no side panel), ready for safari-web-extension-packager.',
);
