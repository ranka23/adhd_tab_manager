/**
 * Tests for all React hooks.
 * Covers useTabs, useTimer, useBlockedSites, and useSessions.
 *
 * Uses renderHook from @testing-library/react with dynamic imports
 * so that the chrome API mocks from setup.ts are in place before
 * the hooks (and their statically imported service dependencies) are loaded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { clearStorage, seedStorage, mocks } from './setup';
import { STORAGE_KEYS } from '../src/shared/constants';

/* ─══════════════════════════════════════════════════════════════════─
 *  useBlockedSites
 * ─══════════════════════════════════════════════════════════════════─ */

describe('useBlockedSites', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  it('should start with loading state', async () => {
    // Act
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    // Assert — initial state before effects settle
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sites).toEqual([]);
    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load blocked sites and active state on mount', async () => {
    // Act
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert — should have default blocked sites
    expect(result.current.error).toBeNull();
    expect(result.current.sites.length).toBeGreaterThan(0);
    expect(result.current.isActive).toBe(false);
  });

  it('should add a site via addSite and refresh the list', async () => {
    // Arrange
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    await act(async () => {
      await result.current.addSite('example.com');
    });

    // Assert
    expect(result.current.sites.map((s) => s.domain)).toContain('example.com');
    expect(result.current.error).toBeNull();
  });

  it('should remove a site via removeSite and refresh the list', async () => {
    // Arrange
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.addSite('example.com');
    });

    // Act
    await act(async () => {
      await result.current.removeSite('example.com');
    });

    // Assert
    expect(result.current.sites.map((s) => s.domain)).not.toContain('example.com');
    expect(result.current.error).toBeNull();
  });

  it('should toggle active state on and off', async () => {
    // Arrange
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isActive).toBe(false);

    // Act — activate
    await act(async () => {
      await result.current.toggleActive();
    });

    // Assert
    expect(result.current.isActive).toBe(true);

    // Act — deactivate
    await act(async () => {
      await result.current.toggleActive();
    });

    // Assert
    expect(result.current.isActive).toBe(false);
  });

  it('should check if a URL is blocked via checkUrl', async () => {
    // Arrange
    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act — add a site and check
    await act(async () => {
      await result.current.addSite('example.com');
    });

    const blocked = await result.current.checkUrl('https://example.com');
    expect(blocked).toBe(false); // Blocker is not active

    // Activate and check again
    await act(async () => {
      await result.current.toggleActive();
    });

    const blockedNow = await result.current.checkUrl('https://example.com');
    expect(blockedNow).toBe(true);
  });

  it('should handle errors from addSite gracefully', async () => {
    // Arrange — make blockService.addBlockedSite throw
    const blockService = await import('../src/popup/services/blockService');
    vi.spyOn(blockService, 'addBlockedSite').mockRejectedValueOnce(new Error('Add failed'));

    const { useBlockedSites } = await import('../src/popup/hooks/useBlockedSites');
    const { result } = renderHook(() => useBlockedSites());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act & Assert
    await act(async () => {
      await expect(result.current.addSite('example.com')).rejects.toThrow('Add failed');
    });
    expect(result.current.error).toBe('Failed to add blocked site');
  });
});

/* ─══════════════════════════════════════════════════════════════════─
 *  useSessions
 * ─══════════════════════════════════════════════════════════════════─ */

