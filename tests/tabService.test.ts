/**
 * Tests for the tab service.
 * Covers session CRUD, tab operations, and undo-close functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorage, mocks } from './setup';

// Mock chrome.tabs.get for individual tab lookups
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
        },
        {
          id: 2,
          url: undefined,
          title: 'Chrome',
          active: false,
          pinned: false,
          windowId: 1,
          index: 1,
        },
      ] as unknown as chrome.tabs.Tab[]);

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
        },
      ] as unknown as chrome.tabs.Tab[]);

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
