/**
 * EndOfDaySummary component — shows a summary of today's achievements.
 * Appears at the end of the day or when focus mode ends.
 * Designed to celebrate wins and provide closure for ADHD brains.
 *
 * ADHD design principles:
 * - Visual, not text-heavy
 * - Celebrates ALL progress (not just big wins)
 * - Provides a sense of completion
 * - Calming colors and gentle animations
 */

import React from 'react';
import type { DailyStats } from '../types';
import { formatTime } from '../utils/helpers';

/** Props for the EndOfDaySummary component */
interface EndOfDaySummaryProps {
  /** Today's accumulated stats */
  stats: DailyStats;
  /** Callback to dismiss the summary */
  onDismiss: () => void;
}

/**
 * Renders a beautiful end-of-day summary with today's achievements.
 * Shows focus time, pomodoros completed, distractions blocked, and streak.
 */
export const EndOfDaySummary: React.FC<EndOfDaySummaryProps> = ({ stats, onDismiss }) => {
  /** Convert focus minutes to display format */
  const focusSeconds = stats.focusMinutes * 60;
  const focusDisplay = formatTime(focusSeconds);

  /** Calculate total achievements */
  const totalAchievements =
    stats.pomodorosCompleted +
    Math.floor(stats.focusMinutes / 15) +
    stats.distractionsBlocked;

  return (
    <div className="end-of-day card-enter">
      {/* Header with celebration */}
      <div className="end-of-day__header">
        <span className="end-of-day__icon">🌟</span>
        <h3 className="end-of-day__title">Today's Progress</h3>
      </div>

      {/* Stats grid */}
      <div className="end-of-day__stats">
        {/* Focus time */}
        <div className="end-of-day__stat end-of-day__stat--primary">
          <span className="end-of-day__stat-icon">⏱️</span>
          <span className="end-of-day__stat-value">{focusDisplay}</span>
          <span className="end-of-day__stat-label">Focus Time</span>
        </div>

        {/* Pomodoros */}
        <div className="end-of-day__stat">
          <span className="end-of-day__stat-icon">🍅</span>
          <span className="end-of-day__stat-value">{stats.pomodorosCompleted}</span>
          <span className="end-of-day__stat-label">Pomodoros</span>
        </div>

        {/* Distractions blocked */}
        <div className="end-of-day__stat">
          <span className="end-of-day__stat-icon">🛡️</span>
          <span className="end-of-day__stat-value">{stats.distractionsBlocked}</span>
          <span className="end-of-day__stat-label">Blocked</span>
        </div>

        {/* Streak */}
        {stats.currentStreak > 0 && (
          <div className="end-of-day__stat end-of-day__stat--highlight">
            <span className="end-of-day__stat-icon fire-pulse">🔥</span>
            <span className="end-of-day__stat-value">{stats.currentStreak}</span>
            <span className="end-of-day__stat-label">Streak</span>
          </div>
        )}
      </div>

      {/* Encouraging message */}
      <p className="end-of-day__message">
        {totalAchievements === 0
          ? 'Every journey starts with a single step. Tomorrow is a new day! 🌱'
          : totalAchievements < 5
            ? 'You made progress today. That matters! 💙'
            : totalAchievements < 15
              ? 'Great work today! Your focus is paying off. 🎯'
              : 'Incredible day! You crushed it! 🏆'}
      </p>

      {/* Dismiss button */}
      <button className="btn btn--primary" onClick={onDismiss}>
        Got it! 👍
      </button>
    </div>
  );
};
