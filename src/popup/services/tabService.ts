/**
 * Tab service — handles all Chrome tab-related operations.
 * This service abstracts the Chrome Tabs API and provides clean,
 * Promise-based methods for tab management.
 */

import type { TabInfo, TabSession, ClosedTabRecord } from '../types';
import { chromeTabToTabInfo, createSession } from '../utils/helpers';
import { STORAGE_KEYS, MAX_CLOSED_TABS_HISTORY } from '../../shared/constants';

/**
 * Fetches all tabs across all windows.
 * Returns our simplified TabInfo format instead of raw Chrome tab objects.
 */
export async function getAllTabs(): Promise<TabInfo[]> {
  const chromeTabs = await chrome.tabs.query({});
  return chromeTabs
    .map((tab) => chromeTabToTabInfo(tab))
    .filter((tab): tab is TabInfo => tab !== null);
}

/**
 * Gets tabs for the current active window only.
 * Used for session saving and focus mode.
 */
export async function getCurrentWindowTabs(): Promise<TabInfo[]> {
  const chromeTabs = await chrome.tabs.query({ currentWindow: true });
  return chromeTabs
    .map((tab) => chromeTabToTabInfo(tab))
    .filter((tab): tab is TabInfo => tab !== null);
}

/**
 * Closes a single tab by its Chrome tab ID.
 * Before closing, records it in the closed tabs history for undo functionality.
 */
export async function closeTab(tabId: number): Promise<void> {
  // First, get the tab info before closing it so we can save it for undo
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) {
    const tabInfo = chromeTabToTabInfo(tab);
    if (tabInfo) {
      await recordClosedTab(tabInfo);
    }
  }
  await chrome.tabs.remove(tabId);
}

/**
 * Closes multiple tabs at once.
 * More efficient than calling closeTab in a loop since we batch the remove call.
 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  // Record all tabs for undo before closing
  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab) {
      const tabInfo = chromeTabToTabInfo(tab);
      if (tabInfo) {
        await recordClosedTab(tabInfo);
      }
    }
  }
  await chrome.tabs.remove(tabIds);
}

/**
 * Records a closed tab in the undo history.
 * Maintains a fixed-size circular buffer of recently closed tabs.
 */
async function recordClosedTab(tab: TabInfo): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
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

  await chrome.storage.local.set({ [STORAGE_KEYS.CLOSED_TABS]: trimmed });
}

/**
 * Restores the most recently closed tab (undo-close).
 * Opens the tab at its original position if possible.
 */
export async function restoreLastClosedTab(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
  const closedTabs: ClosedTabRecord[] =
    (result[STORAGE_KEYS.CLOSED_TABS] as ClosedTabRecord[] | undefined) ?? [];

  if (closedTabs.length === 0) return false;

  const record = closedTabs[0]!;
  // Open the tab at the same position
  await chrome.tabs.create({
    url: record.tab.url,
    active: true,
    index: record.originalIndex,
  });

  // Remove from history
  closedTabs.shift();
  await chrome.storage.local.set({ [STORAGE_KEYS.CLOSED_TABS]: closedTabs });
  return true;
}

/**
 * Gets the list of recently closed tabs (for display in UI).
 */
export async function getClosedTabs(): Promise<ClosedTabRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLOSED_TABS);
  return (result[STORAGE_KEYS.CLOSED_TABS] as ClosedTabRecord[] | undefined) ?? [];
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
  const session = createSession(name, tabs, icon);
  const sessions = await getSessions();
  sessions.unshift(session);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  return session;
}

/**
 * Retrieves all saved sessions from storage.
 */
export async function getSessions(): Promise<TabSession[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
  return (result[STORAGE_KEYS.SESSIONS] as TabSession[] | undefined) ?? [];
}

/**
 * Restores a session by opening all its saved tabs.
 * Closes existing non-pinned tabs first (with confirmation from the caller).
 */
export async function restoreSession(sessionId: string): Promise<boolean> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return false;

  // Open all tabs from the session
  for (const tab of session.tabs) {
    await chrome.tabs.create({
      url: tab.url,
      active: false,
      pinned: tab.pinned,
    });
  }
  return true;
}

/**
 * Deletes a saved session from storage.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const sessions = await getSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  if (filtered.length === sessions.length) return false;

  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: filtered });
  return true;
}

/**
 * Renames an existing session.
 */
export async function renameSession(sessionId: string, newName: string): Promise<boolean> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return false;

  session.name = newName;
  session.updatedAt = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  return true;
}
