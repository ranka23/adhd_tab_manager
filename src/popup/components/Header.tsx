/**
 * Header component — displays the app title and a focus mode toggle.
 * Uses the Material Design-inspired styling with calm blue tones.
 * The header is minimal to reduce cognitive load for ADHD users.
 */

import React from 'react';

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
  /** Whether the side panel is currently open (Chromium only) */
  isSidePanelOpen?: boolean;
  /** Callback to open the extension in the Chrome side panel */
  onToggleSidePanel?: () => void;
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
  isSidePanelOpen = false,
  onToggleSidePanel,
}) => {
  return (
    <header className="app-header">
      {/* App title with a gentle brain icon */}
      <div className="header-title">
        <span className="header-icon" role="img" aria-label="brain">
          🧠
        </span>
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

        {/* Side panel toggle — opens the extension in the Chrome side panel.
            Hidden where the API doesn't exist (Firefox, Safari). */}
        {onToggleSidePanel && (
          <button
            className={`side-panel-toggle ${isSidePanelOpen ? 'side-panel-toggle--active' : ''}`}
            onClick={onToggleSidePanel}
            aria-label="Open in side panel"
            aria-pressed={isSidePanelOpen}
            title={isSidePanelOpen ? 'Side panel open' : 'Open in side panel'}
          >
            {/* Side panel glyph — a window split by a vertical divider */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        )}

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
