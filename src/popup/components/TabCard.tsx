/**
 * TabCard component — displays a single tab as a card.
 * Shows favicon, title, URL, and a close button.
 *
 * ADHD design principles:
 * - Card has a subtle entrance animation (slide up + fade in)
 * - Close button is hidden until hover (reduces visual clutter)
 * - Clicking the card switches to that tab in Chrome
 * - Long titles are truncated to prevent layout breaking
 */

import React from 'react';
import type { TabInfo } from '../types';
import { truncate, extractDomain } from '../utils/helpers';

/** Props for the TabCard component */
interface TabCardProps {
  /** The tab data to display */
  tab: TabInfo;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Callback when the card itself is clicked */
  onClick: () => void;
  /** Index position (used for staggered animation delay) */
  index: number;
}

/**
 * Renders a single tab as a Material Design-inspired card.
 * Features: favicon, truncated title, domain, close button.
 */
export const TabCard: React.FC<TabCardProps> = ({ tab, onClose, onClick, index }) => {
  /** Handles click on the card — switches to the tab in Chrome */
  const handleClick = (): void => {
    // Focus the tab in Chrome by updating its active state
    chrome.tabs.update(tab.id, { active: true });
    onClick();
  };

  /** Prevents close button click from bubbling to the card click handler */
  const handleCloseClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onClose();
  };

  /** Handles keyboard navigation (Enter/Space to activate) */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className="tab-card card-enter"
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Switch to tab: ${tab.title}`}
    >
      {/* Favicon */}
      <div className="tab-card__icon">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="tab-card__favicon"
            width={16}
            height={16}
            onError={(e) => {
              // Fallback to a default icon if favicon fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="tab-card__favicon-placeholder">📄</span>
        )}
      </div>

      {/* Tab info — title and domain */}
      <div className="tab-card__info">
        <span className="tab-card__title" title={tab.title}>
          {truncate(tab.title, 40)}
        </span>
        <span className="tab-card__domain">{extractDomain(tab.url)}</span>
      </div>

      {/* Close button — visible on hover for minimal visual noise */}
      <button
        className="tab-card__close"
        onClick={handleCloseClick}
        aria-label={`Close tab: ${tab.title}`}
        title="Close tab"
      >
        ✕
      </button>
    </div>
  );
};
