/**
 * PomodoroTimer component — beautiful circular timer with SVG ring animation.
 * Displays work/break phases, progress, and pomodoro stats.
 *
 * ADHD design principles:
 * - Large, beautiful timer that's satisfying to watch
 * - Color changes between work (blue) and break (green)
 * - Streak counter with fire emoji for dopamine hits
 * - One clear action: Start/Pause/Resume
 * - Gentle chime sound on completion (via useTimer hook)
 */

import React, { useState } from 'react';
import type { TimerState, TimerSettings } from '../types';
import { formatTime, calculateProgress } from '../utils/helpers';
import { COLORS } from '../utils/constants';

/** Props for the PomodoroTimer component */
interface PomodoroTimerProps {
  /** Current timer state */
  state: TimerState;
  /** Timer settings */
  settings: TimerSettings;
  /** Number of pomodoros completed today */
  pomodoroCount: number;
  /** Current streak of consecutive pomodoros */
  streak: number;
  /** Callback to start a work phase */
  onStart: () => void;
  /** Callback to pause the timer */
  onPause: () => void;
  /** Callback to resume the timer */
  onResume: () => void;
  /** Callback to reset the timer */
  onReset: () => void;
  /** Callback to skip to next phase */
  onSkip: () => void;
  /** Callback to update settings */
  onUpdateSettings: (settings: TimerSettings) => void;
}

/**
 * SVG circle radius for the timer ring.
 * The circumference is calculated from this to determine stroke-dashoffset.
 */
const CIRCLE_RADIUS = 54;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

/**
 * Renders a beautiful circular Pomodoro timer.
 * Uses SVG for the animated ring and React state for the display.
 */
