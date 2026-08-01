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
import { MAX_SESSIONS } from '../../shared/constants';

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
  /** Callback to rename a session */
  onRename: (sessionId: string, newName: string) => Promise<void>;
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
  onRename,
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
  /** Whether the session limit has been reached */
  const [capError, setCapError] = useState<string | null>(null);
  /** Session ID currently being renamed (inline edit) */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Draft name for the rename input */
  const [editName, setEditName] = useState('');

  /** Handles the save action */
  const handleSave = async (): Promise<void> => {
    if (!newSessionName.trim()) return;
    // Enforce the hard cap: never silently drop the oldest session.
    if (sessions.length >= MAX_SESSIONS) {
      setCapError(
        `Session limit reached (${MAX_SESSIONS}). Delete a session first to save a new one.`,
      );
      return;
    }
    setIsSaving(true);
    try {
      await onSave(newSessionName.trim(), selectedIcon);
      setNewSessionName('');
      setSelectedIcon('📋');
      setShowSaveDialog(false);
      setCapError(null);
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

  /** Starts an inline rename for a session */
  const startRename = (session: TabSession): void => {
    setEditingId(session.id);
    setEditName(session.name);
  };

  /** Submits the inline rename */
  const handleRenameSubmit = async (sessionId: string): Promise<void> => {
    if (!editName.trim()) return;
    await onRename(sessionId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="session-saver">
      {/* Action buttons row */}
      <div className="session-saver__actions">
        {/* Save current tabs as session */}
        <button
          className="btn btn--primary"
          onClick={() => {
            setCapError(
              sessions.length >= MAX_SESSIONS
                ? `Session limit reached (${MAX_SESSIONS}). Delete a session first to save a new one.`
                : null,
            );
            setShowSaveDialog(true);
          }}
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
                aria-label={`Select icon ${icon}`}
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

          {/* Session limit notice */}
          {capError && (
            <p className="session-saver__cap-error" role="alert">
              ⚠️ {capError}
            </p>
          )}
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
                  {editingId === session.id ? (
                    <div className="session-card__edit">
                      <input
                        className="session-saver__input session-card__edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRenameSubmit(session.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        aria-label={`Rename ${session.name}`}
                      />
                      <button
                        className="btn btn--primary btn--small"
                        onClick={() => void handleRenameSubmit(session.id)}
                        disabled={!editName.trim()}
                      >
                        Save
                      </button>
                      <button className="btn btn--text btn--small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="session-card__name">{session.name}</span>
                      <span className="session-card__meta">
                        {session.tabs.length} tabs · {formatDate(session.createdAt)}
                      </span>
                    </>
                  )}
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
                    aria-label={`Delete ${session.name}`}
                  >
                    🗑️
                  </button>
                )}

                {/* Rename */}
                <button
                  className="btn btn--text btn--small"
                  onClick={() => startRename(session)}
                  aria-label={`Rename ${session.name}`}
                  title="Rename session"
                >
                  ✏️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
