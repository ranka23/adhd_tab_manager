/**
 * Tests for the DailyQuote component.
 * Covers the greeting, rotating quote, stats display, and encouragement messages.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyQuote } from '../../src/popup/components/DailyQuote';
import { MOTIVATIONAL_QUOTES } from '../../src/popup/utils/constants';
import type { DailyStats } from '../../src/popup/types';

/** Builds a DailyStats fixture with zeroed defaults. */
const makeStats = (overrides: Partial<DailyStats> = {}): DailyStats => ({
  focusMinutes: overrides.focusMinutes ?? 0,
  pomodorosCompleted: overrides.pomodorosCompleted ?? 0,
  distractionsBlocked: overrides.distractionsBlocked ?? 0,
  sessionsSaved: overrides.sessionsSaved ?? 0,
  currentStreak: overrides.currentStreak ?? 0,
});

describe('DailyQuote', () => {
  it('renders a time-based greeting and a Tao Te Ching quote with attribution', () => {
    const { container } = render(<DailyQuote stats={makeStats()} />);
    expect(screen.getByText(/^Good (morning|afternoon|evening)! 👋$/)).toBeInTheDocument();
    const quoteEl = container.querySelector('.daily-quote__text');
    expect(quoteEl).toBeInTheDocument();
    expect(MOTIVATIONAL_QUOTES.some((q) => q.text === quoteEl?.textContent)).toBe(true);
    // The source line must cite the Tao Te Ching chapter and verse.
    const sourceEl = container.querySelector('.daily-quote__source');
    expect(sourceEl).toBeInTheDocument();
    expect(sourceEl?.textContent).toMatch(/Tao Te Ching, Ch\. \d+, v\. \d+/);
    // The cited chapter/verse must match the quote actually shown.
    const shown = MOTIVATIONAL_QUOTES.find((q) => q.text === quoteEl?.textContent);
    expect(sourceEl?.textContent).toContain(`Ch. ${shown?.chapter}`);
    expect(sourceEl?.textContent).toContain(`v. ${shown?.verse}`);
  });

  it('every quote carries a real chapter and verse', () => {
    for (const q of MOTIVATIONAL_QUOTES) {
      expect(q.chapter).toBeGreaterThanOrEqual(1);
      expect(q.chapter).toBeLessThanOrEqual(81);
      expect(q.verse).toBeGreaterThanOrEqual(1);
      expect(q.text.length).toBeGreaterThan(10);
    }
  });

  it('renders focus time as hours and minutes with its label', () => {
    render(<DailyQuote stats={makeStats({ focusMinutes: 65 })} />);
    expect(screen.getByText('1h 5m')).toBeInTheDocument();
    expect(screen.getByText('focused')).toBeInTheDocument();
  });

  it('hides all stats when they are zero', () => {
    render(<DailyQuote stats={makeStats()} />);
    expect(screen.queryByText('focused')).not.toBeInTheDocument();
    expect(screen.queryByText('pomodoros')).not.toBeInTheDocument();
    expect(screen.queryByText('blocked')).not.toBeInTheDocument();
    expect(screen.queryByText('streak')).not.toBeInTheDocument();
  });

  it('renders pomodoro, blocked, and streak stats when present', () => {
    render(
      <DailyQuote
        stats={makeStats({ pomodorosCompleted: 3, distractionsBlocked: 7, currentStreak: 2 })}
      />,
    );
    expect(screen.getByText('pomodoros')).toBeInTheDocument();
    expect(screen.getByText('blocked')).toBeInTheDocument();
    expect(screen.getByText('streak')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the ready-to-start encouragement when there is no activity yet', () => {
    render(<DailyQuote stats={makeStats()} />);
    expect(screen.getByText('Ready to make today count? 🌟')).toBeInTheDocument();
  });

  it('shows focused, pomodoro, and blocked encouragement messages', () => {
    const { rerender } = render(<DailyQuote stats={makeStats({ focusMinutes: 65 })} />);
    expect(
      screen.getByText("You've been focused for 1h 5m today. Amazing work! 🎯"),
    ).toBeInTheDocument();

    rerender(<DailyQuote stats={makeStats({ pomodorosCompleted: 4 })} />);
    expect(screen.getByText("4 pomodoros done! You're on fire! 🔥")).toBeInTheDocument();

    // Note: the "blocked" message only shows once some focus/pomodoro activity
    // exists, because the "Ready to make today count?" branch takes precedence.
    rerender(<DailyQuote stats={makeStats({ focusMinutes: 30, distractionsBlocked: 6 })} />);
    expect(
      screen.getByText('6 distractions blocked! Strong willpower! 💪'),
    ).toBeInTheDocument();
  });
});
