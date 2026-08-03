/**
 * Firefox build helper.
 *
 * The Chromium build (`vite build` via @crxjs/vite-plugin) outputs to `dist/`
 * with a module-type service worker (`service_worker` + `type: module`).
 *
 * Firefox (as of the addons-linter shipping with web-ext 8) rejects that
 * background shape outright (`/background/service_worker` is not supported),
 * so the Firefox artifact is built differently:
 *
 *  1. Copy the Chromium build to `dist-firefox/`.
 *  2. Bundle `src/background/service-worker.ts` into a single classic (non-
 *     module) IIFE script, `background.js`, via esbuild. Firefox MV3 event
 *     pages run classic scripts, so the bundle must not contain top-level
 *     `import`/`export` statements.
 *  3. Rewrite the manifest `background` to `{ "scripts": ["background.js"] }`
 *     (event page) and drop the Chrome-only `type: module` + `service_worker`.
 *  4. Add `browser_specific_settings.gecko` (required by AMO / stable ID) and
 *     strip the Chrome-only `key` field.
 *  5. Remove the now-unused Chromium service worker loader + bundle.
 *
 * Usage: `pnpm build:firefox` (runs `vite build` first, then this script).
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'dist');
const outDir = join(root, 'dist-firefox');

if (!existsSync(join(srcDir, 'manifest.json'))) {
  console.error('[build-firefox] dist/ not found. Run `pnpm build` first (or use `pnpm build:firefox`).');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(srcDir, outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* 1. Bundle the background service worker as a classic IIFE script.   */
/* ------------------------------------------------------------------ */
const swEntry = join(root, 'src/background/service-worker.ts');
const swOutfile = join(outDir, 'background.js');

await build({
  entryPoints: [swEntry],
  outfile: swOutfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  sourcemap: false,
  logLevel: 'warning',
});

// Guard: the bundle must be a classic script (no top-level imports/exports).
const bundle = readFileSync(swOutfile, 'utf8');
if (/^\s*(import|export)\s/m.test(bundle)) {
  console.error('[build-firefox] ❌ background.js contains top-level import/export — Firefox event pages need a classic script.');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 2. Patch the manifest for Firefox.                                  */
/* ------------------------------------------------------------------ */
const manifestPath = join(outDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Firefox-specific manifest additions
manifest.browser_specific_settings = {
  gecko: {
    // Stable ID so saved data survives updates. AMO (addons-linter) accepts
    // only two id formats: a UUID or `name@domain` (email-style) — a URL or
    // reverse-DNS string is REJECTED. The id is the developer's contact email
    // (nikhil@onefamili.com), per the project owner.
    id: 'nikhil@onefamili.com',
    strict_min_version: '121.0',
  },
};

// Chrome-only: a generated key that pins the extension ID in Chrome.
delete manifest.key;

// Chromium-only: Firefox has no side panel API — drop the manifest key and
// the permission so the addons-linter doesn't flag them as unsupported.
delete manifest.side_panel;
manifest.permissions = (manifest.permissions ?? []).filter((p) => p !== 'sidePanel');

// The toolbar click must open the sidebar (the default surface), never a
// floating popup — so drop the popup the source manifest kept for bundling.
delete manifest.action?.default_popup;

// Firefox's side-panel surface is the sidebar (`sidebar_action`, supported in
// MV3). This keeps the side panel the DEFAULT surface on Firefox with no
// floating popup, matching Chromium. `open_at_install` makes the sidebar the
// first thing the user sees after installing.
manifest.sidebar_action = {
  default_panel: 'src/sidepanel/index.html',
  default_title: 'ADHD Tabs',
  open_at_install: true,
};

// Firefox uses an event page (classic script), not a module service worker.
manifest.background = { scripts: ['background.js'] };

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

/* ------------------------------------------------------------------ */
/* 3. Remove the Chromium service worker loader + bundle.              */
/* ------------------------------------------------------------------ */
const chromeOnly = ['service-worker-loader.js'];
for (const entry of readdirSync(join(srcDir, 'assets'))) {
  if (entry.startsWith('service-worker.ts-')) chromeOnly.push(`assets/${entry}`);
}
for (const rel of chromeOnly) {
  const p = join(outDir, rel);
  if (existsSync(p)) rmSync(p);
}

console.log(
  '[build-firefox] ✅ dist-firefox/ ready — event-page background (background.js), gecko id set, Chrome-only artifacts removed.',
);
