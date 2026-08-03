/**
 * Helper utility functions used throughout the extension.
 * These are pure functions with no side effects, making them easy to test.
 */

import type { TabInfo, TabSession, DailyStats, WindowInfo } from '../types';

/**
 * Generates a unique ID using a combination of timestamp and random characters.
 * Used for session IDs and other unique identifiers.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

/**
 * Formats a timestamp into a human-readable date string.
 * Uses short format like "Jul 15, 2:30 PM" for display in cards.
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a number of seconds into MM:SS or HH:MM:SS format.
 * Used by the Pomodoro timer display.
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Converts a Chrome tab object into our simplified TabInfo format.
 * This strips away unnecessary Chrome API properties and keeps only what we need.
 */
export function chromeTabToTabInfo(tab: chrome.tabs.Tab): TabInfo | null {
  // Tabs without a URL (like chrome:// pages) can't be managed
  if (!tab.url || !tab.id) return null;

  return {
    id: tab.id,
    url: tab.url,
    title: tab.title ?? 'Untitled',
    favIconUrl: tab.favIconUrl,
    active: tab.active ?? false,
    pinned: tab.pinned ?? false,
    windowId: tab.windowId ?? 0,
    index: tab.index ?? 0,
  };
}

/**
 * Extracts the domain from a URL string.
 * Used for matching blocked sites against tab URLs.
 * Returns the hostname without the "www." prefix.
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove "www." prefix for consistent matching
    return hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, return the raw string
    return url;
  }
}

/**
 * Calculates progress as a percentage (0-100).
 * Used for timer rings, focus tracking, etc.
 */
export function calculateProgress(elapsed: number, total: number): number {
  if (total <= 0) return 0;
  const progress = Math.max(0, Math.min(1, elapsed / total));
  return Math.round(progress * 100);
}

/**
 * Creates a default Pomodoro timer state.
 * Timer starts in idle phase, ready for the user to begin.
 */
export function createDefaultTimerState(): {
  phase: 'idle';
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  completedInCycle: number;
  startedAt: null;
  pausedAt: null;
} {
  return {
    phase: 'idle',
    isRunning: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    completedInCycle: 0,
    startedAt: null,
    pausedAt: null,
  };
}

/**
 * Calculates a greeting message based on the time of day.
 * Used by the DailyQuote component to personalize the experience.
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Truncates a string to a maximum length and adds "..." if truncated.
 * Used for displaying long tab titles in the UI.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Creates a default daily stats object with zeroed values.
 */
export function createDefaultDailyStats(): DailyStats {
  return {
    focusMinutes: 0,
    pomodorosCompleted: 0,
    distractionsBlocked: 0,
    sessionsSaved: 0,
    currentStreak: 0,
  };
}

/**
 * Sorts tabs by their position in the window (by index).
 * Used when displaying tabs in the TabGroup and TabCard components.
 */
export function sortTabsByIndex(tabs: TabInfo[]): TabInfo[] {
  return [...tabs].sort((a, b) => a.index - b.index);
}

/**
 * Groups tabs by their window ID, sorting each group by tab index.
 * Used to render separate window sections in the Tabs view when the user has
 * more than one window open.
 */
export function groupTabsByWindow(tabs: TabInfo[]): Map<number, TabInfo[]> {
  const grouped = new Map<number, TabInfo[]>();
  for (const tab of tabs) {
    const list = grouped.get(tab.windowId) ?? [];
    list.push(tab);
    grouped.set(tab.windowId, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.index - b.index);
  }
  return grouped;
}

/**
 * Computes a human-friendly label for a window ("Window 1", "Window 2", …).
 * Windows are numbered by ascending window ID so the ordering is stable for
 * the lifetime of the browser session.
 */
export function getWindowLabel(windowId: number, windows: WindowInfo[]): string {
  if (windows.length === 0) return `Window ${windowId}`;
  const sorted = [...windows].sort((a, b) => a.id - b.id);
  const index = sorted.findIndex((w) => w.id === windowId);
  return index >= 0 ? `Window ${index + 1}` : `Window ${windowId}`;
}

/**
 * Creates a new TabSession with default values and the provided data.
 */
export function createSession(name: string, tabs: TabInfo[], icon: string = '📋'): TabSession {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    tabs,
    icon,
  };
}

/**
 * Calculates how many minutes ago a timestamp was.
 * Used for relative time displays like "5 min ago".
 */
export function minutesAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60));
}
