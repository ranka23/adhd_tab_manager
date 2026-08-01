/**
 * Timer service — manages the Pomodoro timer logic.
 * Handles state calculations, phase transitions, and timer persistence.
 * The actual ticking is done by the background service worker via chrome.alarms.
 *
 * Timer Continuation Across Restarts:
 * Remaining time is persisted to chrome.storage.session on visibility change
 * (document.visibilityState === 'hidden') so that the timer survives service
 * worker restarts. When the popup reopens, stored time is restored.
 */

import type { TimerState, TimerSettings, TimerPhase } from '../types';
import { DEFAULT_TIMER, STORAGE_KEYS } from '../../shared/constants';
import { createDefaultTimerState } from '../utils/helpers';
import { browser } from '../../shared/browser';

/** Key for persisting timer remaining seconds in chrome.storage.session */
const TIMER_SESSION_KEY = 'timer_remaining_seconds';

/**
 * Gets the current timer state from storage.
 * Returns the default state if nothing is stored.
 * First checks chrome.storage.session for mid-restart state.
 */
export async function getTimerState(): Promise<TimerState> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_TIMER);
    const stored = result[STORAGE_KEYS.ACTIVE_TIMER] as TimerState | undefined;

    // If no stored state, check session storage (survives service worker restart)
    if (!stored || !stored.isRunning) {
      const sessionResult = await browser.storage.session.get(TIMER_SESSION_KEY);
      const sessionRemaining = sessionResult[TIMER_SESSION_KEY] as number | undefined;
      if (sessionRemaining !== undefined && stored && stored.remainingSeconds > sessionRemaining) {
        // Restore the session remaining time (it's more recent)
        return { ...stored, remainingSeconds: sessionRemaining };
      }
    }

    return stored ?? createDefaultTimerState();
  } catch (err) {
    console.error('timerService: Failed to get timer state:', err);
    return createDefaultTimerState();
  }
}

/**
 * Saves the timer state to storage.
 * Also persists to chrome.storage.session for restart resilience.
 */
export async function saveTimerState(state: TimerState): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: state });

    // Also persist remaining time to session storage (ephemeral, survives SW restart)
    if (state.isRunning && state.remainingSeconds > 0) {
      await browser.storage.session.set({ [TIMER_SESSION_KEY]: state.remainingSeconds });
    } else {
      // Clear session storage when timer is not running
      await browser.storage.session.remove(TIMER_SESSION_KEY);
    }
  } catch (err) {
    console.error('timerService: Failed to save timer state:', err);
  }
}

/**
 * Persists the current timer remaining seconds to chrome.storage.session.
 * Called on visibility change (when popup is hidden) to capture state
 * before the service worker might be terminated.
 */
export async function persistTimerToSession(): Promise<void> {
  try {
    const state = await getTimerState();
    if (state.isRunning && state.remainingSeconds > 0) {
      await browser.storage.session.set({ [TIMER_SESSION_KEY]: state.remainingSeconds });
    }
  } catch (err) {
    console.error('timerService: Failed to persist timer to session:', err);
  }
}

/**
 * Restores timer remaining time from chrome.storage.session.
 * Called when the popup initializes after a service worker restart.
 */
export async function restoreTimerFromSession(): Promise<void> {
  try {
    const sessionResult = await browser.storage.session.get(TIMER_SESSION_KEY);
    const sessionRemaining = sessionResult[TIMER_SESSION_KEY] as number | undefined;

    if (sessionRemaining === undefined) return;

    const state = await getTimerState();
    if (state.isRunning && state.remainingSeconds > sessionRemaining) {
      // The session value is more recent — update the stored state
      const updatedState = { ...state, remainingSeconds: sessionRemaining };
      await browser.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: updatedState });
      // Clear the session key after restoring
      await browser.storage.session.remove(TIMER_SESSION_KEY);
    }
  } catch (err) {
    console.error('timerService: Failed to restore timer from session:', err);
  }
}

/**
 * Gets the user's timer settings, falling back to defaults.
 */
export async function getTimerSettings(): Promise<TimerSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.TIMER_SETTINGS);
    const stored = result[STORAGE_KEYS.TIMER_SETTINGS] as TimerSettings | undefined;
    return (
      stored ?? {
        workMinutes: DEFAULT_TIMER.WORK_MINUTES,
        shortBreakMinutes: DEFAULT_TIMER.SHORT_BREAK_MINUTES,
        longBreakMinutes: DEFAULT_TIMER.LONG_BREAK_MINUTES,
        pomodorosBeforeLongBreak: DEFAULT_TIMER.POMODOROS_BEFORE_LONG_BREAK,
      }
    );
  } catch (err) {
    console.error('timerService: Error reading timer settings:', err);
    return {
      workMinutes: DEFAULT_TIMER.WORK_MINUTES,
      shortBreakMinutes: DEFAULT_TIMER.SHORT_BREAK_MINUTES,
      longBreakMinutes: DEFAULT_TIMER.LONG_BREAK_MINUTES,
      pomodorosBeforeLongBreak: DEFAULT_TIMER.POMODOROS_BEFORE_LONG_BREAK,
    };
  }
}

/**
 * Saves custom timer settings.
 */
export async function saveTimerSettings(settings: TimerSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.TIMER_SETTINGS]: settings }).catch((err) => {
    console.error('timerService: Failed to save timer settings:', err);
  });
}

