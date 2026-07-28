/**
 * Popup.tsx — Main popup layout component.
 * Orchestrates all the major sections of the extension popup:
 * Header, navigation tabs, and content panels.
 *
 * Uses a tab-based navigation to keep one-thing-at-a-time UX.
 * Each tab shows a focused set of features without overwhelming the user.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FocusMode } from './components/FocusMode';
import { TabGroup } from './components/TabGroup';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SessionSaver } from './components/SessionSaver';
import { DistractionBlocker } from './components/DistractionBlocker';
import { DailyQuote } from './components/DailyQuote';
import { QuickActions } from './components/QuickActions';
import { useTabs } from './hooks/useTabs';
import { useTimer } from './hooks/useTimer';
import { useSessions } from './hooks/useSessions';
import { useBlockedSites } from './hooks/useBlockedSites';
import * as sessionService from './services/sessionService';
import { EndOfDaySummary } from './components/EndOfDaySummary';
import type { FocusModeState, DailyStats } from './types';
import { STORAGE_KEYS } from '../shared/constants';

/** Navigation tab identifiers */
type NavTab = 'home' | 'tabs' | 'timer' | 'sessions' | 'block';

/**
 * The main popup component.
 * Manages navigation between feature panels and coordinates
 * shared state like focus mode.
 */
