/**
 * index.tsx — Entry point for the popup.
 * Renders the React app into the DOM.
 * Also imports all global styles.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme } from './utils/theme';

/* Import global styles */
import './styles/popup.css';
import './styles/components.css';
import './styles/animations.css';

/**
 * Mount the React application to the #root element.
 * Uses React 18's createRoot API for concurrent features.
 * The theme is applied before rendering so the popup never flashes
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
