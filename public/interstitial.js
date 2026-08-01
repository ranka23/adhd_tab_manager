/**
 * Focus-mode interstitial page logic.
 * Reads the ?blocked=<domain> query param and wires the two actions.
 * External file because MV3 CSP forbids inline scripts in extension pages.
 */
(function () {
  'use strict';

  // Show which domain was blocked.
  try {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('blocked');
    const el = document.getElementById('domain');
    if (domain && el) el.textContent = domain;
  } catch (_e) {
    /* leave the placeholder */
  }

  // "Go Back" — return to the previous page, or close the tab if none.
  const back = document.getElementById('go-back');
  if (back) {
    back.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        try {
          window.close();
        } catch (_e) {
          /* may be blocked in some contexts */
        }
      }
    });
  }

  // "It's intentional" — close the interstitial tab.
  const cont = document.getElementById('continue');
  if (cont) {
    cont.addEventListener('click', function () {
      try {
        window.close();
      } catch (_e) {
        /* fall through */
      }
    });
  }
})();