export const Popup: React.FC = () => {
  /** Currently active navigation tab */
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  /** Focus mode state */
  const [focusMode, setFocusMode] = useState<FocusModeState>({
    isActive: false,
    startedAt: null,
    savedTabIds: [],
  });

  /** Whether to show the end-of-day summary */
  const [showSummary, setShowSummary] = useState(false);

  /** Daily stats for the motivation section */
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    focusMinutes: 0,
    pomodorosCompleted: 0,
    distractionsBlocked: 0,
    sessionsSaved: 0,
    currentStreak: 0,
  });

  // Initialize all hooks
  const tabs = useTabs();
  const timer = useTimer();
  const sessions = useSessions();
  const blockedSites = useBlockedSites();

  /** Loads focus mode state and daily stats from storage */
  const loadState = useCallback(async () => {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.FOCUS_MODE,
      STORAGE_KEYS.FOCUS_SAVED_TABS,
    ]);

    const storedFocus = result[STORAGE_KEYS.FOCUS_MODE] as FocusModeState | undefined;
    if (storedFocus) {
      setFocusMode(storedFocus);
    }

    const stats = await sessionService.getDailyStats();
    setDailyStats(stats);
  }, []);

  // Load state on mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  /** Handles starting focus mode */
  const handleStartFocus = useCallback(async () => {
    // Save current tab IDs for restoration
    const currentTabs = await tabs.refreshTabs().then(() => tabs.tabs);
    const tabIds = currentTabs.map((t) => t.id);

    const newFocusState: FocusModeState = {
      isActive: true,
      startedAt: Date.now(),
      savedTabIds: tabIds,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.FOCUS_MODE]: newFocusState,
    });
    setFocusMode(newFocusState);

    // Activate the blocker
    await blockedSites.toggleActive();
  }, [tabs, blockedSites]);

  /** Handles ending focus mode */
  const handleEndFocus = useCallback(async () => {
    // Calculate focus duration
    if (focusMode.startedAt) {
      const minutes = Math.floor((Date.now() - focusMode.startedAt) / 60000);
      await sessionService.addFocusMinutes(minutes);
    }

    const newFocusState: FocusModeState = {
      isActive: false,
      startedAt: null,
      savedTabIds: [],
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.FOCUS_MODE]: newFocusState,
    });
    setFocusMode(newFocusState);

    // Deactivate the blocker
    if (blockedSites.isActive) {
      await blockedSites.toggleActive();
    }

    // Reload stats
    const stats = await sessionService.getDailyStats();
    setDailyStats(stats);

    // Show summary after ending focus
    setShowSummary(true);
    setTimeout(() => setShowSummary(false), 10000);
  }, [focusMode.startedAt, blockedSites]);

  /** Handles closing all non-pinned tabs */
  const handleCloseAll = useCallback(async () => {
    const nonPinned = tabs.tabs.filter((t) => !t.pinned);
    for (const tab of nonPinned) {
      await tabs.closeTab(tab.id);
    }
  }, [tabs]);

  // Load daily stats on mount
  useEffect(() => {
    sessionService.getDailyStats().then(setDailyStats);
  }, []);

  // If focus mode is active and we're not on the home tab, switch to home
  useEffect(() => {
    if (focusMode.isActive && activeTab !== 'home') {
      setActiveTab('home');
    }
  }, [focusMode.isActive, activeTab]);

  return (
    <div className="popup-root" data-testid="adhd-tab-manager">
      {/* Header with focus mode toggle */}
      <Header
        isFocusMode={focusMode.isActive}
        onToggleFocus={focusMode.isActive ? handleEndFocus : handleStartFocus}
      />

      {/* Main content */}
      <div className="popup-content">
        {/* Focus Mode Panel (shown when active) */}
        {focusMode.isActive ? (
          <FocusMode
            isActive={focusMode.isActive}
            startedAt={focusMode.startedAt}
            onStart={handleStartFocus}
            onEnd={handleEndFocus}
          />
        ) : (
          <>
            {/* Navigation tabs */}
            <nav className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'home' ? 'nav-tab--active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                <span className="nav-tab__icon">🏠</span>
                Home
              </button>
              <button
                className={`nav-tab ${activeTab === 'tabs' ? 'nav-tab--active' : ''}`}
                onClick={() => setActiveTab('tabs')}
              >
                <span className="nav-tab__icon">🗂️</span>
                Tabs
              </button>
              <button
                className={`nav-tab ${activeTab === 'timer' ? 'nav-tab--active' : ''}`}
                onClick={() => setActiveTab('timer')}
              >
                <span className="nav-tab__icon">⏱️</span>
                Timer
              </button>
              <button
                className={`nav-tab ${activeTab === 'sessions' ? 'nav-tab--active' : ''}`}
                onClick={() => setActiveTab('sessions')}
              >
                <span className="nav-tab__icon">💾</span>
                Sessions
              </button>
              <button
                className={`nav-tab ${activeTab === 'block' ? 'nav-tab--active' : ''}`}
                onClick={() => setActiveTab('block')}
              >
                <span className="nav-tab__icon">🛡️</span>
                Block
              </button>
            </nav>

            {/* Tab content panels */}
            {activeTab === 'home' && (
              <div className="tab-panel">
                {showSummary && (
                  <div className="section">
                    <EndOfDaySummary stats={dailyStats} onDismiss={() => setShowSummary(false)} />
                  </div>
                )}
                <div className="section">
                  <DailyQuote stats={dailyStats} />
                </div>
                <div className="section">
                  <FocusMode
                    isActive={focusMode.isActive}
                    startedAt={focusMode.startedAt}
                    onStart={handleStartFocus}
                    onEnd={handleEndFocus}
                  />
                </div>
                <div className="section">
                  <QuickActions
                    tabCount={tabs.tabs.length}
                    pinnedCount={tabs.tabs.filter((t) => t.pinned).length}
                    onUndoClose={tabs.undoCloseTab}
                    onCloseAll={handleCloseAll}
                    isFocusMode={focusMode.isActive}
                  />
                </div>
              </div>
            )}

            {activeTab === 'tabs' && (
              <div className="tab-panel">
                <TabGroup tabs={tabs.tabs} onCloseTab={tabs.closeTab} />
              </div>
            )}

            {activeTab === 'timer' && (
              <div className="tab-panel">
                <div className="section">
                  <PomodoroTimer
                    state={timer.state}
                    settings={timer.settings}
                    pomodoroCount={timer.pomodoroCount}
                    streak={timer.streak}
                    onStart={timer.startWork}
                    onPause={timer.pause}
                    onResume={timer.resume}
                    onReset={timer.reset}
                    onSkip={timer.skipPhase}
                    onUpdateSettings={timer.updateSettings}
                  />
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="tab-panel">
                <div className="section">
                  <SessionSaver
                    sessions={sessions.sessions}
                    openTabCount={tabs.tabs.length}
                    onSave={sessions.save}
                    onRestore={sessions.restore}
                    onDelete={sessions.remove}
                    onUndoClose={tabs.undoCloseTab}
                  />
                </div>
              </div>
            )}

            {activeTab === 'block' && (
              <div className="tab-panel">
                <div className="section">
                  <DistractionBlocker
                    sites={blockedSites.sites}
                    isActive={blockedSites.isActive}
                    blockedCount={dailyStats.distractionsBlocked}
                    onAddSite={blockedSites.addSite}
                    onRemoveSite={blockedSites.removeSite}
                    onToggleActive={blockedSites.toggleActive}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
