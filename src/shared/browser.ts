/**
 * Cross-browser extension API namespace.
 *
 * Chrome (Manifest V3) exposes promise-returning methods on the `chrome.*`
 * namespace. Firefox exposes the promise-based `browser.*` namespace (its
 * `chrome.*` namespace is callback-based). To run the same code on both,
 * prefer `browser` when it exists and fall back to `chrome` on Chromium.
 *
 * All extension API access in this codebase goes through this module so the
 * promise-style usage (`await browser.storage.local.get(...)`) works on
 * Chrome, Firefox, and (where supported) Safari.
 */

const globalRef = globalThis as typeof globalThis & {
  browser?: typeof chrome;
};

/** Extension API namespace — promise-based on both Chrome and Firefox */
export const browser: typeof chrome = globalRef.browser ?? chrome;
