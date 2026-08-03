/**
 * index.tsx — Entry point for the side panel (Chrome / Edge / Firefox sidebar).
 *
 * Reuses the exact same React app as the popup (the popup's fixed-size shell
 * is overridden by sidepanel.css), so every feature — focus mode, sessions,
 * timer, blocker, quick actions — is available in the persistent side panel.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../popup/App';
import { ErrorBoundary } from '../popup/components/ErrorBoundary';
import { initTheme } from '../popup/utils/theme';

/* Import global styles, then side-panel-specific overrides */
import '../popup/styles/popup.css';
import '../popup/styles/components.css';
import '../popup/styles/animations.css';
import './sidepanel.css';

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
