/**
 * DistractionBlocker component — manages the blocked sites list.
 * Users can add/remove sites that should be blocked during focus mode.
 *
 * ADHD design principles:
 * - Pre-populated with common distracting sites
 * - Simple add/remove interactions
 * - Visual feedback when blocker is active
 * - "Distractions avoided" counter for dopamine hits
 */

import React, { useState } from 'react';
import type { BlockedSite } from '../types';

/** Props for the DistractionBlocker component */
interface DistractionBlockerProps {
  /** All blocked sites */
  sites: BlockedSite[];
  /** Whether the blocker is currently active */
  isActive: boolean;
  /** Number of distractions blocked today */
  blockedCount: number;
  /** Callback to add a site */
  onAddSite: (domain: string) => void;
  /** Callback to remove a site */
  onRemoveSite: (domain: string) => void;
  /** Callback to toggle blocker active state */
  onToggleActive: () => void;
}

/**
 * Renders the distraction blocker interface.
 * Shows the blocked sites list with add/remove controls
 * and the "distractions avoided" counter.
 */
export const DistractionBlocker: React.FC<DistractionBlockerProps> = ({
  sites,
  isActive,
  blockedCount,
  onAddSite,
  onRemoveSite,
  onToggleActive,
}) => {
  /** Input value for adding new sites */
  const [newSite, setNewSite] = useState('');
  /** Whether to show the full list (collapsed by default for minimalism) */
  const [showFullList, setShowFullList] = useState(false);

  /** Handles adding a new site */
  const handleAdd = (): void => {
    if (!newSite.trim()) return;
    onAddSite(newSite.trim());
    setNewSite('');
  };

  /** Shows first 5 sites when collapsed, all when expanded */
  const visibleSites = showFullList ? sites : sites.slice(0, 5);
  const hasMore = sites.length > 5;

  return (
    <div className="distraction-blocker">
      {/* Blocker toggle with status */}
      <div className="distraction-blocker__header">
        <div className="distraction-blocker__status">
          <span
            className={`distraction-blocker__dot ${
              isActive ? 'distraction-blocker__dot--active' : ''
            }`}
          />
          <span className="distraction-blocker__label">Blocker {isActive ? 'Active' : 'Off'}</span>
        </div>

        {/* Toggle switch */}
        <button
          className={`toggle-switch ${isActive ? 'toggle-switch--active' : ''}`}
          onClick={onToggleActive}
          aria-label={isActive ? 'Disable blocker' : 'Enable blocker'}
        >
          <span className="toggle-switch__thumb" />
        </button>
      </div>

      {/* Distractions avoided counter — the dopamine hit! */}
      {blockedCount > 0 && (
        <div className="distraction-blocker__counter card-enter">
          <span className="distraction-blocker__counter-icon">🛡️</span>
          <span className="distraction-blocker__counter-value">{blockedCount}</span>
          <span className="distraction-blocker__counter-label">
            distraction{blockedCount !== 1 ? 's' : ''} avoided today
          </span>
        </div>
      )}

      {/* Add new site input */}
      <div className="distraction-blocker__add">
        <input
          type="text"
          className="distraction-blocker__input"
          placeholder="Add site to block..."
          value={newSite}
          onChange={(e) => setNewSite(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          className="btn btn--primary btn--small"
          onClick={handleAdd}
          disabled={!newSite.trim()}
        >
          + Add
        </button>
      </div>

      {/* Blocked sites list */}
      <div className="distraction-blocker__list">
        {visibleSites.map((site, index) => (
          <div
            key={site.domain}
            className="blocked-site card-enter"
            style={{ animationDelay: `${index * 20}ms` }}
          >
            <span className="blocked-site__domain">🚫 {site.domain}</span>
            <button
              className="blocked-site__remove"
              onClick={() => onRemoveSite(site.domain)}
              aria-label={`Remove ${site.domain} from blocked list`}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Show more/less toggle */}
        {hasMore && (
          <button
            className="btn btn--text btn--small"
            onClick={() => setShowFullList(!showFullList)}
          >
            {showFullList ? 'Show less' : `Show all ${sites.length} sites`}
          </button>
        )}
      </div>
    </div>
  );
};
