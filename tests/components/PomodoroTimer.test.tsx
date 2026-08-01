/**
 * Tests for the PomodoroTimer component.
 * Covers phase display, running/paused/finished states, stats, and callbacks.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PomodoroTimer } from '../../src/popup/components/PomodoroTimer';
import type { TimerState, TimerSettings } from '../../src/popup/types';

/** Builds a TimerState fixture with an idle default. */
const makeState = (overrides: Partial<TimerState> = {}): TimerState => ({
  phase: overrides.phase ?? 'idle',
  isRunning: overrides.isRunning ?? false,
  remainingSeconds: overrides.remainingSeconds ?? 0,
  totalSeconds: overrides.totalSeconds ?? 0,
  completedInCycle: overrides.completedInCycle ?? 0,
  startedAt: overrides.startedAt ?? null,
  pausedAt: overrides.pausedAt ?? null,
});

/** Builds a TimerSettings fixture. */
const makeSettings = (overrides: Partial<TimerSettings> = {}): TimerSettings => ({
  workMinutes: overrides.workMinutes ?? 25,
  shortBreakMinutes: overrides.shortBreakMinutes ?? 5,
  longBreakMinutes: overrides.longBreakMinutes ?? 15,
  pomodorosBeforeLongBreak: overrides.pomodorosBeforeLongBreak ?? 4,
});

/** Local mirror of the component's props (interface is not exported). */
interface PomodoroTimerProps {
  state: TimerState;
  settings: TimerSettings;
  pomodoroCount: number;
  streak: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  onUpdateSettings: (settings: TimerSettings) => void;
}

/** Renders PomodoroTimer with defaults and returns the props used. */
const renderTimer = (partial: {
  state?: TimerState;
  settings?: TimerSettings;
  pomodoroCount?: number;
  streak?: number;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  onSkip?: () => void;
  onUpdateSettings?: (settings: TimerSettings) => void;
} = {}): { props: PomodoroTimerProps } => {
  const props: PomodoroTimerProps = {
    state: partial.state ?? makeState(),
    settings: partial.settings ?? makeSettings(),
    pomodoroCount: partial.pomodoroCount ?? 0,
    streak: partial.streak ?? 0,
    onStart: partial.onStart ?? vi.fn(),
    onPause: partial.onPause ?? vi.fn(),
    onResume: partial.onResume ?? vi.fn(),
    onReset: partial.onReset ?? vi.fn(),
    onSkip: partial.onSkip ?? vi.fn(),
    onUpdateSettings: partial.onUpdateSettings ?? vi.fn(),
  };
  render(<PomodoroTimer {...props} />);
  return { props };
};

describe('PomodoroTimer', () => {
  it('shows the idle state with a ready label, 25:00, and Start Focus', () => {
    renderTimer();
    expect(screen.getByText('Ready?')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Focus' })).toBeInTheDocument();
    expect(screen.queryByText('Skip →')).not.toBeInTheDocument();
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });

  it('shows the configured work duration in the idle display', () => {
    renderTimer({ settings: makeSettings({ workMinutes: 50 }) });
    expect(screen.getByText('50:00')).toBeInTheDocument();
  });

  it('shows the running work state with formatted time, Pause, and secondary actions', () => {
    renderTimer({
      state: makeState({ phase: 'work', isRunning: true, remainingSeconds: 1499, totalSeconds: 1500 }),
    });
    expect(screen.getByText('Focus Time')).toBeInTheDocument();
    expect(screen.getByText('24:59')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByText('Skip →')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('shows Resume when the timer is paused', () => {
    renderTimer({
      state: makeState({ phase: 'work', isRunning: false, remainingSeconds: 1200, totalSeconds: 1500 }),
    });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('shows Resume with 00:00 once a phase has completed', () => {
    renderTimer({
      state: makeState({ phase: 'work', isRunning: false, remainingSeconds: 0, totalSeconds: 1500 }),
    });
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('shows the correct phase labels for short and long breaks', () => {
    renderTimer({
      state: makeState({ phase: 'shortBreak', isRunning: true, remainingSeconds: 300, totalSeconds: 300 }),
    });
    expect(screen.getByText('Short Break')).toBeInTheDocument();
    renderTimer({
      state: makeState({ phase: 'longBreak', isRunning: true, remainingSeconds: 900, totalSeconds: 900 }),
    });
    expect(screen.getByText('Long Break')).toBeInTheDocument();
  });

  it('shows the pomodoro count and streak when streak is greater than zero', () => {
    renderTimer({ state: makeState(), pomodoroCount: 3, streak: 2 });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(screen.getByText('🔥 2')).toBeInTheDocument();
    expect(screen.getByText('streak')).toBeInTheDocument();
  });

  it('hides the streak stat when streak is zero', () => {
    renderTimer({ state: makeState(), pomodoroCount: 0, streak: 0 });
    expect(screen.queryByText('streak')).not.toBeInTheDocument();
  });

  it('calls onStart when Start Focus is clicked', () => {
    const onStart = vi.fn();
    renderTimer({ state: makeState(), onStart });
    fireEvent.click(screen.getByRole('button', { name: 'Start Focus' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when Pause is clicked while running', () => {
    const onPause = vi.fn();
    renderTimer({ state: makeState({ phase: 'work', isRunning: true }), onPause });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onResume when Resume is clicked while paused', () => {
    const onResume = vi.fn();
    renderTimer({ state: makeState({ phase: 'work', isRunning: false }), onResume });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip and onReset from the secondary actions', () => {
    const onSkip = vi.fn();
    const onReset = vi.fn();
    renderTimer({ state: makeState({ phase: 'work', isRunning: true }), onSkip, onReset });
    fireEvent.click(screen.getByText('Skip →'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Reset'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('opens the settings panel and saves updated settings', () => {
    const onUpdateSettings = vi.fn();
    renderTimer({ onUpdateSettings });
    expect(screen.queryByLabelText('Focus (min)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('⚙️ Settings'));
    fireEvent.change(screen.getByLabelText('Focus (min)'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Break (min)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateSettings).toHaveBeenCalledWith({
      workMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 15,
      pomodorosBeforeLongBreak: 4,
    });
  });

  it('shows a validation error for an out-of-range work duration and does not save', () => {
    const onUpdateSettings = vi.fn();
    renderTimer({ onUpdateSettings });
    fireEvent.click(screen.getByText('⚙️ Settings'));
    fireEvent.change(screen.getByLabelText('Focus (min)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Focus duration must be 1-120 minutes');
    expect(onUpdateSettings).not.toHaveBeenCalled();
  });
});
