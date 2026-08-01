/**
 * Popup.tsx — Main popup layout component.
 * Orchestrates all the major sections of the extension popup:
 * Header, navigation tabs, and content panels.
 *
 * Uses a tab-based navigation to keep one-thing-at-a-time UX.
 * Each tab shows a focused set of features without overwhelming the user.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FocusMode } from './components/FocusMode';
import { TabGroup } from './components/TabGroup';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SessionSaver } from './components/SessionSaver';
import { DistractionBlocker } from './components/DistractionBlocker';
import { DailyQuote } from './components/DailyQuote';
import { QuickActions } from './components/QuickActions';
import { useTabs } from './hooks/useTabs';
import { useTimer } from './hooks/useTimer';
import { useSessions } from './hooks/useSessions';
import { useBlockedSites } from './hooks/useBlockedSites';
import * as sessionService from './services/sessionService';
import * as blockService from './services/blockService';
import * as timerService from './services/timerService';
import * as tabService from './services/tabService';
import { EndOfDaySummary } from './components/EndOfDaySummary';
import { validateBackupData } from './utils/validation';
import { getAppliedTheme, saveTheme, type Theme } from './utils/theme';
import type { FocusModeState, DailyStats, TabSession } from './types';
import { POPUP_HEARTBEAT_INTERVAL_MS, STORAGE_KEYS } from '../shared/constants';
import { browser } from '../shared/browser';

/** Navigation tab identifiers */
type NavTab = 'home' | 'tabs' | 'timer' | 'sessions' | 'block';

/**
 * The main popup component.
 * Manages navigation between feature panels and coordinates
 * shared state like focus mode.
 */
