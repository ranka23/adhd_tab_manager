/**
 * Chrome/Edge build helper.
 *
 * The source `manifest.json` keeps `action.default_popup` so that
 * @crxjs/vite-plugin bundles `src/popup/index.html` into `dist/`. That page is
 * still needed:
 *
 *   - by the e2e / manual / smoke test harnesses, which open the popup URL
 *     directly as a tab, and
 *   - by the Safari build, which restores the classic toolbar popup (Safari has
 *     no side panel API).
 *
 * However, on Chrome/Edge the side panel is the DEFAULT surface — the toolbar
 * click must open the panel (handled by `action.onClicked` in the service
 * worker), with no floating popup. So this script strips `default_popup` from
 * the built `dist/manifest.json` after `vite build`.
 *
 * Usage: `pnpm build` (runs `tsc && vite build`, then this script).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'dist', 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[build-chrome] dist/manifest.json not found. Run `vite build` first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Chrome/Edge: side panel is the only surface — no floating popup.
if (manifest.action?.default_popup !== undefined) {
  delete manifest.action.default_popup;
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('[build-chrome] ✅ dist/manifest.json — side panel is the default surface (default_popup stripped).');
