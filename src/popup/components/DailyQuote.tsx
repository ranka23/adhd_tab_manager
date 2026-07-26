/**
 * DailyQuote component — displays a motivational quote and daily stats.
 * Provides encouragement and progress tracking for ADHD users.
 *
 * ADHD design principles:
 * - Calming, supportive messages (not preachy)
 * - Visual progress indicators
 * - Celebrates small wins
 * - Minimal text — icons and numbers
 */

import React, { useState, useEffect } from 'react';
import type { DailyStats } from '../types';
import { getTimeGreeting } from '../utils/helpers';
import { MOTIVATIONAL_QUOTES } from '../utils/constants';

/** Props for the DailyQuote component */
interface DailyQuoteProps {
  /** Today's stats for the summary */
  stats: DailyStats;
}

/**
 * Displays a rotating motivational quote and daily progress summary.
 * The quote changes every 30 seconds to keep things fresh without being distracting.
 */
export const DailyQuote: React.FC<DailyQuoteProps> = ({ stats }) => {
  /** Current quote index for rotation */
  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length),
  );

  // Rotate quotes every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /** Calculate total focus time in hours and minutes */
  const focusHours = Math.floor(stats.focusMinutes / 60);
  const focusMins = stats.focusMinutes % 60;
  const focusTimeString =
    focusHours > 0
      ? `${focusHours}h ${focusMins}m`
      : `${focusMins}m`;

  return (
    <div className="daily-quote">
      {/* Greeting and quote */}
      <div className="daily-quote__content">
        <p className="daily-quote__greeting">{getTimeGreeting()}! 👋</p>
        <p className="daily-quote__text">
          {MOTIVATIONAL_QUOTES[quoteIndex]}
        </p>
      </div>

      {/* Daily progress summary — visual stats */}
      <div className="daily-quote__stats">
        {/* Focus time */}
        {stats.focusMinutes > 0 && (
          <div className="daily-quote__stat">
            <span className="daily-quote__stat-icon">⏱️</span>
            <span className="daily-quote__stat-value">{focusTimeString}</span>
            <span className="daily-quote__stat-label">focused</span>
          </div>
        )}

        {/* Pomodoros completed */}
        {stats.pomodorosCompleted > 0 && (
          <div className="daily-quote__stat">
            <span className="daily-quote__stat-icon">🍅</span>
            <span className="daily-quote__stat-value">
              {stats.pomodorosCompleted}
            </span>
            <span className="daily-quote__stat-label">pomodoros</span>
          </div>
        )}

        {/* Distractions blocked */}
        {stats.distractionsBlocked > 0 && (
          <div className="daily-quote__stat">
            <span className="daily-quote__stat-icon">🛡️</span>
            <span className="daily-quote__stat-value">
              {stats.distractionsBlocked}
            </span>
            <span className="daily-quote__stat-label">blocked</span>
          </div>
        )}

        {/* Streak */}
        {stats.currentStreak > 0 && (
          <div className="daily-quote__stat daily-quote__stat--highlight">
            <span className="daily-quote__stat-icon fire-pulse">🔥</span>
            <span className="daily-quote__stat-value">
              {stats.currentStreak}
            </span>
            <span className="daily-quote__stat-label">streak</span>
          </div>
        )}
      </div>

      {/* Encouraging message based on activity */}
      <p className="daily-quote__encouragement">
        {stats.focusMinutes === 0 && stats.pomodorosCompleted === 0
          ? 'Ready to make today count? 🌟'
          : stats.focusMinutes > 60
            ? `You've been focused for ${focusTimeString} today. Amazing work! 🎯`
            : stats.pomodorosCompleted >= 4
              ? `${stats.pomodorosCompleted} pomodoros done! You're on fire! 🔥`
              : stats.distractionsBlocked > 5
                ? `${stats.distractionsBlocked} distractions blocked! Strong willpower! 💪`
                : 'Every minute counts. Keep going! 🌱'}
      </p>
    </div>
  );
};
