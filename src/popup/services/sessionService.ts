/**
 * Session service — manages auto-save, session history, and daily stats.
 * Handles the "Session Saver" feature that automatically backs up tabs
 * and provides undo functionality and daily summaries.
 */

import type { TabInfo, DailyStats } from '../types';
import { STORAGE_KEYS } from '../../shared/constants';
import { browser } from '../../shared/browser';

/**
 * Auto-saves the current tabs to storage.
 * Called by the background worker every 5 minutes via chrome.alarms.
 * Keeps a rolling history of today's auto-saves.
 */
export async function autoSaveTabs(tabs: TabInfo[]): Promise<void> {
  const now = Date.now();

  // Get today's start timestamp (midnight) for filtering
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await browser.storage.local.get(STORAGE_KEYS.AUTO_SAVED_TABS);
  const existing: AutoSaveEntry[] =
    (result[STORAGE_KEYS.AUTO_SAVED_TABS] as AutoSaveEntry[] | undefined) ?? [];

  // Filter to only keep entries from today (rolling 24 hours)
  const recentEntries = existing.filter((entry) => entry.timestamp > todayStart.getTime());

  // Add the new auto-save
  recentEntries.push({
    timestamp: now,
    tabs,
    tabCount: tabs.length,
  });

  // Keep at most 24 entries (one per hour max)
  const trimmed = recentEntries.slice(-24);

  await browser.storage.local.set({
    [STORAGE_KEYS.AUTO_SAVED_TABS]: trimmed,
    [STORAGE_KEYS.LAST_AUTO_SAVE]: now,
  });
}

/**
 * Gets the auto-save history for today.
 * Used by the Session Saver component to show what tabs were open earlier.
 */
export async function getAutoSaveHistory(): Promise<AutoSaveEntry[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.AUTO_SAVED_TABS);
  const entries: AutoSaveEntry[] =
    (result[STORAGE_KEYS.AUTO_SAVED_TABS] as AutoSaveEntry[] | undefined) ?? [];

  // Filter to only today's entries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return entries.filter((entry) => entry.timestamp > todayStart.getTime());
}

/**
 * Gets the most recent auto-save entry.
 */
export async function getLatestAutoSave(): Promise<AutoSaveEntry | null> {
  const history = await getAutoSaveHistory();
  return history.length > 0 ? (history[history.length - 1] ?? null) : null;
}

/**
 * Records focus time in minutes for today.
 * Called when focus mode ends to track daily focus minutes.
 */
export async function addFocusMinutes(minutes: number): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEYS.FOCUS_MINUTES_TODAY);
  const current = (result[STORAGE_KEYS.FOCUS_MINUTES_TODAY] as number | undefined) ?? 0;
  const updated = current + minutes;

  await browser.storage.local.set({ [STORAGE_KEYS.FOCUS_MINUTES_TODAY]: updated });
  return updated;
}

/**
 * Gets today's focus minutes.
 */
export async function getFocusMinutesToday(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEYS.FOCUS_MINUTES_TODAY);
  return (result[STORAGE_KEYS.FOCUS_MINUTES_TODAY] as number | undefined) ?? 0;
}

/**
 * Increments the distractions blocked counter.
 * Each blocked distraction is a small win — track it for motivation!
 */
export async function incrementDistractionsBlocked(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEYS.DISTRACTIONS_BLOCKED);
  const current = (result[STORAGE_KEYS.DISTRACTIONS_BLOCKED] as number | undefined) ?? 0;
  const updated = current + 1;

  await browser.storage.local.set({ [STORAGE_KEYS.DISTRACTIONS_BLOCKED]: updated });
  return updated;
}

/**
 * Gets the number of distractions blocked today.
 */
export async function getDistractionsBlockedToday(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEYS.DISTRACTIONS_BLOCKED);
  return (result[STORAGE_KEYS.DISTRACTIONS_BLOCKED] as number | undefined) ?? 0;
}

/**
 * Compiles all daily stats into a single object.
 * Used by the DailyQuote and QuickStats components.
 */
export async function getDailyStats(): Promise<DailyStats> {
  const [focusMinutes, pomodoroStats, distractionsBlocked, sessionsSaved] = await Promise.all([
    getFocusMinutesToday(),
    (async (): Promise<{ count: number; streak: number }> => {
      const result = await browser.storage.local.get([
        STORAGE_KEYS.TODAY_POMODOROS,
        STORAGE_KEYS.POMODORO_STREAK,
      ]);
      return {
        count: (result[STORAGE_KEYS.TODAY_POMODOROS] as number | undefined) ?? 0,
        streak: (result[STORAGE_KEYS.POMODORO_STREAK] as number | undefined) ?? 0,
      };
    })(),
    getDistractionsBlockedToday(),
    (async (): Promise<number> => {
      const result = await browser.storage.local.get(STORAGE_KEYS.SESSIONS_SAVED_TODAY);
      return (result[STORAGE_KEYS.SESSIONS_SAVED_TODAY] as number | undefined) ?? 0;
    })(),
  ]);

  return {
    focusMinutes,
    pomodorosCompleted: pomodoroStats.count,
    distractionsBlocked,
    sessionsSaved,
    currentStreak: pomodoroStats.streak,
  };
}

/** Shape of an auto-save entry */
interface AutoSaveEntry {
  timestamp: number;
  tabs: TabInfo[];
  tabCount: number;
}
