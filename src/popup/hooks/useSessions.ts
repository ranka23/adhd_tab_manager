/**
 * useSessions hook — manages saved tab sessions (save/restore/delete).
 * Provides session-related state and actions for SessionSaver and TabGroup.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TabSession } from '../types';
import * as tabService from '../services/tabService';

/** Return type for the useSessions hook */
interface UseSessionsReturn {
  /** List of all saved sessions */
  sessions: TabSession[];
  /** Whether sessions are loading */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Refresh sessions from storage */
  refresh: () => Promise<void>;
  /** Save a new session with the given name and icon */
  save: (name: string, icon: string) => Promise<TabSession>;
  /** Restore a session by ID */
  restore: (sessionId: string) => Promise<void>;
  /** Delete a session by ID */
  remove: (sessionId: string) => Promise<void>;
  /** Rename a session */
  rename: (sessionId: string, newName: string) => Promise<void>;
}

/**
 * Hook for managing tab sessions (saved groups of tabs).
 * Sessions persist in chrome.storage.local.
 */
export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetches all sessions from storage */
  const refresh = useCallback(async () => {
    try {
      const allSessions = await tabService.getSessions();
      setSessions(allSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Saves a new session with the current window's tabs */
  const save = useCallback(
    async (name: string, icon: string): Promise<TabSession> => {
      try {
        setError(null);
        const currentTabs = await tabService.getCurrentWindowTabs();
        const session = await tabService.saveSession(name, currentTabs, icon);
        await refresh();
        return session;
      } catch (err) {
        setError('Failed to save session');
        console.error('Error saving session:', err);
        throw err;
      }
    },
    [refresh],
  );

  /** Restores a session by opening all its saved tabs */
  const restore = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      await tabService.restoreSession(sessionId);
    } catch (err) {
      setError('Failed to restore session');
      console.error('Error restoring session:', err);
      throw err;
    }
  }, []);

  /** Deletes a session */
  const remove = useCallback(
    async (sessionId: string) => {
      try {
        setError(null);
        await tabService.deleteSession(sessionId);
        await refresh();
      } catch (err) {
        setError('Failed to delete session');
        console.error('Error deleting session:', err);
        throw err;
      }
    },
    [refresh],
  );

  /** Renames a session */
  const rename = useCallback(
    async (sessionId: string, newName: string) => {
      try {
        setError(null);
        await tabService.renameSession(sessionId, newName);
        await refresh();
      } catch (err) {
        setError('Failed to rename session');
        console.error('Error renaming session:', err);
        throw err;
      }
    },
    [refresh],
  );

  // Load sessions on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    sessions,
    isLoading,
    error,
    refresh,
    save,
    restore,
    remove,
    rename,
  };
}
