/**
 * Tab service — handles all Chrome tab-related operations.
 * This service abstracts the Chrome Tabs API and provides clean,
 * Promise-based methods for tab management.
 */

import type { TabInfo, TabSession, ClosedTabRecord, WindowInfo } from '../types';
import { chromeTabToTabInfo, createSession } from '../utils/helpers';
import { MAX_CLOSED_TABS_HISTORY, MAX_SESSIONS, STORAGE_KEYS } from '../../shared/constants';
import { browser } from '../../shared/browser';

/**
 * Fetches all tabs across all windows.
 * Returns our simplified TabInfo format instead of raw Chrome tab objects.
 */
export async function getAllTabs(): Promise<TabInfo[]> {
  try {
    const chromeTabs = await browser.tabs.query({});
    return chromeTabs
      .map((tab) => chromeTabToTabInfo(tab))
      .filter((tab): tab is TabInfo => tab !== null);
  } catch (err) {
    console.error('tabService: Failed to query all tabs:', err);
    return [];
  }
}

/**
 * Fetches metadata for all open browser windows (no tab population).
 * Used to group the tab list per window and label windows in the UI.
 */
export async function getWindows(): Promise<WindowInfo[]> {
  try {
    const wins = await browser.windows.getAll({ populate: false });
    return wins
      .map((win) => ({
        id: win.id ?? 0,
        focused: win.focused ?? false,
        type: win.type,
      }))
      .filter((win) => win.id > 0)
      .sort((a, b) => a.id - b.id);
  } catch (err) {
    console.error('tabService: Failed to query windows:', err);
    return [];
  }
}

/**
 * Gets tabs for a single window by its window ID.
 * Used for window-specific session saving and per-window close actions.
 */
export async function getWindowTabs(windowId: number): Promise<TabInfo[]> {
  try {
    const chromeTabs = await browser.tabs.query({ windowId });
    return chromeTabs
      .map((tab) => chromeTabToTabInfo(tab))
      .filter((tab): tab is TabInfo => tab !== null);
  } catch (err) {
    console.error('tabService: Failed to query window tabs:', err);
    return [];
  }
}

/**
 * Gets tabs for the current active window only.
 * Used for session saving and focus mode.
 */
export async function getCurrentWindowTabs(): Promise<TabInfo[]> {
  try {
    const chromeTabs = await browser.tabs.query({ currentWindow: true });
    return chromeTabs
      .map((tab) => chromeTabToTabInfo(tab))
      .filter((tab): tab is TabInfo => tab !== null);
  } catch (err) {
    console.error('tabService: Failed to query current window tabs:', err);
    return [];
  }
}

/**
 * Closes a single tab by its Chrome tab ID.
 * Before closing, records it in the closed tabs history for undo functionality.
 */
export async function closeTab(tabId: number): Promise<void> {
  // First, get the tab info before closing it so we can save it for undo
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (tab) {
    const tabInfo = chromeTabToTabInfo(tab);
    if (tabInfo) {
      await recordClosedTab(tabInfo);
    }
  }
  try {
    await browser.tabs.remove(tabId);
  } catch (err) {
    console.error('tabService: Failed to close tab:', err);
  }
}

/**
 * Closes multiple tabs at once.
 * More efficient than calling closeTab in a loop since we batch the remove call.
 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  // Record all tabs for undo before closing
  for (const tabId of tabIds) {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (tab) {
      const tabInfo = chromeTabToTabInfo(tab);
      if (tabInfo) {
        await recordClosedTab(tabInfo);
      }
    }
  }
  try {
    await browser.tabs.remove(tabIds);
  } catch (err) {
    console.error('tabService: Failed to close tabs:', err);
  }
}

/**
 * Records a closed tab in the undo history.
 * Maintains a fixed-size circular buffer of recently closed tabs.
 */
async function recordClosedTab(tab: TabInfo): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
    const closedTabs: ClosedTabRecord[] =
      (result[STORAGE_KEYS.CLOSED_TABS] as ClosedTabRecord[] | undefined) ?? [];

    const record: ClosedTabRecord = {
      tab,
      closedAt: Date.now(),
      originalIndex: tab.index,
    };

    // Add to the beginning and trim to max history size
    closedTabs.unshift(record);
    const trimmed = closedTabs.slice(0, MAX_CLOSED_TABS_HISTORY);

    await browser.storage.local.set({ [STORAGE_KEYS.CLOSED_TABS]: trimmed });
  } catch (err) {
    console.error('tabService: Failed to record closed tab:', err);
  }
}

/**
 * Closes all non-pinned tabs in a single window, recording each for undo.
 * Returns the number of tabs closed.
 */
export async function closeWindowTabs(windowId: number): Promise<number> {
  try {
    const chromeTabs = await browser.tabs.query({ windowId });
    const closable = chromeTabs.filter((tab) => !tab.pinned && tab.id);
    const ids = closable.map((tab) => tab.id as number);
    if (ids.length > 0) {
      await closeTabs(ids);
    }
    return ids.length;
  } catch (err) {
    console.error('tabService: Failed to close window tabs:', err);
    return 0;
  }
}

/**
 * Closes all non-pinned tabs across every open window, recording each for undo.
 * Returns the number of tabs closed.
 */
