/**
 * useTabs hook — manages tab state and tab-related actions in the popup.
 * Provides a clean interface for components to interact with tabs.
 *
 * LIVE DATA: the hook subscribes to the Chrome tab & window event streams
 * (created/removed/moved/activated/updated/attached/detached/replaced plus
 * window removed/focus-changed) so the UI stays in sync with reality even
 * when tabs change outside the popup — e.g. a tab closed in the browser, a
 * second window opened, or a page navigating. Every change re-queries
 * chrome.tabs so the rendered list is always current.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TabInfo, TabSession, WindowInfo } from '../types';
import * as tabService from '../services/tabService';
import { browser } from '../../shared/browser';

/** Debounce for tabs.onUpdated (fires on every title/status/favicon change) */
const TAB_UPDATE_DEBOUNCE_MS = 150;

/** Return type for the useTabs hook */
interface UseTabsReturn {
  /** All currently open tabs (across all windows) */
  tabs: TabInfo[];
  /** All saved sessions */
  sessions: TabSession[];
  /** Metadata for every open browser window (sorted by id) */
  windows: WindowInfo[];
  /** The window the popup/side panel is attached to */
  currentWindowId: number | null;
  /** Whether tabs are currently loading */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Refresh the tab list from Chrome. Returns the loaded tabs. */
  refreshTabs: () => Promise<TabInfo[]>;
  /** Refresh the window metadata list */
  refreshWindows: () => Promise<void>;
  /** Refresh the sessions list from storage */
  refreshSessions: () => Promise<void>;
  /** Close a single tab */
  closeTab: (tabId: number) => Promise<void>;
  /** Save current tabs as a named session */
  saveSession: (name: string, icon: string) => Promise<void>;
  /** Restore a saved session (opens all its tabs) */
  restoreSession: (sessionId: string) => Promise<void>;
  /** Delete a saved session */
  deleteSession: (sessionId: string) => Promise<void>;
  /** Restore the most recently closed tab */
  undoCloseTab: () => Promise<boolean>;
}

/**
 * Hook that encapsulates all tab-related state and actions.
 * This is the primary hook for the TabGroup, TabCard, and SessionSaver components.
 */