export const Popup: React.FC = () => {
    /* ---- Dark mode state (theme is applied pre-render by initTheme) ---- */
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return getAppliedTheme() === 'dark';
  });

  /* ---- Undo session deletion state ---- */
  const [undoSessionDelete, setUndoSessionDelete] = useState<{
    session: TabSession;
  } | null>(null);
  const undoSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next: Theme = !prev ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      void saveTheme(next);
      return next === 'dark';
    });
  }, []);

  /** Currently active navigation tab */
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  /** Focus mode state */
  const [focusMode, setFocusMode] = useState<FocusModeState>({
    isActive: false,
    startedAt: null,
    savedTabIds: [],
  });

  /** Whether to show the end-of-day summary */
  const [showSummary, setShowSummary] = useState(false);

  /** Daily stats for the motivation section */
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    focusMinutes: 0,
    pomodorosCompleted: 0,
    distractionsBlocked: 0,
    sessionsSaved: 0,
    currentStreak: 0,
  });

  /** Toast notification message */
  const [toast, setToast] = useState<string | null>(null);

  /** Close-all confirmation dialog state */
  const [closeAllConfirm, setCloseAllConfirm] = useState<{
    tabCount: number;
    tabIds: number[];
  } | null>(null);

  /** Ref to store the summary timeout ID for cleanup */
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ref to prevent rapid focus mode toggle clicks */
  const isTogglingFocus = useRef(false);

  /** Ref to store the toast timeout ID for cleanup */
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Shows a toast notification that auto-dismisses */
  const showToast = useCallback((message: string): void => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  // Initialize all hooks
  const tabs = useTabs();
  const timer = useTimer();
  const sessions = useSessions();
  const blockedSites = useBlockedSites();

  /** Whether any hook is still loading */
  const isAnyLoading = tabs.isLoading || timer.isLoading || sessions.isLoading || blockedSites.isLoading;

  /** Combined error from all hooks */
  const combinedError = tabs.error ?? timer.error ?? sessions.error ?? blockedSites.error;

  /** Loads focus mode state and daily stats from storage */
  const loadState = useCallback(async () => {
    const result = await browser.storage.local.get([
      STORAGE_KEYS.FOCUS_MODE,
      STORAGE_KEYS.FOCUS_SAVED_TABS,
    ]);

    const storedFocus = result[STORAGE_KEYS.FOCUS_MODE] as FocusModeState | undefined;
    if (storedFocus) {
      setFocusMode(storedFocus);
    }

    const stats = await sessionService.getDailyStats();
    setDailyStats(stats);
  }, []);

  // Load state on mount
  useEffect(() => {
    void loadState();
  }, [loadState]);

  /**
   * Popup heartbeat — lets the background page detect an open popup on
   * Firefox (which lacks runtime.getContexts), so it can skip its own
   * once-per-minute pomodoro decrement while the popup ticks locally.
   */
  useEffect(() => {
    const writeHeartbeat = (): void => {
      void browser.storage.local.set({ [STORAGE_KEYS.POPUP_HEARTBEAT]: Date.now() });
    };
    writeHeartbeat();
    const heartbeatTimer = setInterval(writeHeartbeat, POPUP_HEARTBEAT_INTERVAL_MS);
    return (): void => {
      clearInterval(heartbeatTimer);
    };
  }, []);

  /** Handles starting focus mode */
  const handleStartFocus = useCallback(async () => {
    if (isTogglingFocus.current) return;
    isTogglingFocus.current = true;
    try {
      // Save current tab IDs for restoration — use returned data, avoid stale closure
      const currentTabs = await tabs.refreshTabs();
      const tabIds = currentTabs.map((t) => t.id);

      const newFocusState: FocusModeState = {
        isActive: true,
        startedAt: Date.now(),
        savedTabIds: tabIds,
      };

      await browser.storage.local.set({
        [STORAGE_KEYS.FOCUS_MODE]: newFocusState,
      });
      setFocusMode(newFocusState);

      // Force the blocker on (not a toggle — focus mode always enables it).
      await blockedSites.activate();
    } finally {
      isTogglingFocus.current = false;
    }
  }, [tabs, blockedSites]);

  /** Handles ending focus mode */
  const handleEndFocus = useCallback(async () => {
    if (isTogglingFocus.current) return;
    isTogglingFocus.current = true;
    try {
      // Calculate focus duration
      if (focusMode.startedAt) {
        const minutes = Math.floor((Date.now() - focusMode.startedAt) / 60000);
        await sessionService.addFocusMinutes(minutes);
      }

      const newFocusState: FocusModeState = {
        isActive: false,
        startedAt: null,
        savedTabIds: [],
      };

      await browser.storage.local.set({
        [STORAGE_KEYS.FOCUS_MODE]: newFocusState,
      });
      setFocusMode(newFocusState);

      // Force the blocker off (not a conditional toggle — focus end always disables it).
      await blockedSites.deactivate();

      // Reload stats
      const stats = await sessionService.getDailyStats();
      setDailyStats(stats);

      // Show summary after ending focus
      setShowSummary(true);
      summaryTimerRef.current = setTimeout(() => {
        setShowSummary(false);
        summaryTimerRef.current = null;
      }, 10000);
    } finally {
      isTogglingFocus.current = false;
    }
  }, [focusMode.startedAt, blockedSites]);

  /** Handles closing all non-pinned tabs with confirmation */
  const handleCloseAll = useCallback(async () => {
    const nonPinned = tabs.tabs.filter((t) => !t.pinned);
    if (nonPinned.length === 0) {
      showToast('No non-pinned tabs to close');
      return;
    }

    // Show confirmation dialog
    setCloseAllConfirm({
      tabCount: nonPinned.length,
      tabIds: nonPinned.map((t) => t.id),
    });
  }, [tabs, showToast]);

  /** Executes the close-all after confirmation */
  const executeCloseAll = useCallback(async () => {
    if (!closeAllConfirm) return;
    const { tabIds } = closeAllConfirm;
    setCloseAllConfirm(null);

    for (const tabId of tabIds) {
      await tabs.closeTab(tabId);
    }

    showToast(`Closed ${tabIds.length} tab${tabIds.length !== 1 ? 's' : ''}`);
  }, [closeAllConfirm, tabs, showToast]);

  /* ---- Close-all confirmation dialog: focus + Escape handling ---- */
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!closeAllConfirm) return;

    // Remember what was focused so we can restore it on close
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the destructive action so keyboard users can confirm quickly
    const confirmButton = confirmDialogRef.current?.querySelector<HTMLButtonElement>(
      '.btn-primary',
    );
    confirmButton?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setCloseAllConfirm(null);
        return;
      }

      // Trap Tab focus inside the dialog so keyboard users can't tab out.
      if (e.key === 'Tab' && confirmDialogRef.current) {
        const focusable = Array.from(
          confirmDialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey && (active === first || !confirmDialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !confirmDialogRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeAllConfirm]);

  // Load daily stats on mount
  useEffect(() => {
    void sessionService.getDailyStats().then(setDailyStats);
  }, []);

  // If focus mode is active and we're not on the home tab, switch to home
  useEffect(() => {
    if (focusMode.isActive && activeTab !== 'home') {
      setActiveTab('home');
    }
  }, [focusMode.isActive, activeTab]);

  /** Handles session save with success toast */
  const handleSessionSave = useCallback(
    async (name: string, icon: string) => {
      const session = await sessions.save(name, icon);
      showToast('Session saved! 💾');
      return session;
    },
    [sessions, showToast],
  );

  /** Handles session restore with success toast */
  const handleSessionRestore = useCallback(
    async (sessionId: string) => {
      await sessions.restore(sessionId);
      showToast('Session restored! ✅');
    },
    [sessions, showToast],
  );

  /** Handles session delete with undo support */
  const handleSessionDelete = useCallback(
    async (sessionId: string) => {
      /* Capture the full session before deletion so it can be restored */
      const session = sessions.sessions.find((s) => s.id === sessionId);
      if (!session) return;

      await sessions.remove(sessionId);

      /* Show undo toast */
      if (undoSessionTimerRef.current) clearTimeout(undoSessionTimerRef.current);
      setUndoSessionDelete({ session });
      undoSessionTimerRef.current = setTimeout(() => {
        setUndoSessionDelete(null);
        undoSessionTimerRef.current = null;
      }, 5000);
    },
    [sessions],
  );

  /** Handles undo for session deletion — actually re-inserts the session */
  const handleUndoSessionDelete = useCallback(async () => {
    if (!undoSessionDelete) return;
    if (undoSessionTimerRef.current) {
      clearTimeout(undoSessionTimerRef.current);
      undoSessionTimerRef.current = null;
    }

    const { session } = undoSessionDelete;
    setUndoSessionDelete(null);

    try {
      await tabService.restoreDeletedSession(session);
      await sessions.refresh();
      showToast('Session restored! ✅');
    } catch (err) {
      console.error('Error restoring session:', err);
      showToast('Could not restore session');
    }
  }, [undoSessionDelete, sessions, showToast]);

  /** Handles adding a blocked site with success toast */
  const handleAddBlockedSite = useCallback(
    async (domain: string) => {
      const alreadyBlocked = blockedSites.sites.some((s) => s.domain === domain);
      await blockedSites.addSite(domain);
      showToast(alreadyBlocked ? 'Site already blocked 🛡️' : 'Site added to block list! 🛡️');
    },
    [blockedSites, showToast],
  );

  /** Handles removing a blocked site with success toast */
  const handleRemoveBlockedSite = useCallback(
    async (domain: string) => {
      await blockedSites.removeSite(domain);
      showToast('Site removed from block list! ✅');
    },
    [blockedSites, showToast],
  );

  /** Export all data as JSON file */
  const handleExport = useCallback(async () => {
    try {
      const data = {
        sessions: await tabService.getSessions(),
        blockedSites: await blockService.getBlockedSites(),
        timerSettings: await timerService.getTimerSettings(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adhd-tab-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported ✅');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed');
    }
  }, [showToast]);

  /** Import data from a JSON file with schema validation */
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event): Promise<void> => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = validateBackupData(JSON.parse(text));

        // Write each validated section atomically (all or nothing)
        if (data.sessions) {
          await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS]: data.sessions });
        }
        if (data.blockedSites) {
          await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: data.blockedSites });
          await blockedSites.refresh();
        }
        if (data.timerSettings) {
          await browser.storage.local.set({ [STORAGE_KEYS.TIMER_SETTINGS]: data.timerSettings });
        }

        await sessions.refresh();
        await tabs.refreshTabs();
        showToast('Data imported ✅');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed — check file format';
        console.error('Import failed:', err);
        showToast(`Import failed: ${message}`);
      }
    };
    input.click();
  }, [sessions, blockedSites, tabs, showToast]);

  return (
    <div className="popup-root" data-testid="adhd-tab-manager">
      {/* Header with focus mode toggle and dark mode toggle */}
      <Header
        isFocusMode={focusMode.isActive}
        onToggleFocus={focusMode.isActive ? handleEndFocus : handleStartFocus}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Loading skeletons (shown when data is loading) */}
      {isAnyLoading && (
        <div className="skeleton-section" role="status" aria-label="Loading">
          <div className="skeleton-section__header">
            <div className="skeleton skeleton-line skeleton-line--title" />
            <div className="skeleton skeleton-line skeleton-line--badge" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="skeleton skeleton-circle" />
              <div className="skeleton-card__text">
                <div className="skeleton skeleton-line skeleton-line--title" />
                <div className="skeleton skeleton-line skeleton-line--subtitle" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {!isAnyLoading && combinedError && (
        <div className="error-banner" role="alert">
          <span className="error-banner__text">⚠️ {combinedError}</span>
          <button
            className="error-banner__dismiss"
            onClick={() => {
              // Clear the error from whichever hook set it
              if (tabs.error) tabs.refreshTabs();
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Undo session deletion toast */}
      {undoSessionDelete && (
        <div className="toast toast--undo card-enter" role="alert" aria-live="assertive">
          <span>Session &ldquo;{undoSessionDelete.session.name}&rdquo; deleted. </span>
          <button
            className="btn btn-text toast__action"
            onClick={handleUndoSessionDelete}
          >
            Undo
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && !undoSessionDelete && (
        <div className="toast card-enter" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Close-all confirmation dialog */}
      {closeAllConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setCloseAllConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm close tabs"
        >
          <div
            className="confirm-dialog"
            ref={confirmDialogRef}
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="confirm-dialog__body">
              <p className="confirm-dialog__message">
                Close {closeAllConfirm.tabCount} tab{closeAllConfirm.tabCount !== 1 ? 's' : ''}?
              </p>
              <p className="confirm-dialog__hint">
                You can undo this action after closing.
              </p>
            </div>
            <div className="confirm-dialog__actions">
              <button
                className="btn btn-text"
                onClick={() => setCloseAllConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--error-color, #d32f2f)' }}
                onClick={executeCloseAll}
              >
                Close {closeAllConfirm.tabCount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content (hidden while loading) */}
      {!isAnyLoading && (
        <div className="popup-content">
          {/* Focus Mode Panel (shown when active) */}
          {focusMode.isActive ? (
            <FocusMode
              isActive={focusMode.isActive}
              startedAt={focusMode.startedAt}
              onStart={handleStartFocus}
              onEnd={handleEndFocus}
            />
          ) : (
            <>
              {/* Navigation tabs */}
              <nav className="nav-tabs">
                <button
                  className={`nav-tab ${activeTab === 'home' ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab('home')}
                  role="tab"
                  aria-selected={activeTab === 'home'}
                  id="tab-home"
                  aria-controls="panel-home"
                >
                  <span className="nav-tab__icon">🏠</span>
                  Home
                </button>
                <button
                  className={`nav-tab ${activeTab === 'tabs' ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab('tabs')}
                  role="tab"
                  aria-selected={activeTab === 'tabs'}
                  id="tab-tabs"
                  aria-controls="panel-tabs"
                >
                  <span className="nav-tab__icon">🗂️</span>
                  Tabs
                </button>
                <button
                  className={`nav-tab ${activeTab === 'timer' ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab('timer')}
                  role="tab"
                  aria-selected={activeTab === 'timer'}
                  id="tab-timer"
                  aria-controls="panel-timer"
                >
                  <span className="nav-tab__icon">⏱️</span>
                  Timer
                </button>
                <button
                  className={`nav-tab ${activeTab === 'sessions' ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab('sessions')}
                  role="tab"
                  aria-selected={activeTab === 'sessions'}
                  id="tab-sessions"
                  aria-controls="panel-sessions"
                >
                  <span className="nav-tab__icon">💾</span>
                  Sessions
                </button>
                <button
                  className={`nav-tab ${activeTab === 'block' ? 'nav-tab--active' : ''}`}
                  onClick={() => setActiveTab('block')}
                  role="tab"
                  aria-selected={activeTab === 'block'}
                  id="tab-block"
                  aria-controls="panel-block"
                >
                  <span className="nav-tab__icon">🛡️</span>
                  Block
                </button>
              </nav>

              {/* Tab content panels */}
              {activeTab === 'home' && (
                <div className="tab-panel" role="tabpanel" id="panel-home" aria-labelledby="tab-home">
                  {showSummary && (
                    <div className="section">
                      <EndOfDaySummary stats={dailyStats} onDismiss={() => setShowSummary(false)} />
                    </div>
                  )}
                  <div className="section">
                    <DailyQuote stats={dailyStats} />
                  </div>
                  <div className="section">
                    <FocusMode
                      isActive={focusMode.isActive}
                      startedAt={focusMode.startedAt}
                      onStart={handleStartFocus}
                      onEnd={handleEndFocus}
                    />
                  </div>
                  <div className="section">
                    <QuickActions
                      tabCount={tabs.tabs.length}
                      pinnedCount={tabs.tabs.filter((t) => t.pinned).length}
                      onUndoClose={tabs.undoCloseTab}
                      onCloseAll={handleCloseAll}
                      isFocusMode={focusMode.isActive}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'tabs' && (
                <div className="tab-panel" role="tabpanel" id="panel-tabs" aria-labelledby="tab-tabs">
                  {tabs.tabs.length === 0 ? (
                    <div className="tab-group tab-group--empty tab-group--organized">
                      <p className="tab-group__empty-icon">🎉</p>
                      <p className="tab-group__empty-text">All organized!</p>
                      <p className="tab-group__empty-hint">No ungrouped tabs to show.</p>
                    </div>
                  ) : (
                    <TabGroup tabs={tabs.tabs} onCloseTab={tabs.closeTab} />
                  )}
                </div>
              )}

              {activeTab === 'timer' && (
                <div className="tab-panel" role="tabpanel" id="panel-timer" aria-labelledby="tab-timer">
                  <div className="section">
                    <PomodoroTimer
                      state={timer.state}
                      settings={timer.settings}
                      pomodoroCount={timer.pomodoroCount}
                      streak={timer.streak}
                      onStart={timer.startWork}
                      onPause={timer.pause}
                      onResume={timer.resume}
                      onReset={timer.reset}
                      onSkip={timer.skipPhase}
                      onUpdateSettings={timer.updateSettings}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'sessions' && (
                <div className="tab-panel" role="tabpanel" id="panel-sessions" aria-labelledby="tab-sessions">
                  <div className="section">
                    <SessionSaver
                      sessions={sessions.sessions}
                      openTabCount={tabs.tabs.length}
                      onSave={handleSessionSave}
                      onRestore={handleSessionRestore}
                      onDelete={handleSessionDelete}
                      onRename={sessions.rename}
                      onUndoClose={tabs.undoCloseTab}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'block' && (
                <div className="tab-panel" role="tabpanel" id="panel-block" aria-labelledby="tab-block">
                  <div className="section">
                    <DistractionBlocker
                      sites={blockedSites.sites}
                      isActive={blockedSites.isActive}
                      blockedCount={dailyStats.distractionsBlocked}
                      onAddSite={handleAddBlockedSite}
                      onRemoveSite={handleRemoveBlockedSite}
                      onToggleActive={blockedSites.toggleActive}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
