/**
 * FocusStats component — shows focus mode statistics.
 * Displays when focus mode is active, showing elapsed time,
 * tab count, and encouraging messages.
 *
 * ADHD design: minimal, calming, one piece of info at a time.
 */

import React, { useState, useEffect } from 'react';

/** Props for the FocusStats component */
interface FocusStatsProps {
  /** Timestamp when focus mode started */
  startedAt: number;
  /** Number of tabs that were open when focus started */
  tabCount: number;
}

/**
 * Renders a small stats widget shown during focus mode.
 * Updates in real-time to show elapsed focus time.
 */
export const FocusStats: React.FC<FocusStatsProps> = ({ startedAt, tabCount }) => {
  /** Elapsed minutes since focus started */
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Update elapsed time every 30 seconds
  useEffect(() => {
    const updateElapsed = (): void => {
      const minutes = Math.floor((Date.now() - startedAt) / 60000);
      setElapsedMinutes(minutes);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [startedAt]);

  /** Get a progress-based message */
  const getProgressMessage = (): string => {
    if (elapsedMinutes < 1) return 'Getting started...';
    if (elapsedMinutes < 5) return 'Building momentum 🌱';
    if (elapsedMinutes < 15) return 'Finding your flow 🌊';
    if (elapsedMinutes < 30) return 'Deep work zone 🔥';
    if (elapsedMinutes < 60) return 'Incredible focus! ⭐';
    return 'Legendary session! 🏆';
  };

  return (
    <div className="focus-stats">
      <div className="focus-stats__item">
        <span className="focus-stats__label">Tabs managed</span>
        <span className="focus-stats__value">{tabCount}</span>
      </div>
      <div className="focus-stats__divider" />
      <div className="focus-stats__item">
        <span className="focus-stats__label">Status</span>
        <span className="focus-stats__value focus-stats__value--message">
          {getProgressMessage()}
        </span>
      </div>
    </div>
  );
};