export async function closeAllNonPinnedTabs(): Promise<number> {
  try {
    const chromeTabs = await browser.tabs.query({});
    const closable = chromeTabs.filter((tab) => !tab.pinned && tab.id);
    const ids = closable.map((tab) => tab.id as number);
    if (ids.length > 0) {
      await closeTabs(ids);
    }
    return ids.length;
  } catch (err) {
    console.error('tabService: Failed to close all tabs:', err);
    return 0;
  }
}

/**
 * Restores the most recently closed tab (undo-close).
 * Opens the tab at its original position if possible.
 */
export async function restoreLastClosedTab(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
    const closedTabs: ClosedTabRecord[] =
      (result[STORAGE_KEYS.CLOSED_TABS] as ClosedTabRecord[] | undefined) ?? [];

    if (closedTabs.length === 0) return false;

    const record = closedTabs[0]!;
    // Validate URL before creating tab
    try {
      new URL(record.tab.url);
    } catch {
      console.error('tabService: Invalid URL for tab restore:', record.tab.url);
      return false;
    }
    // Open the tab at the same position, back in its original window when it
    // still exists (multi-window support) so restores never jump windows.
    try {
      await browser.tabs.create({
        url: record.tab.url,
        active: true,
        index: record.originalIndex,
        windowId: record.tab.windowId,
      });
    } catch {
      // The original window is gone (closed) — fall back to the current window.
      await browser.tabs.create({
        url: record.tab.url,
        active: true,
        index: record.originalIndex,
      });
    }

    // Remove from history
    closedTabs.shift();
    await browser.storage.local.set({ [STORAGE_KEYS.CLOSED_TABS]: closedTabs });
    return true;
  } catch (err) {
    console.error('tabService: Failed to restore last closed tab:', err);
    return false;
  }
}

/**
 * Gets the list of recently closed tabs (for display in UI).
 */
export async function getClosedTabs(): Promise<ClosedTabRecord[]> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
    return (result[STORAGE_KEYS.CLOSED_TABS] as ClosedTabRecord[] | undefined) ?? [];
  } catch (err) {
    console.error('tabService: Failed to get closed tabs:', err);
    return [];
  }
}

/**
 * Saves the current tabs as a named session.
 * This is the core of the Tab Groups / Sessions feature.
 */
export async function saveSession(
  name: string,
  tabs: TabInfo[],
  icon: string = '📋',
): Promise<TabSession> {
  try {
    const session = createSession(name, tabs, icon);
    const sessions = await getSessions();
    sessions.unshift(session);
    // Keep the most recent sessions, bounded to avoid unbounded growth
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS]: trimmed });

    // Track sessions saved for today's stats (same day-rollover pattern as
    // the other daily counters — no midnight reset is performed yet).
    const statsResult = await browser.storage.local.get(STORAGE_KEYS.SESSIONS_SAVED_TODAY);
    const savedToday = (statsResult[STORAGE_KEYS.SESSIONS_SAVED_TODAY] as number | undefined) ?? 0;
    await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS_SAVED_TODAY]: savedToday + 1 });

    return session;
  } catch (err) {
    console.error('tabService: Failed to save session:', err);
    throw err;
  }
}

/**
 * Retrieves all saved sessions from storage.
 */
export async function getSessions(): Promise<TabSession[]> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.SESSIONS);
    return (result[STORAGE_KEYS.SESSIONS] as TabSession[] | undefined) ?? [];
  } catch (err) {
    console.error('tabService: Failed to get sessions:', err);
    return [];
  }
}

/**
 * Restores a session by opening all its saved tabs.
 * Closes existing non-pinned tabs first (with confirmation from the caller).
 */
export async function restoreSession(sessionId: string): Promise<boolean> {
  try {
    const sessions = await getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return false;

    // Open all tabs from the session
    for (const tab of session.tabs) {
      // Validate URL before creating tab
      try {
        new URL(tab.url);
      } catch {
        console.error('tabService: Invalid URL in session, skipping:', tab.url);
        continue;
      }
      try {
        await browser.tabs.create({
          url: tab.url,
          active: false,
          pinned: tab.pinned,
        });
      } catch (err) {
        console.error('tabService: Failed to create tab during session restore:', err);
      }
    }
    return true;
  } catch (err) {
    console.error('tabService: Failed to restore session:', err);
    return false;
  }
}

/**
 * Deletes a saved session from storage.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const sessions = await getSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    if (filtered.length === sessions.length) return false;

    await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS]: filtered });
    return true;
  } catch (err) {
    console.error('tabService: Failed to delete session:', err);
    return false;
  }
}

/**
 * Re-inserts a previously deleted session (undo support).
 * If a session with the same ID already exists, it is replaced in place
 * rather than duplicated.
 */
export async function restoreDeletedSession(session: TabSession): Promise<boolean> {
  try {
    const sessions = await getSessions();
    const without = sessions.filter((s) => s.id !== session.id);
    without.unshift(session);
    await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS]: without });
    return true;
  } catch (err) {
    console.error('tabService: Failed to restore deleted session:', err);
    return false;
  }
}

export async function renameSession(sessionId: string, newName: string): Promise<boolean> {
  try {
    const sessions = await getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return false;

    session.name = newName;
    session.updatedAt = Date.now();
    await browser.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
    return true;
  } catch (err) {
    console.error('tabService: Failed to rename session:', err);
    return false;
  }
}
