/**
 * QuickActions component — provides one-click utility actions.
 * Undo close, close all non-pinned tabs, and other quick operations.
 *
 * ADHD design principles:
 * - Large, clearly labeled buttons
 * - One action per button
 * - Visual feedback on action completion
 * - Undo-friendly: everything can be undone
 */

import React, { useState } from 'react';

/** Props for the QuickActions component */
interface QuickActionsProps {
  /** Total number of open tabs */
  tabCount: number;
  /** Number of pinned tabs (won't be closed by "close all") */
  pinnedCount: number;
  /** Callback to undo-close the last closed tab */
  onUndoClose: () => Promise<boolean>;
  /** Callback to close all non-pinned tabs */
  onCloseAll: () => void;
  /** Whether focus mode is active (affects available actions) */
  isFocusMode: boolean;
}

/**
 * Renders a grid of quick action buttons for common tab operations.
 * Each action has an icon and short label for easy scanning.
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  tabCount,
  pinnedCount,
  onUndoClose,
  onCloseAll,
  isFocusMode,
}) => {
  /** Whether to show the "close all" confirmation */
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  /** Success message shown briefly after an action */
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /** Handles undo-close with success feedback */
  const handleUndoClose = async (): Promise<void> => {
    const restored = await onUndoClose();
    if (restored) {
      setSuccessMessage('Tab restored! ↩️');
      setTimeout(() => setSuccessMessage(null), 2000);
    } else {
      setSuccessMessage('No tabs to restore');
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  /** Handles close-all with confirmation */
  const handleCloseAll = (): void => {
    if (!showCloseConfirm) {
      setShowCloseConfirm(true);
      return;
    }
    onCloseAll();
    setShowCloseConfirm(false);
    setSuccessMessage('Tabs closed (pinned kept)');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  return (
    <div className="quick-actions">
      <h3 className="quick-actions__title">Quick Actions</h3>

      {/* Success feedback toast */}
      {successMessage && (
        <div className="quick-actions__toast card-enter">
          {successMessage}
        </div>
      )}

      <div className="quick-actions__grid">
        {/* Undo Close — always available */}
        <button
          className="quick-action-btn"
          onClick={handleUndoClose}
          aria-label="Restore last closed tab"
        >
          <span className="quick-action-btn__icon">↩️</span>
          <span className="quick-action-btn__label">Undo Close</span>
        </button>

        {/* Close All Non-Pinned Tabs */}
        <button
          className={`quick-action-btn ${
            showCloseConfirm ? 'quick-action-btn--danger' : ''
          }`}
          onClick={handleCloseAll}
          onBlur={() => setShowCloseConfirm(false)}
          aria-label={
            showCloseConfirm
              ? 'Confirm close all non-pinned tabs'
              : 'Close all non-pinned tabs'
          }
        >
          <span className="quick-action-btn__icon">
            {showCloseConfirm ? '⚠️' : '🗑️'}
          </span>
          <span className="quick-action-btn__label">
            {showCloseConfirm ? 'Confirm?' : 'Close All'}
          </span>
          {!showCloseConfirm && tabCount > 0 && (
            <span className="quick-action-btn__badge">
              {tabCount - pinnedCount}
            </span>
          )}
        </button>

        {/* Tab count info */}
        <div className="quick-action-btn quick-action-btn--info" aria-disabled="true">
          <span className="quick-action-btn__icon">📊</span>
          <span className="quick-action-btn__label">
            {tabCount} tab{tabCount !== 1 ? 's' : ''} open
          </span>
          {pinnedCount > 0 && (
            <span className="quick-action-btn__subtext">
              {pinnedCount} pinned
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
