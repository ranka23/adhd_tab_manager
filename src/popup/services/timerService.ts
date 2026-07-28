/**
 * Timer service — manages the Pomodoro timer logic.
 * Handles state calculations, phase transitions, and timer persistence.
 * The actual ticking is done by the background service worker via chrome.alarms.
 */

import type { TimerState, TimerSettings, TimerPhase } from '../types';
import { DEFAULT_TIMER, STORAGE_KEYS } from '../../shared/constants';
import { createDefaultTimerState } from '../utils/helpers';

/**
 * Gets the current timer state from storage.
 * Returns the default state if nothing is stored.
 */
export async function getTimerState(): Promise<TimerState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_TIMER);
  const stored = result[STORAGE_KEYS.ACTIVE_TIMER] as TimerState | undefined;
  return stored ?? createDefaultTimerState();
}

/**
 * Saves the timer state to storage.
 */
export async function saveTimerState(state: TimerState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: state });
}

/**
 * Gets the user's timer settings, falling back to defaults.
 */
export async function getTimerSettings(): Promise<TimerSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TIMER_SETTINGS);
  const stored = result[STORAGE_KEYS.TIMER_SETTINGS] as TimerSettings | undefined;
  return (
    stored ?? {
      workMinutes: DEFAULT_TIMER.WORK_MINUTES,
      shortBreakMinutes: DEFAULT_TIMER.SHORT_BREAK_MINUTES,
      longBreakMinutes: DEFAULT_TIMER.LONG_BREAK_MINUTES,
      pomodorosBeforeLongBreak: DEFAULT_TIMER.POMODOROS_BEFORE_LONG_BREAK,
    }
  );
}

/**
 * Saves custom timer settings.
 */
export async function saveTimerSettings(settings: TimerSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER_SETTINGS]: settings });
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
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TODAY_POMODOROS,
    STORAGE_KEYS.POMODORO_STREAK,
  ]);

  const currentCount = (result[STORAGE_KEYS.TODAY_POMODOROS] as number | undefined) ?? 0;
  const currentStreak = (result[STORAGE_KEYS.POMODORO_STREAK] as number | undefined) ?? 0;

  const newCount = currentCount + 1;
  const newStreak = currentStreak + 1;

  await chrome.storage.local.set({
    [STORAGE_KEYS.TODAY_POMODOROS]: newCount,
    [STORAGE_KEYS.POMODORO_STREAK]: newStreak,
  });

  return { count: newCount, streak: newStreak };
}

/**
 * Gets today's completed pomodoro count and current streak.
 */
export async function getPomodoroStats(): Promise<{ count: number; streak: number }> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TODAY_POMODOROS,
    STORAGE_KEYS.POMODORO_STREAK,
  ]);

  return {
    count: (result[STORAGE_KEYS.TODAY_POMODOROS] as number | undefined) ?? 0,
    streak: (result[STORAGE_KEYS.POMODORO_STREAK] as number | undefined) ?? 0,
  };
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
