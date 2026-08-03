/**
 * Header component — displays the app title and a focus mode toggle.
 * Uses the Material Design-inspired styling with calm blue tones.
 * The header is minimal to reduce cognitive load for ADHD users.
 *
 * The header shows the ADHD Tab Manager logo (replacing the old emoji),
 * export/import actions, the light/dark theme toggle, and the focus toggle.
 * There is intentionally NO side-panel toggle: on Chromium and Firefox the
 * side panel IS the default surface (toolbar click opens it), so a
 * panel ↔ popup switch icon would be redundant.
 */

import React from 'react';
import { browser } from '../../shared/browser';

/** Props for the Header component */
interface HeaderProps {
  /** Whether focus mode is currently active */
  isFocusMode: boolean;
  /** Callback to toggle focus mode */
  onToggleFocus: () => void;
  /** Whether dark mode is currently active */
  isDarkMode: boolean;
  /** Callback to toggle dark mode */
  onToggleDarkMode: () => void;
  /** Callback to export data */
  onExport?: () => void;
  /** Callback to import data */
  onImport?: () => void;
}

/**
 * Renders the extension header with the app name and focus mode button.
 * Uses calm, muted colors and plenty of whitespace for ADHD-friendly design.
 */
export const Header: React.FC<HeaderProps> = ({
  isFocusMode,
  onToggleFocus,
  isDarkMode,
  onToggleDarkMode,
  onExport,
  onImport,
}) => {
  /** Logo URL — only resolvable inside a real extension context (tests use a fallback) */
  const logoUrl =
    typeof browser.runtime?.getURL === 'function'
      ? browser.runtime.getURL('public/icons/icon48.png')
      : null;

  return (
    <header className="app-header">
      {/* App title with the extension logo */}
      <div className="header-title">
        {logoUrl ? (
          <img
            src={logoUrl}
            className="header-icon-img"
            width={26}
            height={26}
            alt=""
            aria-hidden="true"
          />
        ) : (
          <span className="header-icon" role="img" aria-label="brain">
            🧠
          </span>
        )}
        <h1 className="header-text">ADHD Tabs</h1>
      </div>

      <div className="header-actions">
        {/* Export/Import buttons */}
        {onExport && (
          <button
            className="theme-toggle"
            onClick={onExport}
            aria-label="Export data"
            title="Export data"
          >
            📤
          </button>
        )}
        {onImport && (
          <button
            className="theme-toggle"
            onClick={onImport}
            aria-label="Import data"
            title="Import data"
          >
            📥
          </button>
        )}
        {/* Dark mode toggle */}
        <button
          className="theme-toggle"
          onClick={onToggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Focus mode toggle — big, obvious button */}
        <button
          className={`focus-toggle ${isFocusMode ? 'focus-toggle--active' : ''}`}
          onClick={onToggleFocus}
          aria-label={isFocusMode ? 'End focus mode' : 'Start focus mode'}
        >
          <span className="focus-toggle-icon">{isFocusMode ? '🎯' : '🧘'}</span>
          <span className="focus-toggle-label">{isFocusMode ? 'Focusing' : 'Focus'}</span>
        </button>
      </div>
    </header>
  );
};