describe('useSessions', () => {
  beforeEach(async () => {
    await clearStorage();
    // Reset mock call counts between tests
    vi.clearAllMocks();
    // Restore the default tabs.query mock
    mocks.tabs.query.mockResolvedValue([]);
    mocks.tabs.get.mockImplementation(async (tabId: number) => ({
      id: tabId,
      url: `https://example.com/tab${tabId}`,
      title: `Tab ${tabId}`,
      favIconUrl: undefined,
      active: false,
      pinned: false,
      windowId: 1,
      index: tabId,
    }));
  });

  it('should start with loading state', async () => {
    // Act
    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    // Assert — initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should load sessions on mount', async () => {
    // Act
    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should save a new session via save()', async () => {
    // Arrange
    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    let sessionId = '';
    await act(async () => {
      const session = await result.current.save('Test Session', '📁');
      sessionId = session.id;
    });

    // Assert
    expect(sessionId).toBeTruthy();
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.name).toBe('Test Session');
    expect(result.current.sessions[0]?.icon).toBe('📁');
    expect(result.current.error).toBeNull();
  });

  it('should restore a session via restore()', async () => {
    // Arrange — seed a session with tabs directly into storage
    await seedStorage({
      [STORAGE_KEYS.SESSIONS]: [
        {
          id: 'restore-session',
          name: 'Restore Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tabs: [
            {
              id: 1,
              url: 'https://example.com',
              title: 'Example',
              favIconUrl: undefined,
              active: false,
              pinned: false,
              windowId: 1,
              index: 0,
            },
          ],
          icon: '📋',
        },
      ],
    });

    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessions).toHaveLength(1);

    // Act
    mocks.tabs.create.mockClear();
    await act(async () => {
      await result.current.restore('restore-session');
    });

    // Assert — tabs.create should have been called with the tab URL as stored
    expect(mocks.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' }),
    );
  });

  it('should remove a session via remove()', async () => {
    // Arrange — save a session first
    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.save('Delete Me', '🗑️');
    });
    expect(result.current.sessions).toHaveLength(1);

    // Act
    await act(async () => {
      await result.current.remove(result.current.sessions[0]!.id);
    });

    // Assert
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('should rename a session via rename()', async () => {
    // Arrange — save a session first
    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.save('Old Name', '📁');
    });

    // Act
    const sessionId = result.current.sessions[0]!.id;
    await act(async () => {
      await result.current.rename(sessionId, 'New Name');
    });

    // Assert
    expect(result.current.sessions[0]?.name).toBe('New Name');
  });

  it('should handle errors from save gracefully', async () => {
    // Arrange — make tabService.getCurrentWindowTabs throw
    const tabService = await import('../src/popup/services/tabService');
    vi.spyOn(tabService, 'getCurrentWindowTabs').mockRejectedValueOnce(
      new Error('Tabs error'),
    );

    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act & Assert
    await act(async () => {
      await expect(result.current.save('Fail', '❌')).rejects.toThrow('Tabs error');
    });
    expect(result.current.error).toBe('Failed to save session');
  });

  it('should refresh sessions from storage', async () => {
    // Arrange — seed storage with a session before the hook mounts
    await seedStorage({
      [STORAGE_KEYS.SESSIONS]: [
        {
          id: 'pre-existing',
          name: 'Preloaded',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tabs: [],
          icon: '📋',
        },
      ],
    });

    const { useSessions } = await import('../src/popup/hooks/useSessions');
    const { result } = renderHook(() => useSessions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert — the pre-seeded session should be loaded
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.name).toBe('Preloaded');
  });
});

/* ─══════════════════════════════════════════════════════════════════─
 *  useTabs
 * ─══════════════════════════════════════════════════════════════════─ */

