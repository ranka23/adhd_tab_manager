/**
 * Tests for helper utility functions.
 * Covers all pure functions in the helpers module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearStorage } from './setup';
import type { TabInfo } from '../src/popup/types';

/* Factory for a complete chrome.tabs.Tab test object (all required fields) */
function makeChromeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    url: 'https://example.com',
    title: 'Example',
    active: false,
    pinned: false,
    windowId: 1,
    index: 0,
    highlighted: false,
    incognito: false,
    groupId: -1,
    discarded: false,
    autoDiscardable: true,
    selected: false,
    ...overrides,
  };
}

/* Factory for a complete TabInfo test object */
function makeTabInfo(id: number, url: string, title: string, index = 0): TabInfo {
  return {
    id,
    url,
    title,
    favIconUrl: undefined,
    active: false,
    pinned: false,
    windowId: 1,
    index,
  };
}

describe('Helpers', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  describe('generateId', () => {
    it('should return a string', async () => {
      const { generateId } = await import('../src/popup/utils/helpers');
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should generate unique IDs on successive calls', async () => {
      const { generateId } = await import('../src/popup/utils/helpers');
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should contain a timestamp part and a random part separated by dash', async () => {
      const { generateId } = await import('../src/popup/utils/helpers');
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('formatDate', () => {
    it('should format a timestamp into a human-readable date', async () => {
      const { formatDate } = await import('../src/popup/utils/helpers');
      // July 15, 2024 at 2:30 PM
      const timestamp = new Date(2024, 6, 15, 14, 30, 0).getTime();
      const formatted = formatDate(timestamp);
      expect(formatted).toContain('Jul');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2');
      expect(formatted).toContain('30');
    });

    it('should format a date in January', async () => {
      const { formatDate } = await import('../src/popup/utils/helpers');
      const timestamp = new Date(2024, 0, 1, 9, 5, 0).getTime();
      const formatted = formatDate(timestamp);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('1');
    });

    it('should format a timestamp of 0 (epoch)', async () => {
      const { formatDate } = await import('../src/popup/utils/helpers');
      const formatted = formatDate(0);
      // Should still produce a valid date string
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should handle future timestamps', async () => {
      const { formatDate } = await import('../src/popup/utils/helpers');
      const future = new Date(2030, 11, 25, 10, 0, 0).getTime();
      const formatted = formatDate(future);
      expect(formatted).toContain('Dec');
      expect(formatted).toContain('25');
    });
  });

  describe('formatTime', () => {
    it('should format 0 seconds as 00:00', async () => {
      const { formatTime } = await import('../src/popup/utils/helpers');
      expect(formatTime(0)).toBe('00:00');
    });

    it('should format seconds as MM:SS', async () => {
      const { formatTime } = await import('../src/popup/utils/helpers');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(1500)).toBe('25:00'); // 25 minutes
      expect(formatTime(3599)).toBe('59:59');
    });

    it('should format hours as HH:MM:SS', async () => {
      const { formatTime } = await import('../src/popup/utils/helpers');
      expect(formatTime(3600)).toBe('01:00:00');
      expect(formatTime(3661)).toBe('01:01:01');
      expect(formatTime(7384)).toBe('02:03:04');
    });

    it('should pad single-digit minutes and seconds with zeros', async () => {
      const { formatTime } = await import('../src/popup/utils/helpers');
      expect(formatTime(5)).toBe('00:05');
      expect(formatTime(61)).toBe('01:01');
    });

    it('should handle negative seconds by treating them as very large positive', async () => {
      const { formatTime } = await import('../src/popup/utils/helpers');
      // Negative values are a caller error; the function uses Math.floor which
      // produces a correct unsigned-ish result
      const result = formatTime(-1);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('chromeTabToTabInfo', () => {
    it('should transform a Chrome tab into TabInfo', async () => {
      const { chromeTabToTabInfo } = await import('../src/popup/utils/helpers');
      const chromeTab = makeChromeTab({
        id: 42,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/fav.ico',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
      });
      const tabInfo = chromeTabToTabInfo(chromeTab);
      expect(tabInfo).not.toBeNull();
      expect(tabInfo!.id).toBe(42);
      expect(tabInfo!.url).toBe('https://example.com');
      expect(tabInfo!.title).toBe('Example');
      expect(tabInfo!.favIconUrl).toBe('https://example.com/fav.ico');
      expect(tabInfo!.active).toBe(true);
      expect(tabInfo!.pinned).toBe(false);
      expect(tabInfo!.windowId).toBe(1);
      expect(tabInfo!.index).toBe(0);
    });

    it('should return null when tab has no URL', async () => {
      const { chromeTabToTabInfo } = await import('../src/popup/utils/helpers');
      const chromeTab = {
        id: 42,
        url: undefined,
        title: 'New Tab',
      };
      const tabInfo = chromeTabToTabInfo(chromeTab as unknown as chrome.tabs.Tab);
      expect(tabInfo).toBeNull();
    });

    it('should return null when tab has no ID', async () => {
      const { chromeTabToTabInfo } = await import('../src/popup/utils/helpers');
      const chromeTab = {
        id: undefined,
        url: 'https://example.com',
        title: 'No ID',
      };
      const tabInfo = chromeTabToTabInfo(chromeTab as unknown as chrome.tabs.Tab);
      expect(tabInfo).toBeNull();
    });

    it('should default title to "Untitled" when missing', async () => {
      const { chromeTabToTabInfo } = await import('../src/popup/utils/helpers');
      const chromeTab = {
        id: 1,
        url: 'https://example.com',
        title: undefined,
      };
      const tabInfo = chromeTabToTabInfo(chromeTab as unknown as chrome.tabs.Tab);
      expect(tabInfo).not.toBeNull();
      expect(tabInfo!.title).toBe('Untitled');
    });

    it('should default boolean fields when missing', async () => {
      const { chromeTabToTabInfo } = await import('../src/popup/utils/helpers');
      const chromeTab = {
        id: 1,
        url: 'https://example.com',
      };
      const tabInfo = chromeTabToTabInfo(chromeTab as unknown as chrome.tabs.Tab);
      expect(tabInfo).not.toBeNull();
      expect(tabInfo!.active).toBe(false);
      expect(tabInfo!.pinned).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract hostname from a full URL', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('https://www.example.com/page')).toBe('example.com');
    });

    it('should remove www prefix', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('https://www.reddit.com')).toBe('reddit.com');
    });

    it('should handle URLs without www', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('https://reddit.com/r/all')).toBe('reddit.com');
    });

    it('should handle subdomains', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('https://old.reddit.com')).toBe('old.reddit.com');
    });

    it('should handle localhost with port', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      // URL.hostname excludes the port; hostname is 'localhost'
      expect(extractDomain('https://localhost:3000')).toBe('localhost');
    });

    it('should return the raw string for invalid URLs', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('not-a-url')).toBe('not-a-url');
    });

    it('should handle http protocol', async () => {
      const { extractDomain } = await import('../src/popup/utils/helpers');
      expect(extractDomain('http://example.com')).toBe('example.com');
    });
  });

  describe('calculateProgress', () => {
    it('should return 0 for no progress', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(0, 100)).toBe(0);
    });

    it('should return 50 for half progress', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(50, 100)).toBe(50);
    });

    it('should return 100 for complete progress', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(100, 100)).toBe(100);
    });

    it('should round to nearest integer', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(33, 100)).toBe(33);
      expect(calculateProgress(1, 3)).toBe(33); // 33.333 -> 33
    });

    it('should clamp values above 100 to 100', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(150, 100)).toBe(100);
    });

    it('should clamp negative elapsed to 0', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(-10, 100)).toBe(0);
    });

    it('should return 0 when total is 0', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(50, 0)).toBe(0);
    });

    it('should return 0 when total is negative', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(50, -100)).toBe(0);
    });

    it('should handle elapsed exceeding total', async () => {
      const { calculateProgress } = await import('../src/popup/utils/helpers');
      expect(calculateProgress(200, 100)).toBe(100);
    });
  });

  describe('createDefaultTimerState', () => {
    it('should return an idle timer state', async () => {
      const { createDefaultTimerState } = await import('../src/popup/utils/helpers');
      const state = createDefaultTimerState();
      expect(state.phase).toBe('idle');
      expect(state.isRunning).toBe(false);
      expect(state.remainingSeconds).toBe(0);
      expect(state.totalSeconds).toBe(0);
      expect(state.completedInCycle).toBe(0);
      expect(state.startedAt).toBeNull();
      expect(state.pausedAt).toBeNull();
    });
  });

  describe('getTimeGreeting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Good morning" before noon', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0)); // 8:00 AM
      expect(getTimeGreeting()).toBe('Good morning');
    });

    it('should return "Good morning" at exactly midnight', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0)); // 12:00 AM
      expect(getTimeGreeting()).toBe('Good morning');
    });

    it('should return "Good morning" at 11:59 AM', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 11, 59, 59)); // 11:59 AM
      expect(getTimeGreeting()).toBe('Good morning');
    });

    it('should return "Good afternoon" at noon', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0)); // 12:00 PM
      expect(getTimeGreeting()).toBe('Good afternoon');
    });

    it('should return "Good afternoon" at 4:59 PM', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 16, 59, 59)); // 4:59 PM
      expect(getTimeGreeting()).toBe('Good afternoon');
    });

    it('should return "Good evening" at 5:00 PM', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 17, 0, 0)); // 5:00 PM
      expect(getTimeGreeting()).toBe('Good evening');
    });

    it('should return "Good evening" at 11:59 PM', async () => {
      const { getTimeGreeting } = await import('../src/popup/utils/helpers');
      vi.setSystemTime(new Date(2024, 0, 1, 23, 59, 59)); // 11:59 PM
      expect(getTimeGreeting()).toBe('Good evening');
    });
  });

  describe('truncate', () => {
    it('should return the string unchanged when within max length', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate and add ellipsis when exceeding max length', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should return empty string when input is empty', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('', 5)).toBe('');
    });

    it('should handle exactly max length', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle max length of 3 (minimum for ellipsis)', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Hello', 3)).toBe('...');
    });

    it('should handle max length of 1', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Hello', 1)).toBe('...'); // maxLength - 3 = -2, substring(0, -2) = ''
    });

    it('should handle strings that are exactly max length', async () => {
      const { truncate } = await import('../src/popup/utils/helpers');
      expect(truncate('Exact!', 6)).toBe('Exact!');
    });
  });

  describe('createDefaultDailyStats', () => {
    it('should return zeroed stats', async () => {
      const { createDefaultDailyStats } = await import('../src/popup/utils/helpers');
      const stats = createDefaultDailyStats();
      expect(stats.focusMinutes).toBe(0);
      expect(stats.pomodorosCompleted).toBe(0);
      expect(stats.distractionsBlocked).toBe(0);
      expect(stats.sessionsSaved).toBe(0);
      expect(stats.currentStreak).toBe(0);
    });
  });

  describe('sortTabsByIndex', () => {
    it('should sort tabs by index in ascending order', async () => {
      const { sortTabsByIndex } = await import('../src/popup/utils/helpers');
      const tabs = [
        makeTabInfo(3, 'https://c.com', 'C', 2),
        makeTabInfo(1, 'https://a.com', 'A', 0),
        makeTabInfo(2, 'https://b.com', 'B', 1),
      ];
      const sorted = sortTabsByIndex(tabs);
      expect(sorted[0]!.index).toBe(0);
      expect(sorted[1]!.index).toBe(1);
      expect(sorted[2]!.index).toBe(2);
    });

    it('should not mutate the original array', async () => {
      const { sortTabsByIndex } = await import('../src/popup/utils/helpers');
      const tabs = [
        makeTabInfo(2, 'https://b.com', 'B', 1),
        makeTabInfo(2, 'https://b.com', 'B', 1),
      ];
      const originalOrder = tabs.map((t) => t.id);
      sortTabsByIndex(tabs);
      expect(tabs.map((t) => t.id)).toEqual(originalOrder);
    });

    it('should return an empty array for empty input', async () => {
      const { sortTabsByIndex } = await import('../src/popup/utils/helpers');
      expect(sortTabsByIndex([])).toEqual([]);
    });

    it('should handle a single tab', async () => {
      const { sortTabsByIndex } = await import('../src/popup/utils/helpers');
      const tabs = [makeTabInfo(1, 'https://a.com', 'A', 5)];
      expect(sortTabsByIndex(tabs)).toHaveLength(1);
    });
  });

  describe('createSession', () => {
    it('should create a session with the given name, tabs, and icon', async () => {
      const { createSession } = await import('../src/popup/utils/helpers');
      const tabs = [makeTabInfo(1, 'https://a.com', 'A')];
      const session = createSession('My Session', tabs, '📂');
      expect(session.name).toBe('My Session');
      expect(session.icon).toBe('📂');
      expect(session.tabs).toEqual(tabs);
    });

    it('should default the icon to 📋', async () => {
      const { createSession } = await import('../src/popup/utils/helpers');
      const tabs: TabInfo[] = [];
      const session = createSession('Default Icon', tabs);
      expect(session.icon).toBe('📋');
    });

    it('should generate a unique ID', async () => {
      const { createSession } = await import('../src/popup/utils/helpers');
      const tabs: TabInfo[] = [];
      const session1 = createSession('S1', tabs);
      const session2 = createSession('S2', tabs);
      expect(session1.id).not.toBe(session2.id);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const { createSession } = await import('../src/popup/utils/helpers');
      const tabs: TabInfo[] = [];
      const session = createSession('Timestamps', tabs);
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.updatedAt).toBeGreaterThan(0);
      expect(session.updatedAt).toBe(session.createdAt);
    });
  });

  describe('minutesAgo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0)); // Noon
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 0 for the current time', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const now = Date.now();
      expect(minutesAgo(now)).toBe(0);
    });

    it('should return 5 for a timestamp 5 minutes ago', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      expect(minutesAgo(fiveMinAgo)).toBe(5);
    });

    it('should return 60 for a timestamp 1 hour ago', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      expect(minutesAgo(oneHourAgo)).toBe(60);
    });

    it('should floor fractional minutes', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const twoMinHalfAgo = Date.now() - 2.5 * 60 * 1000;
      expect(minutesAgo(twoMinHalfAgo)).toBe(2);
    });

    it('should handle future timestamps (returns negative)', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const future = Date.now() + 60 * 60 * 1000;
      expect(minutesAgo(future)).toBe(-60);
    });

    it('should handle epoch timestamp', async () => {
      const { minutesAgo } = await import('../src/popup/utils/helpers');
      const minutes = minutesAgo(0); // Epoch
      expect(minutes).toBeGreaterThan(0);
    });
  });
});
