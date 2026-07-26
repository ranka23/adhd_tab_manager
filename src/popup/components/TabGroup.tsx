/**
 * TabGroup component — displays open tabs in a scrollable list.
 * Each tab is rendered as a TabCard with a close button.
 * Tabs are grouped and sorted by their position in the window.
 *
 * ADHD design principles applied:
 * - Scrollable container with fixed height (no overwhelming lists)
 * - Each tab is a distinct, clickable card
 * - Hover effects provide clear interaction feedback
 * - Close buttons are subtle until hovered (reduce visual noise)
 */

import React from 'react';
import type { TabInfo } from '../types';
import { TabCard } from './TabCard';

/** Props for the TabGroup component */
interface TabGroupProps {
  /** Array of tabs to display */
  tabs: TabInfo[];
  /** Callback when a tab's close button is clicked */
  onCloseTab: (tabId: number) => void;
  /** Callback when a tab is clicked (switches to that tab) */
  onTabClick?: (tab: TabInfo) => void;
}

/**
 * Renders a group of open tabs as a scrollable card list.
 * Handles empty state with a friendly message.
 */
export const TabGroup: React.FC<TabGroupProps> = ({ tabs, onCloseTab, onTabClick }) => {
  // Empty state — shown when no tabs are open
  if (tabs.length === 0) {
    return (
      <div className="tab-group tab-group--empty">
        <p className="tab-group__empty-icon">🗂️</p>
        <p className="tab-group__empty-text">No tabs to show</p>
      </div>
    );
  }

  return (
    <div className="tab-group">
      {/* Section header with tab count */}
      <div className="tab-group__header">
        <h3 className="tab-group__title">Open Tabs</h3>
        <span className="tab-group__count">{tabs.length}</span>
      </div>

      {/* Scrollable list of tab cards */}
      <div className="tab-group__list">
        {tabs.map((tab, index) => (
          <TabCard
            key={tab.id}
            tab={tab}
            onClose={() => onCloseTab(tab.id)}
            onClick={() => onTabClick?.(tab)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};
