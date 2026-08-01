/**
 * Robust extension-id discovery for the e2e test environment.
 *
 * The MV3 service worker is frequently dormant (not listed in CDP targets)
 * and Chrome component extensions can use similar filenames, so this tries,
 * in order of reliability:
 *   1. the Chrome profile's Secure Preferences (extensions.settings entry
 *      whose `path` points at our dist/ directory) — authoritative, works
 *      even when the worker is asleep and no page has been opened yet
 *   2. a CDP page target for /src/popup/index.html
 *   3. a CDP service_worker target whose URL is our background
 *      (service-worker-loader.js from @crxjs, or service-worker.ts) — only
 *      used as a last resort since Chrome components may share the filename
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** @returns {Promise<string|null>} the extension id */
export async function discoverExtensionId(port, distDir) {
  const absoluteDist = resolve(distDir);

  // 1. Profile path match (most reliable).
  const profileDir = resolve(absoluteDist, '..', '.e2e-profile');
  for (const file of ['Default/Secure Preferences', 'Default/Preferences']) {
    try {
      const prefs = JSON.parse(readFileSync(resolve(profileDir, file), 'utf8'));
      const settings = prefs?.extensions?.settings ?? {};
      for (const [id, record] of Object.entries(settings)) {
        if (record?.path && resolve(record.path) === absoluteDist) {
          return id;
        }
      }
    } catch {
      /* try the next file */
    }
  }

  let targets = [];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    targets = await res.json();
  } catch {
    /* CDP not up yet */
  }

  // 2. Popup page target.
  const page = targets.find(
    (t) => t.type === 'page' && t.url.includes('/src/popup/index.html'),
  );
  if (page) return new URL(page.url).host;

  // 3. Service worker whose URL is our background.
  const isOurs = (url) =>
    url.startsWith('chrome-extension://') &&
    (url.includes('service-worker-loader.js') || url.includes('service-worker.ts'));
  const sw = targets.find((t) => t.type === 'service_worker' && isOurs(t.url));
  if (sw) return new URL(sw.url).host;

  return null;
}
