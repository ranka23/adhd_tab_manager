/**
 * FocusMode component — the main focus mode view.
 * When active, shows a calming screen with elapsed time and "End Focus" button.
 * When inactive, shows the "Start Focus" entry point.
 *
 * Designed specifically for ADHD users:
 * - ONE clear action at a time
 * - Calming colors and minimal text
 * - Gentle animations
 */

import React, { useState, useEffect } from 'react';


/** Props for the FocusMode component */
interface FocusModeProps {
  /** Whether focus mode is currently active */
  isActive: boolean;
  /** Timestamp when focus mode started */
  startedAt: number | null;
  /** Callback to start focus mode */
  onStart: () => void;
  /** Callback to end focus mode */
  onEnd: () => void;
}

/**
 * Displays the focus mode interface.
 * When active, shows a calming, distraction-free screen.
 * When inactive, shows a single "Start Focus" button.
 */
export const FocusMode: React.FC<FocusModeProps> = ({
  isActive,
  startedAt,
  onStart,
  onEnd,
}) => {
  /** Elapsed time in seconds since focus mode started */
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second when focus mode is active
  useEffect(() => {
    if (!isActive || !startedAt) {
      setElapsed(0);
      return;
    }

    const updateElapsed = (): void => {
      const now = Date.now();
      const diff = Math.floor((now - startedAt) / 1000);
      setElapsed(diff);
    };

    // Initial update
    updateElapsed();

    // Set interval for ongoing updates
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  /** Formats elapsed seconds into HH:MM:SS */
  const formatElapsed = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  // When focus mode is active, show the calming focus screen
  if (isActive) {
    return (
      <div className="focus-mode focus-mode--active">
        {/* Calming background gradient */}
        <div className="focus-mode__glow" />

        {/* Main focus display */}
        <div className="focus-mode__content">
          {/* Gentle animated icon */}
          <div className="focus-mode__icon pulse-animation">🎯</div>

          {/* Status text — short and encouraging */}
          <p className="focus-mode__status">You're focused</p>

          {/* Elapsed time — big, readable */}
          <div className="focus-mode__timer">{formatElapsed(elapsed)}</div>

          {/* Encouraging message */}
          <p className="focus-mode__message">
            {elapsed < 300
              ? 'Settling in...'
              : elapsed < 1800
                ? 'Great work, keep going!'
                : elapsed < 3600
                  ? 'You\'re in the zone! 🌟'
                  : 'Incredible focus session! 🔥'}
          </p>
        </div>

        {/* Single action: End Focus — clearly visible but not intrusive */}
        <button className="focus-mode__end-btn" onClick={onEnd}>
          End Focus
        </button>
      </div>
    );
  }

  // When inactive, show the start button
  return (
    <div className="focus-mode focus-mode--inactive">
      <button className="focus-mode__start-btn" onClick={onStart}>
        <span className="focus-mode__start-icon">🧘</span>
        <span className="focus-mode__start-text">Start Focus</span>
        <span className="focus-mode__start-hint">
          Close distractions &amp; focus on what matters
        </span>
      </button>
    </div>
  );
};
