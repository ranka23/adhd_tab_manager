/**
 * Tests for the timer service.
 * Covers timer state management, phase transitions, and pomodoro tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorage, mocks } from './setup';

describe('Timer Service', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  describe('getTimerState', () => {
    it('should return default state when nothing is stored', async () => {
      // Act
      const { getTimerState } = await import('../src/popup/services/timerService');
      const state = await getTimerState();

      // Assert
      expect(state.phase).toBe('idle');
      expect(state.isRunning).toBe(false);
      expect(state.remainingSeconds).toBe(0);
      expect(state.totalSeconds).toBe(0);
      expect(state.completedInCycle).toBe(0);
    });
  });

  describe('startWorkPhase', () => {
    it('should initialize a work phase with 25 minutes', async () => {
      // Act
      const { startWorkPhase } = await import('../src/popup/services/timerService');
      const state = await startWorkPhase();

      // Assert
      expect(state.phase).toBe('work');
      expect(state.isRunning).toBe(true);
      expect(state.remainingSeconds).toBe(25 * 60); // 25 minutes in seconds
      expect(state.totalSeconds).toBe(25 * 60);
      expect(state.startedAt).toBeDefined();
    });
  });

  describe('tickTimer', () => {
    it('should decrement remaining seconds by 1', async () => {
      // Arrange
      const { startWorkPhase, tickTimer } = await import('../src/popup/services/timerService');
      await startWorkPhase();

      // Act
      const state = await tickTimer();

      // Assert
      expect(state.remainingSeconds).toBe(25 * 60 - 1);
      expect(state.isRunning).toBe(true);
    });

    it('should stop when reaching 0', async () => {
      // Arrange - set up a timer with 1 second remaining
      const { saveTimerState } = await import('../src/popup/services/timerService');
      await saveTimerState({
        phase: 'work',
        isRunning: true,
        remainingSeconds: 1,
        totalSeconds: 25 * 60,
        completedInCycle: 0,
        startedAt: Date.now(),
        pausedAt: null,
      });

      // Act
      const { tickTimer } = await import('../src/popup/services/timerService');
      const state = await tickTimer();

      // Assert
      expect(state.remainingSeconds).toBe(0);
      expect(state.isRunning).toBe(false);
    });

    it('should not tick when paused', async () => {
      // Arrange
      const { saveTimerState } = await import('../src/popup/services/timerService');
      await saveTimerState({
        phase: 'work',
        isRunning: false,
        remainingSeconds: 100,
        totalSeconds: 25 * 60,
        completedInCycle: 0,
        startedAt: Date.now(),
        pausedAt: Date.now(),
      });

      // Act
      const { tickTimer } = await import('../src/popup/services/timerService');
      const state = await tickTimer();

      // Assert
      expect(state.remainingSeconds).toBe(100);
    });
  });

  describe('pauseTimer and resumeTimer', () => {
    it('should pause a running timer', async () => {
      // Arrange
      const { startWorkPhase, pauseTimer } = await import('../src/popup/services/timerService');
      await startWorkPhase();

      // Act
      const state = await pauseTimer();

      // Assert
      expect(state.isRunning).toBe(false);
      expect(state.pausedAt).toBeDefined();
    });

    it('should resume a paused timer', async () => {
      // Arrange
      const { startWorkPhase, pauseTimer, resumeTimer } =
        await import('../src/popup/services/timerService');
      await startWorkPhase();
      await pauseTimer();

      // Act
      const state = await resumeTimer();

      // Assert
      expect(state.isRunning).toBe(true);
      expect(state.pausedAt).toBeNull();
    });
  });

  describe('transitionToNextPhase', () => {
    it('should transition from work to short break', async () => {
      // Arrange
      const { transitionToNextPhase } = await import('../src/popup/services/timerService');
      const currentState = {
        phase: 'work' as const,
        isRunning: false,
        remainingSeconds: 0,
        totalSeconds: 25 * 60,
        completedInCycle: 0,
        startedAt: Date.now(),
        pausedAt: null,
      };

      // Act
      const nextState = await transitionToNextPhase(currentState);

      // Assert
      expect(nextState.phase).toBe('shortBreak');
      expect(nextState.isRunning).toBe(true);
      expect(nextState.completedInCycle).toBe(1);
    });

    it('should transition from work to long break after 4 pomodoros', async () => {
      // Arrange
      const { transitionToNextPhase } = await import('../src/popup/services/timerService');
      const currentState = {
        phase: 'work' as const,
        isRunning: false,
        remainingSeconds: 0,
        totalSeconds: 25 * 60,
        completedInCycle: 3, // After this one, will be 4
        startedAt: Date.now(),
        pausedAt: null,
      };

      // Act
      const nextState = await transitionToNextPhase(currentState);

      // Assert
      expect(nextState.phase).toBe('longBreak');
      expect(nextState.completedInCycle).toBe(4);
    });

    it('should transition from break back to work', async () => {
      // Arrange
      const { transitionToNextPhase } = await import('../src/popup/services/timerService');
      const currentState = {
        phase: 'shortBreak' as const,
        isRunning: false,
        remainingSeconds: 0,
        totalSeconds: 5 * 60,
        completedInCycle: 1,
        startedAt: Date.now(),
        pausedAt: null,
      };

      // Act
      const nextState = await transitionToNextPhase(currentState);

      // Assert
      expect(nextState.phase).toBe('work');
      expect(nextState.isRunning).toBe(true);
    });
  });

  describe('resetTimer', () => {
    it('should reset to idle state', async () => {
      // Arrange
      const { startWorkPhase, resetTimer } = await import('../src/popup/services/timerService');
      await startWorkPhase();

      // Act
      const state = await resetTimer();

      // Assert
      expect(state.phase).toBe('idle');
      expect(state.isRunning).toBe(false);
      expect(state.remainingSeconds).toBe(0);
    });
  });

  describe('recordPomodoroComplete (day-aware streak)', () => {
    const dateStr = (offsetDays: number): string => {
      const d = new Date(Date.now() + offsetDays * 86_400_000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    it('records the first pomodoro ever with a streak of 1', async () => {
      const { recordPomodoroComplete } = await import('../src/popup/services/timerService');
      const result = await recordPomodoroComplete();
      expect(result).toEqual({ count: 1, streak: 1 });

      const stored = await mocks.storage.get([
        'adhd_today_pomodoros',
        'adhd_pomodoro_streak',
        'adhd_last_pomodoro_date',
      ]);
      expect(stored.adhd_last_pomodoro_date).toBe(dateStr(0));
    });

    it('increments the streak when the last completion was yesterday', async () => {
      const { seedStorage } = await import('./setup');
      await seedStorage({
        adhd_today_pomodoros: 2,
        adhd_pomodoro_streak: 2,
        adhd_last_pomodoro_date: dateStr(-1),
      });
      const { recordPomodoroComplete } = await import('../src/popup/services/timerService');
      const result = await recordPomodoroComplete();
      expect(result).toEqual({ count: 3, streak: 3 });
    });

    it('keeps the streak unchanged for a second completion on the same day', async () => {
      const { seedStorage } = await import('./setup');
      await seedStorage({
        adhd_today_pomodoros: 1,
        adhd_pomodoro_streak: 5,
        adhd_last_pomodoro_date: dateStr(0),
      });
      const { recordPomodoroComplete } = await import('../src/popup/services/timerService');
      const result = await recordPomodoroComplete();
      expect(result).toEqual({ count: 2, streak: 5 });
    });

    it('resets the streak to 1 after a missed day', async () => {
      const { seedStorage } = await import('./setup');
      await seedStorage({
        adhd_today_pomodoros: 0,
        adhd_pomodoro_streak: 7,
        adhd_last_pomodoro_date: dateStr(-2),
      });
      const { recordPomodoroComplete } = await import('../src/popup/services/timerService');
      const result = await recordPomodoroComplete();
      expect(result).toEqual({ count: 1, streak: 1 });
    });
  });

  describe('calculateTimerProgress', () => {
    it('should return 0 for no progress', async () => {
      const { calculateTimerProgress } = await import('../src/popup/services/timerService');
      const progress = calculateTimerProgress({
        phase: 'work',
        isRunning: true,
        remainingSeconds: 1500,
        totalSeconds: 1500,
        completedInCycle: 0,
        startedAt: null,
        pausedAt: null,
      });
      expect(progress).toBe(0);
    });

    it('should return 100 for completed', async () => {
      const { calculateTimerProgress } = await import('../src/popup/services/timerService');
      const progress = calculateTimerProgress({
        phase: 'work',
        isRunning: false,
        remainingSeconds: 0,
        totalSeconds: 1500,
        completedInCycle: 0,
        startedAt: null,
        pausedAt: null,
      });
      expect(progress).toBe(100);
    });

    it('should calculate correct mid-progress', async () => {
      const { calculateTimerProgress } = await import('../src/popup/services/timerService');
      const progress = calculateTimerProgress({
        phase: 'work',
        isRunning: true,
        remainingSeconds: 750, // Half of 1500
        totalSeconds: 1500,
        completedInCycle: 0,
        startedAt: null,
        pausedAt: null,
      });
      expect(progress).toBe(50);
    });
  });
});
