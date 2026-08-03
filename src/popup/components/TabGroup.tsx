/**
 * TabGroup component — displays open tabs in a scrollable list.
 * Each tab is rendered as a TabCard with a close button.
 * Tabs are grouped by WINDOW and sorted by their position within it.
 *
 * MULTI-WINDOW: when more than one browser window is open the list is split
 * into per-window sections ("Window 1", "Window 2", …) so the user always
 * knows which tabs live in which window. Each section gets its own close
 * button for that window's non-pinned tabs. With a single window the plain
 * list is shown (no redundant header).
 *
 * ADHD design principles applied:
 * - Scrollable container with fixed height (no overwhelming lists)
 * - Each tab is a distinct, clickable card
 * - Hover effects provide clear interaction feedback
 * - Close buttons are subtle until hovered (reduce visual noise)
 */

import React from 'react';
import type { TabInfo, WindowInfo } from '../types';
import { TabCard } from './TabCard';
import { getWindowLabel } from '../utils/helpers';

/** Props for the TabGroup component */
interface TabGroupProps {
  /** Array of tabs to display */
  tabs: TabInfo[];
  /** Metadata for every open window (for grouping + labels) */
  windows: WindowInfo[];
  /** The window the popup/side panel is attached to */
  currentWindowId?: number | null;
  /** Callback when a tab's close button is clicked */
  onCloseTab: (tabId: number) => void;
  /** Callback when a tab is clicked (switches to that tab) */
  onTabClick?: (tab: TabInfo) => void;
  /** Callback to close all non-pinned tabs in a specific window */
  onCloseWindow?: (windowId: number) => void;
}

/**
 * Renders a group of open tabs as a scrollable card list,
 * split into per-window sections when multiple windows are open.
 */
export const TabGroup: React.FC<TabGroupProps> = ({
  tabs,
  windows,
  currentWindowId = null,
  onCloseTab,
  onTabClick,
  onCloseWindow,
}) => {
  // Empty state — shown when no tabs are open
  if (tabs.length === 0) {
    return (
      <div className="tab-group tab-group--empty">
        <p className="tab-group__empty-icon">🗂️</p>
        <p className="tab-group__empty-text">No tabs to show</p>
      </div>
    );
  }

  const multipleWindows = windows.length > 1;
  // Group tabs by window id, preserving insertion (window) order.
  const byWindow = new Map<number, TabInfo[]>();
  for (const tab of tabs) {
    const list = byWindow.get(tab.windowId) ?? [];
    list.push(tab);
    byWindow.set(tab.windowId, list);
  }
  // Stable window order: ascending window id.
  const windowIds = [...byWindow.keys()].sort((a, b) => a - b);

  const renderTab = (tab: TabInfo, index: number): React.ReactElement => (
    <TabCard
      key={tab.id}
      tab={tab}
      onClose={() => onCloseTab(tab.id)}
      onClick={() => onTabClick?.(tab)}
      index={index}
    />
  );

  return (
    <div className="tab-group">
      {/* Section header with tab count */}
      <div className="tab-group__header">
        <h3 className="tab-group__title">Open Tabs</h3>
        <span className="tab-group__count">{tabs.length}</span>
      </div>

      {/* Scrollable list of tab cards */}
      <div className="tab-group__list">
        {!multipleWindows
          ? tabs.map((tab, index) => renderTab(tab, index))
          : windowIds.map((windowId) => {
              const windowTabs = byWindow.get(windowId) ?? [];
              const isCurrent = currentWindowId != null && windowId === currentWindowId;
              const closableCount = windowTabs.filter((t) => !t.pinned).length;
              return (
                <section
                  key={windowId}
                  className={`tab-group__window ${isCurrent ? 'tab-group__window--current' : ''}`}
                  aria-label={`${getWindowLabel(windowId, windows)} — ${windowTabs.length} tabs`}
                >
                  <div className="tab-group__window-header">
                    <span className="tab-group__window-label">
                      {isCurrent && <span className="tab-group__window-dot" aria-hidden="true" />}
                      {getWindowLabel(windowId, windows)}
                    </span>
                    <span className="tab-group__window-meta">
                      {windowTabs.length} tab{windowTabs.length !== 1 ? 's' : ''}
                      {onCloseWindow && closableCount > 0 && (
                        <button
                          className="tab-group__window-close"
                          onClick={() => onCloseWindow(windowId)}
                          aria-label={`Close ${closableCount} tab${closableCount !== 1 ? 's' : ''} in ${getWindowLabel(windowId, windows)}`}
                          title={`Close non-pinned tabs in ${getWindowLabel(windowId, windows)}`}
                        >
                          ✕ Close
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="tab-group__window-tabs">
                    {windowTabs.map((tab, index) => renderTab(tab, index))}
                  </div>
                </section>
              );
            })}
      </div>
    </div>
  );
};