/**
 * Starts a new Pomodoro work phase.
 * Initializes the timer with the configured work duration.
 */
export async function startWorkPhase(): Promise<TimerState> {
  const settings = await getTimerSettings();
  const totalSeconds = settings.workMinutes * 60;

  const state: TimerState = {
    phase: 'work',
    isRunning: true,
    remainingSeconds: totalSeconds,
    totalSeconds,
    completedInCycle: 0,
    startedAt: Date.now(),
    pausedAt: null,
  };

  await saveTimerState(state);
  return state;
}

/**
 * Transitions to the next phase (work -> break -> work -> ... -> long break).
 * Automatically determines whether to use short or long break.
 */
export async function transitionToNextPhase(currentState: TimerState): Promise<TimerState> {
  const settings = await getTimerSettings();

  if (currentState.phase === 'work') {
    // After work, determine break type
    const newCycleCount = currentState.completedInCycle + 1;
    const isLongBreak =
      newCycleCount > 0 && newCycleCount % settings.pomodorosBeforeLongBreak === 0;

    const breakMinutes = isLongBreak ? settings.longBreakMinutes : settings.shortBreakMinutes;
    const breakPhase: TimerPhase = isLongBreak ? 'longBreak' : 'shortBreak';
    const totalSeconds = breakMinutes * 60;

    const newState: TimerState = {
      phase: breakPhase,
      isRunning: true,
      remainingSeconds: totalSeconds,
      totalSeconds,
      completedInCycle: newCycleCount,
      startedAt: Date.now(),
      pausedAt: null,
    };

    await saveTimerState(newState);
    return newState;
  }

  // After break, start a new work phase
  const totalSeconds = settings.workMinutes * 60;
  const newState: TimerState = {
    phase: 'work',
    isRunning: true,
    remainingSeconds: totalSeconds,
    totalSeconds,
    completedInCycle: currentState.completedInCycle,
    startedAt: Date.now(),
    pausedAt: null,
  };

  await saveTimerState(newState);
  return newState;
}

/**
 * Ticks the timer by one second.
 * Returns the updated state. If remaining seconds reach 0, the timer stops.
 */
export async function tickTimer(): Promise<TimerState> {
  const state = await getTimerState();
  if (!state.isRunning || state.remainingSeconds <= 0) {
    return state;
  }

  const newRemaining = state.remainingSeconds - 1;
  const updatedState: TimerState = {
    ...state,
    remainingSeconds: newRemaining,
    isRunning: newRemaining > 0,
  };

  await saveTimerState(updatedState);
  return updatedState;
}

/**
 * Pauses the running timer.
 */
export async function pauseTimer(): Promise<TimerState> {
  const state = await getTimerState();
  if (!state.isRunning) return state;

  const pausedState: TimerState = {
    ...state,
    isRunning: false,
    pausedAt: Date.now(),
  };

  await saveTimerState(pausedState);
  return pausedState;
}

/**
 * Resumes a paused timer.
 */
export async function resumeTimer(): Promise<TimerState> {
  const state = await getTimerState();
  if (state.isRunning || state.remainingSeconds <= 0) return state;

  const resumedState: TimerState = {
    ...state,
    isRunning: true,
    pausedAt: null,
    startedAt: state.startedAt ?? Date.now(),
  };

  await saveTimerState(resumedState);
  return resumedState;
}

/**
 * Resets the timer to idle state.
 */
export async function resetTimer(): Promise<TimerState> {
  const state = createDefaultTimerState();
  await saveTimerState(state);
  return state;
}

/**
 * Increments today's pomodoro count and updates the streak.
 */
export async function recordPomodoroComplete(): Promise<{ count: number; streak: number }> {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEYS.TODAY_POMODOROS,
      STORAGE_KEYS.POMODORO_STREAK,
    ]);

    const currentCount = (result[STORAGE_KEYS.TODAY_POMODOROS] as number | undefined) ?? 0;
    const currentStreak = (result[STORAGE_KEYS.POMODORO_STREAK] as number | undefined) ?? 0;

    const newCount = currentCount + 1;
    const newStreak = currentStreak + 1;

    await browser.storage.local.set({
      [STORAGE_KEYS.TODAY_POMODOROS]: newCount,
      [STORAGE_KEYS.POMODORO_STREAK]: newStreak,
    });

    return { count: newCount, streak: newStreak };
  } catch (err) {
    console.error('timerService: Failed to record pomodoro:', err);
    return { count: 0, streak: 0 };
  }
}

/**
 * Gets today's completed pomodoro count and current streak.
 */
export async function getPomodoroStats(): Promise<{ count: number; streak: number }> {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEYS.TODAY_POMODOROS,
      STORAGE_KEYS.POMODORO_STREAK,
    ]);

    return {
      count: (result[STORAGE_KEYS.TODAY_POMODOROS] as number | undefined) ?? 0,
      streak: (result[STORAGE_KEYS.POMODORO_STREAK] as number | undefined) ?? 0,
    };
  } catch (err) {
    console.error('timerService: Failed to get pomodoro stats:', err);
    return { count: 0, streak: 0 };
  }
}

/**
 * Calculates the progress percentage for the current timer phase.
 * Returns a value between 0 and 100.
 */
export function calculateTimerProgress(state: TimerState): number {
  if (state.totalSeconds <= 0) return 0;
  const elapsed = state.totalSeconds - state.remainingSeconds;
  return Math.round((elapsed / state.totalSeconds) * 100);
}
