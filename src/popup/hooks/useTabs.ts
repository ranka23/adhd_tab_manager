/**
 * useTabs hook — manages tab state and tab-related actions in the popup.
 * Provides a clean interface for components to interact with tabs.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TabInfo, TabSession } from '../types';
import * as tabService from '../services/tabService';

/** Return type for the useTabs hook */
interface UseTabsReturn {
  /** All currently open tabs */
  tabs: TabInfo[];
  /** All saved sessions */
  sessions: TabSession[];
  /** Whether tabs are currently loading */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Refresh the tab list from Chrome. Returns the loaded tabs. */
  refreshTabs: () => Promise<TabInfo[]>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetches all tabs from the current window */
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

  // Load tabs and sessions on mount
  useEffect(() => {
    const init = async (): Promise<void> => {
      setIsLoading(true);
      await Promise.all([refreshTabs(), refreshSessions()]);
      setIsLoading(false);
    };
    init();
  }, [refreshTabs, refreshSessions]);

  return {
    tabs,
    sessions,
    isLoading,
    error,
    refreshTabs,
    refreshSessions,
    closeTab: handleCloseTab,
    saveSession: handleSaveSession,
    restoreSession: handleRestoreSession,
    deleteSession: handleDeleteSession,
    undoCloseTab: handleUndoClose,
  };
}
