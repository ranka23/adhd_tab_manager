/**
 * Theme preload — applies the saved theme before React mounts to avoid a
 * light/dark flash. Loaded as an external script (MV3 CSP forbids inline
 * scripts in extension pages) via `<script src="/theme-preload.js">`.
 *
 * Strategy for zero flash:
 * 1. Synchronously apply a cached theme (localStorage mirror) if present,
 *    otherwise the OS color scheme — before the first paint.
 * 2. Then confirm with the authoritative chrome.storage.local value and
 *    re-apply if it differs (also refresh the cache).
 * 3. Listen for external storage changes (e.g. storage cleared or theme
 *    changed elsewhere) and keep the cache + applied theme in sync.
 *
 * Never blocks rendering if the extension APIs are unavailable (e.g.
 * plain-browser preview of the popup).
 */
(function () {
  var THEME_KEY = 'adhd_theme';
  var CACHE_KEY = 'adhd_theme_cache';

  function systemDark() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_e) {
      return false;
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  function readCache() {
    try {
      return localStorage.getItem(CACHE_KEY);
    } catch (_e) {
      return null;
    }
  }

  function writeCache(theme) {
    try {
      localStorage.setItem(CACHE_KEY, theme);
    } catch (_e) {
      /* storage unavailable — cache is best-effort */
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (_e) {
      /* ignore */
    }
  }

  try {
    // 1. Synchronous first paint — cached preference, else OS scheme.
    var cached = readCache();
    applyTheme(cached === 'dark' ? 'dark' : cached === 'light' ? 'light' : systemDark() ? 'dark' : 'light');
  } catch (_e) {
    /* ignore */
  }

  try {
    // 2. Authoritative value from extension storage.
    chrome.storage.local.get(THEME_KEY, function (result) {
      var saved = result && result[THEME_KEY];
      if (saved === 'dark' || saved === 'light') {
        writeCache(saved);
        applyTheme(saved);
      } else if (saved === undefined && cached === undefined) {
        // Never stored — reflect OS scheme (nothing persisted yet).
        applyTheme(systemDark() ? 'dark' : 'light');
      }
    });
  } catch (_e) {
    /* chrome.storage unavailable — OS default already applied above */
  }

  try {
    // 3. Keep cache + applied theme in sync with external storage changes.
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[THEME_KEY]) return;
      var v = changes[THEME_KEY].newValue;
      if (v === 'dark' || v === 'light') {
        writeCache(v);
        applyTheme(v);
      } else {
        // Theme cleared — fall back to OS scheme and drop the stale cache.
        clearCache();
        applyTheme(systemDark() ? 'dark' : 'light');
      }
    });
  } catch (_e) {
    /* ignore */
  }
})();
