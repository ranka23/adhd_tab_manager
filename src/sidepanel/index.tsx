/**
 * index.tsx — Entry point for the Chrome side panel.
 *
 * Reuses the exact same React app as the popup (the popup's fixed-size shell
 * is overridden by sidepanel.css), so every feature — focus mode, sessions,
 * timer, blocker, quick actions — is available in the persistent side panel.
 *
 * Also publishes a storage flag so the popup header can reflect the panel's
 * open state on its toggle icon (Chrome has no query API for "is the panel
 * open", so the page itself reports its lifecycle).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../popup/App';
import { ErrorBoundary } from '../popup/components/ErrorBoundary';
import { initTheme } from '../popup/utils/theme';
import { STORAGE_KEYS } from '../shared/constants';
import { browser } from '../shared/browser';

/* Import global styles, then side-panel-specific overrides */
import '../popup/styles/popup.css';
import '../popup/styles/components.css';
import '../popup/styles/animations.css';
import './sidepanel.css';

/* Report our lifecycle so the popup's header toggle icon stays in sync.
 * NB: `beforeunload` is NOT fired when the side panel closes (verified in
 * real Chrome) — `pagehide`/`unload` are, so those are the reliable hooks. */
void browser.storage.local.set({ [STORAGE_KEYS.SIDE_PANEL_OPEN]: true });
const markClosed = (): void => {
  void browser.storage.local.set({ [STORAGE_KEYS.SIDE_PANEL_OPEN]: false });
};
window.addEventListener('pagehide', markClosed);
window.addEventListener('unload', markClosed);

/**
 * Mount the React application to the #root element.
 * The theme is applied before rendering so the panel never flashes
 * the wrong color scheme.
 */
const rootElement = document.getElementById('root');
if (rootElement) {
  void initTheme().then(() => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  });
}
