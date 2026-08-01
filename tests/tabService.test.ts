/**
 * Tests for the tab service.
 * Covers session CRUD, tab operations, and undo-close functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorage, mocks } from './setup';

// Tab shape used in mock data
interface MockTab {
  id?: number | undefined;
  url?: string | undefined;
  title?: string | undefined;
  favIconUrl?: string | undefined;
  active?: boolean | undefined;
  pinned?: boolean | undefined;
  windowId?: number | undefined;
  index?: number | undefined;
}

// Mock chrome.tabs.get to return tab-specific URLs for undo-close tests
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

describe('Tab Service', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  describe('getAllTabs', () => {
    it('should return empty array when no tabs exist', async () => {
      // Arrange
      mocks.tabs.query.mockResolvedValueOnce([]);

      // Act
      const { getAllTabs } = await import('../src/popup/services/tabService');
      const tabs = await getAllTabs();

      // Assert
      expect(tabs).toEqual([]);
    });

    it('should filter out tabs without URLs', async () => {
      // Arrange
      mocks.tabs.query.mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example',
          active: false,
          pinned: false,
          windowId: 1,
          index: 0,
        } satisfies MockTab,
        {
          id: 2,
          url: undefined,
          title: 'Chrome',
          active: false,
          pinned: false,
          windowId: 1,
          index: 1,
        } satisfies MockTab,
      ]);

      // Act
      const { getAllTabs } = await import('../src/popup/services/tabService');
      const tabs = await getAllTabs();

      // Assert
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.url).toBe('https://example.com');
    });

    it('should filter out tabs without IDs', async () => {
      // Arrange
      mocks.tabs.query.mockResolvedValueOnce([
        {
          id: undefined,
          url: 'https://example.com',
          title: 'No ID',
          active: false,
          pinned: false,
          windowId: 1,
          index: 0,
        } satisfies MockTab,
      ]);

      // Act
      const { getAllTabs } = await import('../src/popup/services/tabService');
      const tabs = await getAllTabs();

      // Assert
      expect(tabs).toHaveLength(0);
    });
  });

  describe('saveSession', () => {
    it('should create and save a session', async () => {
      // Arrange
      const { saveSession, getSessions } = await import('../src/popup/services/tabService');
      const mockTabs = [
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example',
          favIconUrl: undefined,
          active: true,
          pinned: false,
          windowId: 1,
          index: 0,
        },
      ];

      // Act
      const session = await saveSession('Test Session', mockTabs, '📋');

      // Assert
      expect(session.name).toBe('Test Session');
      expect(session.icon).toBe('📋');
      expect(session.tabs).toHaveLength(1);
      expect(session.id).toBeDefined();

      // Verify it was saved
      const sessions = await getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.name).toBe('Test Session');
    });

    it('should save multiple sessions', async () => {
      // Arrange
      const { saveSession, getSessions } = await import('../src/popup/services/tabService');
      const mockTabs = [
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
      ];

      // Act
      await saveSession('Session 1', mockTabs);
      await saveSession('Session 2', mockTabs);
      await saveSession('Session 3', mockTabs);

      // Assert
      const sessions = await getSessions();
      expect(sessions).toHaveLength(3);
      // Most recent should be first
      expect(sessions[0]?.name).toBe('Session 3');
    });

    it('should increment the sessions-saved counter used by daily stats', async () => {
      // Arrange
      const { saveSession } = await import('../src/popup/services/tabService');
      const { STORAGE_KEYS } = await import('../src/shared/constants');
      const mockTabs = [
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
      ];

      // Act
      await saveSession('S1', mockTabs);
      await saveSession('S2', mockTabs);

      // Assert
      const result = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS_SAVED_TODAY);
      expect(result[STORAGE_KEYS.SESSIONS_SAVED_TODAY]).toBe(2);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session by ID', async () => {
      // Arrange
      const { saveSession, deleteSession, getSessions } =
        await import('../src/popup/services/tabService');
      const mockTabs = [
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
      ];
      const session = await saveSession('To Delete', mockTabs);

      // Act
      const result = await deleteSession(session.id);

      // Assert
      expect(result).toBe(true);
      const sessions = await getSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should return false for non-existent session', async () => {
      // Arrange
      const { deleteSession } = await import('../src/popup/services/tabService');

      // Act
      const result = await deleteSession('non-existent-id');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('restoreDeletedSession', () => {
    it('should re-insert a deleted session so undo works', async () => {
      // Arrange
      const { saveSession, deleteSession, restoreDeletedSession, getSessions } =
        await import('../src/popup/services/tabService');
      const mockTabs = [
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
      ];
      const session = await saveSession('Undo Me', mockTabs, '💾');
      await deleteSession(session.id);
      expect(await getSessions()).toHaveLength(0);

      // Act — undo the delete
      const result = await restoreDeletedSession(session);

      // Assert
      expect(result).toBe(true);
      const sessions = await getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe(session.id);
      expect(sessions[0]?.name).toBe('Undo Me');
      expect(sessions[0]?.icon).toBe('💾');
    });

    it('should replace an existing session with the same ID rather than duplicate', async () => {
      // Arrange
      const { saveSession, restoreDeletedSession, getSessions } =
        await import('../src/popup/services/tabService');
      const mockTabs = [
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
      ];
      const original = await saveSession('Original', mockTabs);
      const updated = { ...original, name: 'Updated', updatedAt: Date.now() + 1000 };

      // Act
      await restoreDeletedSession(updated);

      // Assert
      const sessions = await getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.name).toBe('Updated');
    });
  });

  describe('renameSession', () => {
    it('should rename an existing session', async () => {
      // Arrange
      const { saveSession, renameSession, getSessions } =
        await import('../src/popup/services/tabService');
      const mockTabs = [
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
      ];
      const session = await saveSession('Old Name', mockTabs);

      // Act
      const result = await renameSession(session.id, 'New Name');

      // Assert
      expect(result).toBe(true);
      const sessions = await getSessions();
      expect(sessions[0]?.name).toBe('New Name');
    });
  });

  describe('closeTab and restoreLastClosedTab', () => {
    it('should record closed tab and restore it', async () => {
      // Arrange
      const { closeTab, restoreLastClosedTab, getClosedTabs } =
        await import('../src/popup/services/tabService');

      // Act - close a tab
      await closeTab(42);

      // Assert - it should be recorded
      const closed = await getClosedTabs();
      expect(closed).toHaveLength(1);
      expect(closed[0]?.tab.id).toBe(42);

      // Act - restore it
      mocks.tabs.create.mockClear();
      const restored = await restoreLastClosedTab();

      // Assert
      expect(restored).toBe(true);
      expect(mocks.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/tab42' }),
      );
    });

    it('should return false when no tabs to restore', async () => {
      // Arrange
      const { restoreLastClosedTab } = await import('../src/popup/services/tabService');

      // Act
      const result = await restoreLastClosedTab();

      // Assert
      expect(result).toBe(false);
    });
  });
});
