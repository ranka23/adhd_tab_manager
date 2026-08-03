/**
 * useTimer hook — manages the Pomodoro timer state and actions.
 * Handles starting, pausing, resuming, and resetting the timer.
 * Communicates with the background worker for persistent timing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerState, TimerSettings } from '../types';
import * as timerService from '../services/timerService';
import { createDefaultTimerState } from '../utils/helpers';
import { STORAGE_KEYS } from '../../shared/constants';
import { browser } from '../../shared/browser';

/** Return type for the useTimer hook */
interface UseTimerReturn {
  /** Current timer state */
  state: TimerState;
  /** User's timer settings */
  settings: TimerSettings;
  /** Today's completed pomodoro count */
  pomodoroCount: number;
  /** Current streak of consecutive pomodoros */
  streak: number;
  /** Whether the timer is loading */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Start a new work phase */
  startWork: () => Promise<void>;
  /** Pause the running timer */
  pause: () => Promise<void>;
  /** Resume a paused timer */
  resume: () => Promise<void>;
  /** Reset the timer to idle */
  reset: () => Promise<void>;
  /** Skip to the next phase */
  skipPhase: () => Promise<void>;
  /** Update timer settings */
  updateSettings: (settings: TimerSettings) => Promise<void>;
}

/**
 * Hook that manages the Pomodoro timer lifecycle.
 * Uses a local interval for ticking when the popup is open,
 * and falls back to chrome.alarms for when the popup is closed.
 */