describe('useTabs', () => {
  beforeEach(async () => {
    await clearStorage();
    vi.clearAllMocks();
    // Default tab query returns empty
    mocks.tabs.query.mockResolvedValue([]);
    mocks.tabs.get.mockImplementation(async (tabId: number) => ({
      id: tabId,
      url: `https://example.com/tab${tabId}`,
      title: `Tab ${tabId}`,
      favIconUrl: undefined,
      active: false,
      pinned: false,
      windowId: 1,
      index: tabId,
    }));
  });

  it('should start with loading state and empty tabs/sessions', async () => {
    // Act
    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    // Assert — initial state before mount effect
    expect(result.current.isLoading).toBe(true);
    expect(result.current.tabs).toEqual([]);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should load tabs and sessions on mount', async () => {
    // Arrange — seed a session beforehand
    await seedStorage({
      [STORAGE_KEYS.SESSIONS]: [
        {
          id: 'saved-session',
          name: 'Saved Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tabs: [],
          icon: '📋',
        },
      ],
    });
    mocks.tabs.query.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
      },
    ]);

    // Act
    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.url).toBe('https://example.com');
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.name).toBe('Saved Session');
    expect(result.current.error).toBeNull();
  });

  it('should refresh tabs via refreshTabs', async () => {
    // Arrange
    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Set up new tab data
    mocks.tabs.query.mockResolvedValueOnce([
      {
        id: 99,
        url: 'https://refreshed.com',
        title: 'Refreshed',
        favIconUrl: undefined,
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
      },
    ]);

    // Act
    await act(async () => {
      await result.current.refreshTabs();
    });

    // Assert
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.url).toBe('https://refreshed.com');
  });

  it('should close a tab and refresh the list', async () => {
    // Arrange
    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    await act(async () => {
      await result.current.closeTab(42);
    });

    // Assert — tabs.remove should have been called
    expect(mocks.tabs.remove).toHaveBeenCalledWith(42);
    // The tab should have been recorded as closed
    expect(mocks.storage.get).toHaveBeenCalledWith(STORAGE_KEYS.CLOSED_TABS);
  });

  it('should save a new session via saveSession', async () => {
    // Arrange
    mocks.tabs.query.mockResolvedValue([
      {
        id: 1,
        url: 'https://a.com',
        title: 'A',
        favIconUrl: undefined,
        active: false,
        pinned: false,
        windowId: 1,
        index: 0,
      },
    ]);

    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    await act(async () => {
      await result.current.saveSession('My Session', '📁');
    });

    // Assert
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.name).toBe('My Session');
  });

  it('should restore a saved session via restoreSession', async () => {
    // Arrange — seed a session with tabs directly into storage
    await seedStorage({
      [STORAGE_KEYS.SESSIONS]: [
        {
          id: 'restore-me',
          name: 'Restore Me',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tabs: [
            {
              id: 1,
              url: 'https://example.com',
              title: 'Example',
              favIconUrl: undefined,
              active: false,
              pinned: false,
              windowId: 1,
              index: 0,
            },
          ],
          icon: '📋',
        },
      ],
    });

    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    mocks.tabs.create.mockClear();
    await act(async () => {
      await result.current.restoreSession('restore-me');
    });

    // Assert — should have created tabs with the URL as stored
    expect(mocks.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' }),
    );
  });

  it('should delete a session via deleteSession', async () => {
    // Arrange — seed a session
    const { saveSession: save } = await import('../src/popup/services/tabService');
    await save('Delete Me', [], '📋');

    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessions).toHaveLength(1);

    // Act
    await act(async () => {
      await result.current.deleteSession(result.current.sessions[0]!.id);
    });

    // Assert
    expect(result.current.sessions).toHaveLength(0);
  });

  it('should undo close tab via undoCloseTab', async () => {
    // Arrange — first close a tab
    const tabService = await import('../src/popup/services/tabService');
    await tabService.closeTab(42);

    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    let restored = false;
    await act(async () => {
      restored = await result.current.undoCloseTab();
    });

    // Assert
    expect(restored).toBe(true);
    expect(mocks.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/tab42' }),
    );
  });

  it('should return false from undoCloseTab when no tabs to restore', async () => {
    // Arrange
    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    let restored = true;
    await act(async () => {
      restored = await result.current.undoCloseTab();
    });

    // Assert
    expect(restored).toBe(false);
  });

  it('should handle tab query errors gracefully at the service level', async () => {
    // Arrange — make tabs.query throw
    mocks.tabs.query.mockRejectedValueOnce(new Error('Query failed'));

    const { useTabs } = await import('../src/popup/hooks/useTabs');
    const { result } = renderHook(() => useTabs());

    // Wait for loading to complete (error should still finish loading)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The service layer catches the error and returns empty tabs;
    // the hook's error state is not set because the service handles it
    expect(result.current.tabs).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

/* ─══════════════════════════════════════════════════════════════════─
 *  useTimer
 * ─══════════════════════════════════════════════════════════════════─ */

describe('useTimer', () => {
  beforeEach(async () => {
    await clearStorage();
    vi.clearAllMocks();
  });

  it('should start with loading state and default idle timer', async () => {
    // Act
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    // Assert — initial state before mount effect
    expect(result.current.isLoading).toBe(true);
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.remainingSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should load timer state, settings, and stats on mount', async () => {
    // Act
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert — default state
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.pomodoroCount).toBe(0);
    expect(result.current.streak).toBe(0);
    expect(result.current.settings.workMinutes).toBe(25);
    expect(result.current.settings.shortBreakMinutes).toBe(5);
    expect(result.current.settings.longBreakMinutes).toBe(15);
    expect(result.current.settings.pomodorosBeforeLongBreak).toBe(4);
    expect(result.current.error).toBeNull();
  });

  it('should start work phase via startWork()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    await act(async () => {
      await result.current.startWork();
    });

    // Assert
    expect(result.current.state.phase).toBe('work');
    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.remainingSeconds).toBe(25 * 60);
    expect(result.current.state.totalSeconds).toBe(25 * 60);
    expect(result.current.error).toBeNull();
  });

  it('should pause the timer via pause()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.startWork();
    });

    // Act
    await act(async () => {
      await result.current.pause();
    });

    // Assert
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.pausedAt).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should resume the timer via resume()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.startWork();
    });
    await act(async () => {
      await result.current.pause();
    });

    // Act
    await act(async () => {
      await result.current.resume();
    });

    // Assert
    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.pausedAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should reset the timer via reset()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.startWork();
    });

    // Act
    await act(async () => {
      await result.current.reset();
    });

    // Assert
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.remainingSeconds).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should skip to the next phase via skipPhase()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.startWork();
    });
    // Manually set remaining to 0 so transition works properly
    const timerService = await import('../src/popup/services/timerService');
    await timerService.saveTimerState({
      ...result.current.state,
      remainingSeconds: 0,
      isRunning: false,
    });

    // Act
    await act(async () => {
      await result.current.skipPhase();
    });

    // Assert — should transition from work to short break
    expect(result.current.state.phase).toBe('shortBreak');
    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should update settings via updateSettings()', async () => {
    // Arrange
    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act
    const newSettings = {
      workMinutes: 30,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      pomodorosBeforeLongBreak: 3,
    };
    await act(async () => {
      await result.current.updateSettings(newSettings);
    });

    // Assert
    expect(result.current.settings).toEqual(newSettings);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors from startWork gracefully', async () => {
    // Arrange — make timerService.startWorkPhase throw
    const timerService = await import('../src/popup/services/timerService');
    vi.spyOn(timerService, 'startWorkPhase').mockRejectedValueOnce(
      new Error('Start failed'),
    );

    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act & Assert
    await act(async () => {
      await expect(result.current.startWork()).rejects.toThrow('Start failed');
    });
    expect(result.current.error).toBe('Failed to start timer');
  });

  it('should restore timer state from storage when it exists', async () => {
    // Arrange — seed an active timer state into storage before the hook mounts
    const timerState = {
      phase: 'work' as const,
      isRunning: true,
      remainingSeconds: 1200,
      totalSeconds: 1500,
      completedInCycle: 2,
      startedAt: Date.now(),
      pausedAt: null,
    };
    await seedStorage({
      [STORAGE_KEYS.ACTIVE_TIMER]: timerState,
    });

    const { useTimer } = await import('../src/popup/hooks/useTimer');
    const { result } = renderHook(() => useTimer());

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert — should have loaded the persisted state
    expect(result.current.state.phase).toBe('work');
    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.remainingSeconds).toBe(1200);
    expect(result.current.state.totalSeconds).toBe(1500);
    expect(result.current.state.completedInCycle).toBe(2);
  });
});
