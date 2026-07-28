/**
 * useTimer hook — manages the Pomodoro timer state and actions.
 * Handles starting, pausing, resuming, and resetting the timer.
 * Communicates with the background worker for persistent timing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerState, TimerSettings } from '../types';
import * as timerService from '../services/timerService';
import { createDefaultTimerState } from '../utils/helpers';

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
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Loads initial state from storage */
  useEffect(() => {
    const init = async (): Promise<void> => {
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

  /** Sets up a local tick interval when the timer is running */
  useEffect(() => {
    if (state.isRunning && state.remainingSeconds > 0) {
      tickRef.current = setInterval(async () => {
        const newState = await timerService.tickTimer();
        setState(newState);

        // Check if timer completed
        if (newState.remainingSeconds <= 0 && !newState.isRunning) {
          // Play a gentle completion sound
          playCompletionSound();

          // If it was a work phase, record the pomodoro
          if (state.phase === 'work') {
            const stats = await timerService.recordPomodoroComplete();
            setPomodoroCount(stats.count);
            setStreak(stats.streak);
          }

          // Transition to next phase
          const nextState = await timerService.transitionToNextPhase(state);
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
    const newState = await timerService.startWorkPhase();
    setState(newState);
  }, []);

  /** Pauses the timer */
  const pause = useCallback(async () => {
    const newState = await timerService.pauseTimer();
    setState(newState);
  }, []);

  /** Resumes the timer */
  const resume = useCallback(async () => {
    const newState = await timerService.resumeTimer();
    setState(newState);
  }, []);

  /** Resets the timer to idle */
  const reset = useCallback(async () => {
    const newState = await timerService.resetTimer();
    setState(newState);
  }, []);

  /** Skips to the next phase */
  const skipPhase = useCallback(async () => {
    const nextState = await timerService.transitionToNextPhase(state);
    setState(nextState);
  }, [state]);

  /** Updates timer settings */
  const updateSettings = useCallback(async (newSettings: TimerSettings) => {
    await timerService.saveTimerSettings(newSettings);
    setSettings(newSettings);
  }, []);

  return {
    state,
    settings,
    pomodoroCount,
    streak,
    isLoading,
    startWork,
    pause,
    resume,
    reset,
    skipPhase,
    updateSettings,
  };
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
