/**
 * QuickActions component — provides one-click utility actions.
 * Undo close, close non-pinned tabs in a chosen window, and close all
 * non-pinned tabs across every window.
 *
 * MULTI-WINDOW: "Close Window" opens a picker that lists every open window
 * ("Window 1 — 3 tabs", "Window 2 — 1 tab", …) so the user chooses exactly
 * which window to close. The picker collapses to a direct action when only
 * one window is open (the confirmation modal in the popup still applies).
 *
 * ADHD design principles:
 * - Large, clearly labeled buttons
 * - One action per button
 * - Visual feedback on action completion
 * - Undo-friendly: everything can be undone
 */

import React, { useEffect, useRef, useState } from 'react';

/** A single window the user can choose to close */
export interface WindowCloseOption {
  /** Chrome window ID */
  id: number;
  /** Display label ("Window 1", "Window 2", …) */
  label: string;
  /** Total tabs in the window */
  tabCount: number;
  /** Non-pinned tabs that would actually close */
  nonPinnedCount: number;
}

/** Props for the QuickActions component */
interface QuickActionsProps {
  /** Total number of open tabs */
  tabCount: number;
  /** Number of pinned tabs (won't be closed by "close all") */
  pinnedCount: number;
  /** Number of open browser windows */
  windowCount: number;
  /** Every open window, with per-window close counts (drives the picker) */
  windowOptions: WindowCloseOption[];
  /** Callback to undo-close the last closed tab */
  onUndoClose: () => Promise<boolean>;
  /** Callback to close all non-pinned tabs in a specific window */
  onCloseWindow: (windowId: number) => void;
  /** Callback to close all non-pinned tabs in every window */
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
  windowCount,
  windowOptions,
  onUndoClose,
  onCloseWindow,
  onCloseAll,
}) => {
  /** Whether to show the "close all" confirmation */
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  /** Whether the window picker modal is open */
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Success message shown briefly after an action */
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Ref for the window picker modal (focus + Escape handling) */
  const pickerRef = useRef<HTMLDivElement | null>(null);

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

  /**
   * Handles the Close Window button. With a single window the choice is
   * unambiguous — go straight to the popup's confirmation modal. With
   * several windows, open the picker so the user chooses which one.
   */
  const handleCloseWindow = (): void => {
    if (windowOptions.length <= 1) {
      const only = windowOptions[0];
      if (only) onCloseWindow(only.id);
      return;
    }
    setPickerOpen(true);
  };

  /** Picker: user selected a window — close the picker and confirm in the popup */
  const chooseWindow = (option: WindowCloseOption): void => {
    setPickerOpen(false);
    onCloseWindow(option.id);
  };

  /** Escape + focus management for the window picker modal */
  useEffect(() => {
    if (!pickerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = pickerRef.current?.querySelector<HTMLButtonElement>('.window-picker__option');
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setPickerOpen(false);
        return;
      }
      // Simple focus trap: Tab wraps between the options and Cancel.
      if (e.key === 'Tab' && pickerRef.current) {
        const focusable = Array.from(
          pickerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled])',
          ),
        );
        if (focusable.length === 0) return;
        const firstEl = focusable[0]!;
        const lastEl = focusable[focusable.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [pickerOpen]);

  /** Total non-pinned tabs across all windows — what "close" would remove */
  const closableTotal = windowOptions.reduce((sum, w) => sum + w.nonPinnedCount, 0);

  return (
    <div className="quick-actions">
      <h3 className="quick-actions__title">Quick Actions</h3>

      {/* Success feedback toast */}
      {successMessage && <div className="quick-actions__toast card-enter">{successMessage}</div>}

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

        {/* Close Non-Pinned Tabs — pick which window (Home tab chooser) */}
        <button
          className={`quick-action-btn ${showCloseConfirm ? 'quick-action-btn--danger' : ''}`}
          onClick={handleCloseWindow}
          onBlur={() => setShowCloseConfirm(false)}
          aria-label={
            windowOptions.length > 1
              ? 'Choose a window to close non-pinned tabs'
              : 'Close non-pinned tabs in this window'
          }
        >
          <span className="quick-action-btn__icon">🪟</span>
          <span className="quick-action-btn__label">Close Window</span>
          {!showCloseConfirm && tabCount > 0 && (
            <span className="quick-action-btn__badge">
              {closableTotal > 0 ? closableTotal : 0}
            </span>
          )}
        </button>

        {/* Close All Non-Pinned Tabs (every window) */}
        <button
          className={`quick-action-btn ${showCloseConfirm ? 'quick-action-btn--danger' : ''}`}
          onClick={handleCloseAll}
          onBlur={() => setShowCloseConfirm(false)}
          aria-label={
            showCloseConfirm ? 'Confirm close all non-pinned tabs' : 'Close all non-pinned tabs'
          }
        >
          <span className="quick-action-btn__icon">{showCloseConfirm ? '⚠️' : '🗑️'}</span>
          <span className="quick-action-btn__label">
            {showCloseConfirm ? 'Confirm?' : 'Close All'}
          </span>
          {!showCloseConfirm && tabCount > 0 && (
            <span className="quick-action-btn__badge">{tabCount - pinnedCount}</span>
          )}
        </button>

        {/* Tab count info */}
        <div className="quick-action-btn quick-action-btn--info" aria-disabled="true">
          <span className="quick-action-btn__icon">📊</span>
          <span className="quick-action-btn__label">
            {tabCount} tab{tabCount !== 1 ? 's' : ''} open
          </span>
          {pinnedCount > 0 && (
            <span className="quick-action-btn__subtext">{pinnedCount} pinned</span>
          )}
          {windowCount > 1 && (
            <span className="quick-action-btn__subtext">{windowCount} windows</span>
          )}
        </div>
      </div>

      {/* Window picker — "which window would you like to close?" */}
      {pickerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setPickerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Choose a window to close"
        >
          <div
            className="confirm-dialog window-picker"
            ref={pickerRef}
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="confirm-dialog__body">
              <p className="confirm-dialog__message">Which window would you like to close?</p>
              <div className="window-picker__list">
                {windowOptions.map((w) => (
                  <button
                    key={w.id}
                    className="window-picker__option"
                    onClick={() => chooseWindow(w)}
                  >
                    <span className="window-picker__name">{w.label}</span>
                    <span className="window-picker__count">
                      {w.tabCount} tab{w.tabCount !== 1 ? 's' : ''}
                      {w.nonPinnedCount > 0 && w.nonPinnedCount < w.tabCount
                        ? ` · ${w.nonPinnedCount} will close`
                        : w.nonPinnedCount === w.tabCount
                          ? ' · will close'
                          : ' · pinned only'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="confirm-dialog__hint">Pinned tabs stay open. You can undo after closing.</p>
            </div>
            <div className="confirm-dialog__actions">
              <button className="btn btn-text" onClick={() => setPickerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