export function useTimer(): UseTimerReturn {
  const [state, setState] = useState<TimerState>(createDefaultTimerState());
  const [settings, setSettings] = useState<TimerSettings>({
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    pomodorosBeforeLongBreak: 4,
  });
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<TimerState>(state);
  stateRef.current = state;

  /** Loads initial state from storage, restoring session state if available */
  useEffect(() => {
    const init = async (): Promise<void> => {
      // Restore timer from session storage first (survives SW restart)
      await timerService.restoreTimerFromSession();

      const [timerState, timerSettings, stats] = await Promise.all([
        timerService.getTimerState(),
        timerService.getTimerSettings(),
        timerService.getPomodoroStats(),
      ]);
      setState(timerState);
      setSettings(timerSettings);
      setPomodoroCount(stats.count);
      setStreak(stats.streak);
      setIsLoading(false);
    };
    init();
  }, []);

  /* LIVE DATA — mirror timer state + settings from storage so the popup and
   * the side panel (which may be open simultaneously) always show the same
   * countdown. The local ticker writes to storage every second; this listener
   * only mirrors, it never ticks, so there is no double-decrement. */
  useEffect(() => {
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const stateChange = changes[STORAGE_KEYS.ACTIVE_TIMER];
      if (stateChange && stateChange.newValue) {
        setState(stateChange.newValue as TimerState);
      }
      const settingsChange = changes[STORAGE_KEYS.TIMER_SETTINGS];
      if (settingsChange && settingsChange.newValue) {
        setSettings(settingsChange.newValue as TimerSettings);
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    return (): void => {
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  /**
   * Persist timer state to chrome.storage.session when the popup is hidden.
   * This ensures the timer remaining time survives service worker restarts.
   */
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        void timerService.persistTimerToSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /** Sets up a local tick interval when the timer is running */
  useEffect(() => {
    if (state.isRunning && state.remainingSeconds > 0) {
      tickRef.current = setInterval(async () => {
        // If the popup AND the side panel are both open, only the popup may
        // tick — otherwise the timer would run at double speed. The other
        // surface mirrors state via the storage listener below.
        if (!(await shouldOwnTick())) return;

        const newState = await timerService.tickTimer();
        setState(newState);

        // Check if timer completed
        if (newState.remainingSeconds <= 0 && !newState.isRunning) {
          // Play a gentle completion sound
          playCompletionSound();

          // If it was a work phase, record the pomodoro
          if (stateRef.current.phase === 'work') {
            const stats = await timerService.recordPomodoroComplete();
            setPomodoroCount(stats.count);
            setStreak(stats.streak);
          }

          // Transition to next phase
          const nextState = await timerService.transitionToNextPhase(stateRef.current);
          setState(nextState);
        }
      }, 1000);
    }

    return (): void => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state.isRunning, state.phase, state.remainingSeconds]);

  /** Starts a new work phase */
  const startWork = useCallback(async () => {
    try {
      setError(null);
      const newState = await timerService.startWorkPhase();
      setState(newState);
    } catch (err) {
      setError('Failed to start timer');
      console.error('Error starting timer:', err);
      throw err;
    }
  }, []);

  /** Pauses the timer */
  const pause = useCallback(async () => {
    try {
      setError(null);
      const newState = await timerService.pauseTimer();
      setState(newState);
    } catch (err) {
      setError('Failed to pause timer');
      console.error('Error pausing timer:', err);
      throw err;
    }
  }, []);

  /** Resumes the timer */
  const resume = useCallback(async () => {
    try {
      setError(null);
      const newState = await timerService.resumeTimer();
      setState(newState);
    } catch (err) {
      setError('Failed to resume timer');
      console.error('Error resuming timer:', err);
      throw err;
    }
  }, []);

  /** Resets the timer to idle */
  const reset = useCallback(async () => {
    try {
      setError(null);
      const newState = await timerService.resetTimer();
      setState(newState);
    } catch (err) {
      setError('Failed to reset timer');
      console.error('Error resetting timer:', err);
      throw err;
    }
  }, []);

  /** Skips to the next phase */
  const skipPhase = useCallback(async () => {
    try {
      setError(null);
      const nextState = await timerService.transitionToNextPhase(stateRef.current);
      setState(nextState);
    } catch (err) {
      setError('Failed to skip phase');
      console.error('Error skipping phase:', err);
      throw err;
    }
  }, []);

  /** Updates timer settings */
  const updateSettings = useCallback(async (newSettings: TimerSettings) => {
    try {
      setError(null);
      await timerService.saveTimerSettings(newSettings);
      setSettings(newSettings);
    } catch (err) {
      setError('Failed to save timer settings');
      console.error('Error saving timer settings:', err);
      throw err;
    }
  }, []);

  return {
    state,
    settings,
    pomodoroCount,
    streak,
    isLoading,
    error,
    startWork,
    pause,
    resume,
    reset,
    skipPhase,
    updateSettings,
  };
}

/**
 * Whether THIS surface (popup or side panel) should own the local 1-second
 * pomodoro tick. When the popup and side panel are both open at once, both
 * would otherwise decrement the shared timer → double speed. The popup is the
 * primary surface and owns the tick; the side panel mirrors via storage.
 *
 * On Firefox/older Chrome there is no runtime.getContexts, and only one timer
 * surface can exist at a time anyway (no side panel in Firefox), so always true.
 */
async function shouldOwnTick(): Promise<boolean> {
  const runtime = browser.runtime as unknown as {
    getContexts?: (filter: { contextTypes: string[] }) => Promise<Array<{ type?: string }>>;
  };
  if (typeof runtime.getContexts !== 'function') return true;
  try {
    const contexts = await runtime.getContexts({ contextTypes: ['POPUP', 'SIDE_PANEL'] });
    if (contexts.length <= 1) return true;
    const isPopup =
      typeof document !== 'undefined' &&
      (document.URL.includes('/popup/') || document.URL.endsWith('/popup/index.html'));
    return isPopup;
  } catch {
    return true;
  }
}

/**
 * Plays a gentle chime sound when a timer phase completes.
 * Uses the Web Audio API to create a soft, calming tone
 * that won't startle ADHD users.
 */
function playCompletionSound(): void {
  try {
    const audioCtx = new AudioContext();

    // Create a soft, warm chime with two gentle tones
    const playTone = (frequency: number, startTime: number, duration: number): void => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Gentle fade-in and fade-out envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    // A soft two-note chime — like a wind chime
    playTone(523.25, now, 0.4); // C5
    playTone(659.25, now + 0.2, 0.5); // E5
  } catch {
    // Audio API not available — silently fail
  }
}
