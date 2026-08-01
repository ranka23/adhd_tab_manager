/**
 * Theme preload — applies the saved theme before React mounts to avoid a
 * light/dark flash. Loaded as an external script (MV3 CSP forbids inline
 * scripts in extension pages) via `<script src="/theme-preload.js">`.
 *
 * Falls back to the OS color scheme when no preference is stored, and never
 * blocks rendering if the extension APIs are unavailable (e.g. plain-browser
 * preview of the popup).
 */
(function () {
  try {
    var dark = false;
    try {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      /* matchMedia unavailable — stay light */
    }
    try {
      chrome.storage.local.get('adhd_theme', function (result) {
        var saved = result && result.adhd_theme;
        if (saved === 'dark') dark = true;
        else if (saved === 'light') dark = false;
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      });
    } catch (e) {
      /* chrome.storage unavailable (e.g. plain browser preview) — use OS default */
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }
  } catch (e) {
    /* Never block rendering */
  }
})();
