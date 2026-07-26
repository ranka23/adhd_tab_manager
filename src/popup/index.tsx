/**
 * index.tsx — Entry point for the popup.
 * Renders the React app into the DOM.
 * Also imports all global styles.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

/* Import global styles */
import './styles/popup.css';
import './styles/components.css';
import './styles/animations.css';

/**
 * Mount the React application to the #root element.
 * Uses React 18's createRoot API for concurrent features.
 */
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