export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetches all tabs from Chrome (all windows) */
  const refreshTabs = useCallback(async (): Promise<TabInfo[]> => {
    try {
      setError(null);
      const allTabs = await tabService.getAllTabs();
      setTabs(allTabs);
      return allTabs;
    } catch (err) {
      setError('Failed to load tabs');
      console.error('Error loading tabs:', err);
      return [];
    }
  }, []);

  /** Fetches window metadata + the current (attached) window id */
  const refreshWindows = useCallback(async (): Promise<void> => {
    try {
      const [winList, current] = await Promise.all([
        tabService.getWindows(),
        browser.windows.getCurrent().catch(() => null),
      ]);
      setWindows(winList);
      if (current?.id != null && current.id > 0) {
        setCurrentWindowId(current.id);
      }
    } catch (err) {
      console.error('Error loading windows:', err);
    }
  }, []);

  /** Fetches all saved sessions from storage */
  const refreshSessions = useCallback(async () => {
    try {
      const allSessions = await tabService.getSessions();
      setSessions(allSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }, []);

  /** Closes a tab and refreshes the list */
  const handleCloseTab = useCallback(
    async (tabId: number) => {
      try {
        await tabService.closeTab(tabId);
        await refreshTabs();
      } catch (err) {
        setError('Failed to close tab');
        console.error('Error closing tab:', err);
      }
    },
    [refreshTabs],
  );

  /** Saves current tabs as a named session */
  const handleSaveSession = useCallback(
    async (name: string, icon: string) => {
      try {
        const currentTabs = await tabService.getCurrentWindowTabs();
        await tabService.saveSession(name, currentTabs, icon);
        await refreshSessions();
      } catch (err) {
        setError('Failed to save session');
        console.error('Error saving session:', err);
      }
    },
    [refreshSessions],
  );

  /** Restores a saved session */
  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      try {
        await tabService.restoreSession(sessionId);
        await refreshTabs();
      } catch (err) {
        setError('Failed to restore session');
        console.error('Error restoring session:', err);
      }
    },
    [refreshTabs],
  );

  /** Deletes a saved session */
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await tabService.deleteSession(sessionId);
        await refreshSessions();
      } catch (err) {
        setError('Failed to delete session');
        console.error('Error deleting session:', err);
      }
    },
    [refreshSessions],
  );

  /** Restores the most recently closed tab */
  const handleUndoClose = useCallback(async (): Promise<boolean> => {
    try {
      const restored = await tabService.restoreLastClosedTab();
      if (restored) await refreshTabs();
      return restored;
    } catch (err) {
      console.error('Error restoring closed tab:', err);
      return false;
    }
  }, [refreshTabs]);

  /* ------------------------------------------------------------
   * LIVE DATA — subscribe to the Chrome tab/window event streams.
   * Any change outside the popup (new tab, closed tab, new window,
   * navigation, focus change) re-queries the browser immediately.
   * ------------------------------------------------------------ */
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshAll = (): void => {
      void refreshTabs();
      void refreshWindows();
    };
    const refreshTabsOnly = (): void => {
      void refreshTabs();
    };
    // tabs.onUpdated fires for every status/title/favicon change — debounce it.
    const refreshDebounced = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refreshTabsOnly();
      }, TAB_UPDATE_DEBOUNCE_MS);
    };
    // A focus change may reorder which window is "current" for the popup.
    const onFocusChanged = (_windowId: number): void => {
      void refreshWindows();
      refreshTabsOnly();
    };

    browser.tabs.onCreated.addListener(refreshAll);
    browser.tabs.onRemoved.addListener(refreshAll);
    browser.tabs.onMoved.addListener(refreshTabsOnly);
    browser.tabs.onActivated.addListener(refreshTabsOnly);
    browser.tabs.onAttached.addListener(refreshAll);
    browser.tabs.onDetached.addListener(refreshAll);
    browser.tabs.onReplaced.addListener(refreshTabsOnly);
    browser.tabs.onUpdated.addListener(refreshDebounced);
    browser.windows.onRemoved.addListener(refreshAll);
    browser.windows.onFocusChanged.addListener(onFocusChanged);

    return (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      browser.tabs.onCreated.removeListener(refreshAll);
      browser.tabs.onRemoved.removeListener(refreshAll);
      browser.tabs.onMoved.removeListener(refreshTabsOnly);
      browser.tabs.onActivated.removeListener(refreshTabsOnly);
      browser.tabs.onAttached.removeListener(refreshAll);
      browser.tabs.onDetached.removeListener(refreshAll);
      browser.tabs.onReplaced.removeListener(refreshTabsOnly);
      browser.tabs.onUpdated.removeListener(refreshDebounced);
      browser.windows.onRemoved.removeListener(refreshAll);
      browser.windows.onFocusChanged.removeListener(onFocusChanged);
    };
  }, [refreshTabs, refreshWindows]);

  // Load tabs, windows, and sessions on mount
  useEffect(() => {
    const init = async (): Promise<void> => {
      setIsLoading(true);
      await Promise.all([refreshTabs(), refreshWindows(), refreshSessions()]);
      setIsLoading(false);
    };
    init();
  }, [refreshTabs, refreshWindows, refreshSessions]);

  return {
    tabs,
    sessions,
    windows,
    currentWindowId,
    isLoading,
    error,
    refreshTabs,
    refreshWindows,
    refreshSessions,
    closeTab: handleCloseTab,
    saveSession: handleSaveSession,
    restoreSession: handleRestoreSession,
    deleteSession: handleDeleteSession,
    undoCloseTab: handleUndoClose,
  };
}
