/**
 * SessionSaver component — manages saved tab sessions.
 * Allows users to save, restore, and delete sessions.
 * Also shows auto-save history for today.
 *
 * ADHD design principles:
 * - Visual grid of sessions (cards with icons)
 * - One-click restore
 * - Undo-friendly: delete has confirmation
 * - Shows tab count and relative date for context
 */

import React, { useState } from 'react';
import type { TabSession } from '../types';
import { formatDate } from '../utils/helpers';
import { SESSION_ICONS, SESSION_NAME_SUGGESTIONS } from '../utils/constants';

/** Props for the SessionSaver component */
interface SessionSaverProps {
  /** All saved sessions */
  sessions: TabSession[];
  /** Number of currently open tabs (for the save button) */
  openTabCount: number;
  /** Callback to save a new session */
  onSave: (name: string, icon: string) => Promise<TabSession>;
  /** Callback to restore a session */
  onRestore: (sessionId: string) => Promise<void>;
  /** Callback to delete a session */
  onDelete: (sessionId: string) => Promise<void>;
  /** Callback to undo-close the last closed tab */
  onUndoClose: () => Promise<boolean>;
}

/**
 * Renders the session saver interface with a save button, session grid,
 * and undo-close feature.
 */
export const SessionSaver: React.FC<SessionSaverProps> = ({
  sessions,
  openTabCount,
  onSave,
  onRestore,
  onDelete,
  onUndoClose,
}) => {
  /** Whether the save dialog is open */
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  /** Name for the new session being saved */
  const [newSessionName, setNewSessionName] = useState('');
  /** Selected icon for the new session */
  const [selectedIcon, setSelectedIcon] = useState('📋');
  /** Whether a save operation is in progress */
  const [isSaving, setIsSaving] = useState(false);
  /** Session ID pending deletion (for confirmation) */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /** Handles the save action */
  const handleSave = async (): Promise<void> => {
    if (!newSessionName.trim()) return;
    setIsSaving(true);
    try {
      await onSave(newSessionName.trim(), selectedIcon);
      setNewSessionName('');
      setSelectedIcon('📋');
      setShowSaveDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  /** Handles the delete confirmation */
  const handleConfirmDelete = async (sessionId: string): Promise<void> => {
    await onDelete(sessionId);
    setPendingDeleteId(null);
  };

  /** Handles undo-close button click */
  const handleUndoClose = async (): Promise<void> => {
    await onUndoClose();
  };

  return (
    <div className="session-saver">
      {/* Action buttons row */}
      <div className="session-saver__actions">
        {/* Save current tabs as session */}
        <button
          className="btn btn--primary"
          onClick={() => setShowSaveDialog(true)}
          disabled={openTabCount === 0}
        >
          💾 Save Tabs ({openTabCount})
        </button>

        {/* Undo close last tab */}
        <button className="btn btn--secondary" onClick={handleUndoClose}>
          ↩️ Undo Close
        </button>
      </div>

      {/* Save dialog — slides in when "Save Tabs" is clicked */}
      {showSaveDialog && (
        <div className="session-saver__dialog card-enter">
          <h4 className="session-saver__dialog-title">Save Current Tabs</h4>

          {/* Session name input */}
          <input
            type="text"
            className="session-saver__input"
            placeholder="Session name..."
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />

          {/* Quick name suggestions */}
          <div className="session-saver__suggestions">
            {SESSION_NAME_SUGGESTIONS.map((name) => (
              <button
                key={name}
                className="session-saver__suggestion"
                onClick={() => setNewSessionName(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Icon picker */}
          <div className="session-saver__icons">
            {SESSION_ICONS.map((icon) => (
              <button
                key={icon}
                className={`session-saver__icon-btn ${
                  selectedIcon === icon ? 'session-saver__icon-btn--selected' : ''
                }`}
                onClick={() => setSelectedIcon(icon)}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Dialog actions */}
          <div className="session-saver__dialog-actions">
            <button className="btn btn--text" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={!newSessionName.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Sessions grid */}
      <div className="session-saver__grid">
        {sessions.length === 0 ? (
          <div className="session-saver__empty">
            <p className="session-saver__empty-icon">📋</p>
            <p className="session-saver__empty-text">
              No saved sessions yet.
              <br />
              Save your tabs to pick up later!
            </p>
          </div>
        ) : (
          sessions.map((session, index) => (
            <div
              key={session.id}
              className="session-card card-enter"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Session icon and info */}
              <div className="session-card__header">
                <span className="session-card__icon">{session.icon}</span>
                <div className="session-card__info">
                  <span className="session-card__name">{session.name}</span>
                  <span className="session-card__meta">
                    {session.tabs.length} tabs · {formatDate(session.createdAt)}
                  </span>
                </div>
              </div>

              {/* Session actions */}
              <div className="session-card__actions">
                <button
                  className="btn btn--primary btn--small"
                  onClick={() => onRestore(session.id)}
                >
                  Restore
                </button>

                {/* Delete with confirmation */}
                {pendingDeleteId === session.id ? (
                  <div className="session-card__confirm-delete">
                    <span>Delete?</span>
                    <button
                      className="btn btn--danger btn--small"
                      onClick={() => handleConfirmDelete(session.id)}
                    >
                      Yes
                    </button>
                    <button
                      className="btn btn--text btn--small"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--text btn--small"
                    onClick={() => setPendingDeleteId(session.id)}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
