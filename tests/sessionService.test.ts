/**
 * Tests for the session service.
 * Covers auto-save, focus time tracking, and daily stats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorage } from './setup';
import { STORAGE_KEYS } from '../src/shared/constants';

describe('Session Service', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  describe('autoSaveTabs', () => {
    it('should save tabs to storage', async () => {
      // Arrange
      const { autoSaveTabs, getAutoSaveHistory } =
        await import('../src/popup/services/sessionService');
      const mockTabs = [
        {
          id: 1,
          url: 'https://a.com',
          title: 'A',
          favIconUrl: undefined,
          active: true,
          pinned: false,
          windowId: 1,
          index: 0,
        },
      ];

      // Act
      await autoSaveTabs(mockTabs);

      // Assert
      const history = await getAutoSaveHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.tabCount).toBe(1);
      expect(history[0]?.tabs[0]?.url).toBe('https://a.com');
    });

    it('should maintain rolling history of auto-saves', async () => {
      // Arrange
      const { autoSaveTabs, getAutoSaveHistory } =
        await import('../src/popup/services/sessionService');
      const tab1 = [
        {
          id: 1,
          url: 'https://a.com',
          title: 'A',
          favIconUrl: undefined,
          active: false,
          pinned: false,
          windowId: 1,
          index: 0,
        },
      ];
      const tab2 = [
        {
          id: 2,
          url: 'https://b.com',
          title: 'B',
          favIconUrl: undefined,
          active: false,
          pinned: false,
          windowId: 1,
          index: 0,
        },
      ];

      // Act
      await autoSaveTabs(tab1);
      await autoSaveTabs(tab2);

      // Assert
      const history = await getAutoSaveHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('addFocusMinutes', () => {
    it('should add focus minutes to the total', async () => {
      // Act
      const { addFocusMinutes } =
        await import('../src/popup/services/sessionService');
      const total = await addFocusMinutes(30);

      // Assert
      expect(total).toBe(30);

      // Add more
      const total2 = await addFocusMinutes(15);
      expect(total2).toBe(45);
    });
  });

  describe('incrementDistractionsBlocked', () => {
    it('should increment the blocked count', async () => {
      // Act
      const { incrementDistractionsBlocked } =
        await import('../src/popup/services/sessionService');

      const count1 = await incrementDistractionsBlocked();
      expect(count1).toBe(1);

      const count2 = await incrementDistractionsBlocked();
      expect(count2).toBe(2);

      const count3 = await incrementDistractionsBlocked();
      expect(count3).toBe(3);
    });
  });

  describe('getDailyStats', () => {
    it('should return zeroed stats when nothing is stored', async () => {
      // Act
      const { getDailyStats } = await import('../src/popup/services/sessionService');
      const stats = await getDailyStats();

      // Assert
      expect(stats.focusMinutes).toBe(0);
      expect(stats.pomodorosCompleted).toBe(0);
      expect(stats.distractionsBlocked).toBe(0);
      expect(stats.currentStreak).toBe(0);
    });

    it('should aggregate stats from storage', async () => {
      // Arrange
      const { addFocusMinutes, incrementDistractionsBlocked } =
        await import('../src/popup/services/sessionService');
      await addFocusMinutes(45);
      await incrementDistractionsBlocked();
      await incrementDistractionsBlocked();
      await incrementDistractionsBlocked();

      // Also set pomodoro stats directly in storage
      const { mocks: setupMocks } = await import('./setup');
      await setupMocks.storage.set({
        [STORAGE_KEYS.TODAY_POMODOROS]: 5,
        [STORAGE_KEYS.POMODORO_STREAK]: 3,
        [STORAGE_KEYS.SESSIONS_SAVED_TODAY]: 2,
      });

      // Act
      const { getDailyStats } = await import('../src/popup/services/sessionService');
      const stats = await getDailyStats();

      // Assert
      expect(stats.focusMinutes).toBe(45);
      expect(stats.distractionsBlocked).toBe(3);
      expect(stats.pomodorosCompleted).toBe(5);
      expect(stats.currentStreak).toBe(3);
      expect(stats.sessionsSaved).toBe(2);
    });
  });
});