export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  state,
  settings,
  pomodoroCount,
  streak,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
  onUpdateSettings,
}) => {
  /** Whether the settings panel is open */
  const [showSettings, setShowSettings] = useState(false);

  /** Whether we're editing work duration */
  const [workMin, setWorkMin] = useState(settings.workMinutes);
  const [breakMin, setBreakMin] = useState(settings.shortBreakMinutes);
  const [longBreakMin, setLongBreakMin] = useState(settings.longBreakMinutes);

  /** Validation error for timer settings */
  const [settingsError, setSettingsError] = useState<string | null>(null);

  /** Calculate the progress for the SVG ring */
  const progress = calculateProgress(
    state.totalSeconds - state.remainingSeconds,
    state.totalSeconds,
  );

  /** Calculate stroke-dashoffset for the ring animation */
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE - (progress / 100) * CIRCLE_CIRCUMFERENCE;

  /** Determine the ring color based on timer phase */
  const getRingColor = (): string => {
    switch (state.phase) {
      case 'work':
        return COLORS.timerWork;
      case 'shortBreak':
        return COLORS.timerBreak;
      case 'longBreak':
        return COLORS.timerLongBreak;
      default:
        return COLORS.primaryLight;
    }
  };

  /** Get the phase label */
  const getPhaseLabel = (): string => {
    switch (state.phase) {
      case 'work':
        return 'Focus Time';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      default:
        return 'Ready?';
    }
  };

  /** Handle saving settings with validation */
  const handleSaveSettings = (): void => {
    // Validate ranges (Number.isFinite also rejects NaN from non-numeric input)
    if (!Number.isFinite(workMin) || workMin < 1 || workMin > 120) {
      setSettingsError('Focus duration must be 1-120 minutes');
      return;
    }
    if (!Number.isFinite(breakMin) || breakMin < 1 || breakMin > 30) {
      setSettingsError('Break duration must be 1-30 minutes');
      return;
    }
    if (!Number.isFinite(longBreakMin) || longBreakMin < 1 || longBreakMin > 60) {
      setSettingsError('Long break must be 1-60 minutes');
      return;
    }

    setSettingsError(null);
    onUpdateSettings({
      workMinutes: workMin,
      shortBreakMinutes: breakMin,
      longBreakMinutes: longBreakMin,
      pomodorosBeforeLongBreak: settings.pomodorosBeforeLongBreak,
    });
    setShowSettings(false);
  };

  return (
    <div className="pomodoro-timer">
      {/* Phase label */}
      <p className="pomodoro-timer__phase">{getPhaseLabel()}</p>

      {/* SVG circular timer */}
      <div className="pomodoro-timer__ring-container">
        <svg className="pomodoro-timer__ring" viewBox="0 0 120 120" width={160} height={160}>
          {/* Background circle (track) */}
          <circle cx="60" cy="60" r={CIRCLE_RADIUS} fill="none" strokeWidth="6" className="pomodoro-timer__ring-track" />
          {/* Progress circle (animated) */}
          <circle
            cx="60"
            cy="60"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke={getRingColor()}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            className="pomodoro-timer__progress-ring"
          />
        </svg>

        {/* Timer display centered inside the ring */}
        <div className="pomodoro-timer__display">
          <span className="pomodoro-timer__time">
            {state.phase === 'idle'
              ? formatTime(settings.workMinutes * 60)
              : formatTime(state.remainingSeconds)}
          </span>
        </div>
      </div>

      {/* Stats row — pomodoro count and streak */}
      <div className="pomodoro-timer__stats">
        <div className="pomodoro-timer__stat">
          <span className="pomodoro-timer__stat-value">{pomodoroCount}</span>
          <span className="pomodoro-timer__stat-label">today</span>
        </div>
        {streak > 0 && (
          <div className="pomodoro-timer__stat pomodoro-timer__streak">
            <span className="pomodoro-timer__stat-value fire-pulse">🔥 {streak}</span>
            <span className="pomodoro-timer__stat-label">streak</span>
          </div>
        )}
      </div>

      {/* Action buttons — ONE primary action */}
      <div className="pomodoro-timer__actions">
        {state.phase === 'idle' ? (
          /* Start button — the primary action */
          <button className="btn btn--primary btn--large" onClick={onStart}>
            Start Focus
          </button>
        ) : state.isRunning ? (
          /* Pause button */
          <button className="btn btn--secondary" onClick={onPause}>
            Pause
          </button>
        ) : (
          /* Resume button */
          <button className="btn btn--primary" onClick={onResume}>
            Resume
          </button>
        )}

        {/* Skip and Reset — secondary actions, smaller */}
        {state.phase !== 'idle' && (
          <div className="pomodoro-timer__secondary-actions">
            <button className="btn btn--text" onClick={onSkip} title="Skip to next phase">
              Skip →
            </button>
            <button className="btn btn--text" onClick={onReset} title="Reset timer">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Settings toggle */}
      <button className="btn btn--text btn--small" onClick={() => setShowSettings(!showSettings)}>
        ⚙️ Settings
      </button>

      {/* Settings panel — collapsible */}
      {showSettings && (
        <div className="pomodoro-timer__settings card-enter">
          <div className="settings-row">
            <label htmlFor="work-min">Focus (min)</label>
            <input
              id="work-min"
              type="number"
              min={1}
              max={120}
              value={workMin}
              onChange={(e) => setWorkMin(Number(e.target.value))}
            />
          </div>
          <div className="settings-row">
            <label htmlFor="break-min">Break (min)</label>
            <input
              id="break-min"
              type="number"
              min={1}
              max={30}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
            />
          </div>
          <div className="settings-row">
            <label htmlFor="long-break-min">Long Break (min)</label>
            <input
              id="long-break-min"
              type="number"
              min={1}
              max={60}
              value={longBreakMin}
              onChange={(e) => setLongBreakMin(Number(e.target.value))}
            />
          </div>
          {settingsError && (
            <div className="settings-error" role="alert">
              ⚠️ {settingsError}
            </div>
          )}
          <button className="btn btn--primary btn--small" onClick={handleSaveSettings}>
            Save
          </button>
        </div>
      )}
    </div>
  );
};
