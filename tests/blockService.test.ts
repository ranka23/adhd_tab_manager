/**
 * Tests for the block service.
 * Covers blocked sites CRUD, URL matching, blocker toggle, and URL validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorage, seedStorage, mocks } from './setup';
import { STORAGE_KEYS, DEFAULT_BLOCKED_SITES } from '../src/shared/constants';

describe('Block Service', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  describe('getBlockedSites', () => {
    it('should return default blocked sites on first call', async () => {
      // Act
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const sites = await getBlockedSites();

      // Assert
      expect(sites).toHaveLength(DEFAULT_BLOCKED_SITES.length);
      expect(sites.map((s) => s.domain)).toEqual(
        expect.arrayContaining(DEFAULT_BLOCKED_SITES),
      );
      // Each site should have an addedAt timestamp
      sites.forEach((site) => {
        expect(site.domain).toBeTruthy();
        expect(site.addedAt).toBeGreaterThan(0);
      });
    });

    it('should return cached data on subsequent calls', async () => {
      // Arrange
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const firstCall = await getBlockedSites();
      const firstAddedAt = firstCall[0]?.addedAt;

      // Act
      const secondCall = await getBlockedSites();

      // Assert — timestamps should remain the same
      expect(secondCall).toHaveLength(DEFAULT_BLOCKED_SITES.length);
      expect(secondCall[0]?.addedAt).toBe(firstAddedAt);
    });

    it('should reset to defaults when storage contains corrupted data (non-array)', async () => {
      // Arrange — seed with a non-array value
      await seedStorage({
        [STORAGE_KEYS.BLOCKED_SITES]: 'corrupted string data',
      });

      // Act
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const sites = await getBlockedSites();

      // Assert — reset to defaults
      expect(sites).toHaveLength(DEFAULT_BLOCKED_SITES.length);
      expect(sites.map((s) => s.domain)).toEqual(
        expect.arrayContaining(DEFAULT_BLOCKED_SITES),
      );
    });

    it('should reset to defaults when storage contains an object instead of array', async () => {
      // Arrange — seed with a plain object
      await seedStorage({
        [STORAGE_KEYS.BLOCKED_SITES]: { domain: 'example.com', addedAt: 123 },
      });

      // Act
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const sites = await getBlockedSites();

      // Assert — reset to defaults
      expect(sites).toHaveLength(DEFAULT_BLOCKED_SITES.length);
      expect(sites.map((s) => s.domain)).toContain('reddit.com');
    });

    it('should handle storage.get failures gracefully', async () => {
      // Arrange — make storage.get throw
      mocks.storage.get.mockRejectedValueOnce(new Error('Storage error'));

      // Act
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const sites = await getBlockedSites();

      // Assert — should still return defaults
      expect(sites).toHaveLength(DEFAULT_BLOCKED_SITES.length);
    });

    it('should handle storage.set failures during initialization gracefully', async () => {
      // Arrange — make storage.set throw on the first call
      mocks.storage.set.mockRejectedValueOnce(new Error('Write error'));

      // Act
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      const sites = await getBlockedSites();

      // Assert — should still return defaults
      expect(sites).toHaveLength(DEFAULT_BLOCKED_SITES.length);
    });
  });

  describe('addBlockedSite', () => {
    it('should add a new site to the blocked list', async () => {
      // Arrange
      const { addBlockedSite, getBlockedSites } =
        await import('../src/popup/services/blockService');

      // Act
      const added = await addBlockedSite('example.com');

      // Assert
      expect(added.domain).toBe('example.com');
      expect(added.addedAt).toBeGreaterThan(0);

      const sites = await getBlockedSites();
      expect(sites.map((s) => s.domain)).toContain('example.com');
    });

    it('should normalize domain by removing www prefix from URLs', async () => {
      // Arrange
      const { addBlockedSite, getBlockedSites } =
        await import('../src/popup/services/blockService');

      // Act — pass a full URL so extractDomain can parse it
      await addBlockedSite('https://www.example.com');

      // Assert
      const sites = await getBlockedSites();
      expect(sites.map((s) => s.domain)).toContain('example.com');
      expect(sites.map((s) => s.domain)).not.toContain('www.example.com');
    });

    it('should normalize domain from full URL with path', async () => {
      // Arrange
      const { addBlockedSite } = await import('../src/popup/services/blockService');

      // Act
      const added = await addBlockedSite('https://www.youtube.com/watch?v=123');

      // Assert
      expect(added.domain).toBe('youtube.com');
    });

    it('should prevent duplicate entries', async () => {
      // Arrange
      const { addBlockedSite, getBlockedSites } =
        await import('../src/popup/services/blockService');

      // Act
      await addBlockedSite('example.com');
      const duplicate = await addBlockedSite('example.com');

      // Assert — only one entry
      const sites = await getBlockedSites();
      const matching = sites.filter((s) => s.domain === 'example.com');
      expect(matching).toHaveLength(1);
      expect(duplicate.domain).toBe('example.com');
    });

    it('should not throw when storage.set fails', async () => {
      // Arrange
      mocks.storage.set.mockRejectedValueOnce(new Error('Storage error'));
      const { addBlockedSite } = await import('../src/popup/services/blockService');

      // Act & Assert
      await expect(addBlockedSite('example.com')).resolves.toBeDefined();
    });
  });

  describe('removeBlockedSite', () => {
    it('should remove an existing site from the blocked list', async () => {
      // Arrange
      const { addBlockedSite, removeBlockedSite, getBlockedSites } =
        await import('../src/popup/services/blockService');
      await addBlockedSite('example.com');

      // Act
      const result = await removeBlockedSite('example.com');

      // Assert
      expect(result).toBe(true);
      const sites = await getBlockedSites();
      expect(sites.map((s) => s.domain)).not.toContain('example.com');
    });

    it('should return false when the site is not on the list', async () => {
      // Arrange
      const { removeBlockedSite } = await import('../src/popup/services/blockService');

      // Act
      const result = await removeBlockedSite('nonexistent.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should normalize domain via extractDomain when removing', async () => {
      // Arrange
      const { addBlockedSite, removeBlockedSite, getBlockedSites } =
        await import('../src/popup/services/blockService');
      await addBlockedSite('example.com');

      // Act — remove with a full URL (www prefix gets stripped)
      const result = await removeBlockedSite('https://www.example.com');

      // Assert
      expect(result).toBe(true);
      const sites = await getBlockedSites();
      expect(sites.map((s) => s.domain)).not.toContain('example.com');
    });
  });

  describe('matchesBlockedPattern', () => {
    it('should match exact domain', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('reddit.com', 'reddit.com')).toBe(true);
    });

    it('should match wildcard *.pattern', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('old.reddit.com', '*.reddit.com')).toBe(true);
    });

    it('should match wildcard *.pattern for apex domain', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('reddit.com', '*.reddit.com')).toBe(true);
    });

    it('should match subdomain without explicit wildcard', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('old.reddit.com', 'reddit.com')).toBe(true);
    });

    it('should match www subdomain automatically', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('www.reddit.com', 'reddit.com')).toBe(true);
    });

    it('should not match unrelated domain', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('example.com', 'reddit.com')).toBe(false);
    });

    it('should handle case-insensitive matching', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('REDDIT.COM', 'reddit.com')).toBe(true);
    });

    it('should handle www prefix in blocked domain', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('reddit.com', 'www.reddit.com')).toBe(true);
    });

    it('should match deep subdomains', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      expect(matchesBlockedPattern('a.b.c.reddit.com', 'reddit.com')).toBe(true);
      expect(matchesBlockedPattern('a.b.c.reddit.com', '*.reddit.com')).toBe(true);
    });

    it('should not match partial domain suffix', async () => {
      const { matchesBlockedPattern } = await import('../src/popup/services/blockService');
      // "notreddit.com" should NOT match "reddit.com"
      expect(matchesBlockedPattern('notreddit.com', 'reddit.com')).toBe(false);
    });
  });

  describe('isSiteBlocked', () => {
    it('should return true for a blocked site URL', async () => {
      // Arrange — ensure defaults are loaded (they include reddit.com)
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      await getBlockedSites(); // Initializes defaults

      // Act
      const { isSiteBlocked } = await import('../src/popup/services/blockService');
      const result = await isSiteBlocked('https://www.reddit.com/r/all');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for a subdomain of a blocked site', async () => {
      // Arrange
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      await getBlockedSites(); // Initializes defaults

      // Act
      const { isSiteBlocked } = await import('../src/popup/services/blockService');
      const result = await isSiteBlocked('https://old.reddit.com/r/all');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for an unblocked site URL', async () => {
      // Arrange
      const { getBlockedSites } = await import('../src/popup/services/blockService');
      await getBlockedSites(); // Initializes defaults

      // Act
      const { isSiteBlocked } = await import('../src/popup/services/blockService');
      const result = await isSiteBlocked('https://example.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for a newly added blocked site that is not a default', async () => {
      // Act
      const { isSiteBlocked } = await import('../src/popup/services/blockService');
      const result = await isSiteBlocked('https://example.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should detect a site added dynamically during the session', async () => {
      // Arrange
      const { addBlockedSite, isSiteBlocked } =
        await import('../src/popup/services/blockService');
      await addBlockedSite('news.ycombinator.com');

      // Act
      const result = await isSiteBlocked('https://news.ycombinator.com/item?id=123');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('isBlockerActive / activateBlocker / deactivateBlocker', () => {
    it('should return false by default', async () => {
      // Act
      const { isBlockerActive } = await import('../src/popup/services/blockService');
      const active = await isBlockerActive();

      // Assert
      expect(active).toBe(false);
    });

    it('should return true after activation', async () => {
      // Arrange
      const { activateBlocker } = await import('../src/popup/services/blockService');
      await activateBlocker();

      // Act
      const { isBlockerActive } = await import('../src/popup/services/blockService');
      const active = await isBlockerActive();

      // Assert
      expect(active).toBe(true);
    });

    it('should return false after deactivation', async () => {
      // Arrange
      const { activateBlocker, deactivateBlocker } =
        await import('../src/popup/services/blockService');
      await activateBlocker();
      await deactivateBlocker();

      // Act
      const { isBlockerActive } = await import('../src/popup/services/blockService');
      const active = await isBlockerActive();

      // Assert
      expect(active).toBe(false);
    });

    it('should toggle between active and inactive', async () => {
      // Arrange
      const { activateBlocker, deactivateBlocker, isBlockerActive: check } =
        await import('../src/popup/services/blockService');

      // Act & Assert — activate
      await activateBlocker();
      expect(await check()).toBe(true);

      // Act & Assert — deactivate
      await deactivateBlocker();
      expect(await check()).toBe(false);

      // Act & Assert — reactivate
      await activateBlocker();
      expect(await check()).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      mocks.storage.get.mockRejectedValueOnce(new Error('Storage error'));

      // Act
      const { isBlockerActive } = await import('../src/popup/services/blockService');
      const active = await isBlockerActive();

      // Assert — defaults to false on error
      expect(active).toBe(false);
    });
  });

  describe('shouldBlockUrl', () => {
    it('should return false when blocker is not active', async () => {
      // Act
      const { shouldBlockUrl } = await import('../src/popup/services/blockService');
      const result = await shouldBlockUrl('https://www.reddit.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when site is not blocked even if blocker is active', async () => {
      // Arrange
      const { activateBlocker } = await import('../src/popup/services/blockService');
      await activateBlocker();

      // Act
      const { shouldBlockUrl } = await import('../src/popup/services/blockService');
      const result = await shouldBlockUrl('https://safe-site.com');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when blocker is active and site is blocked', async () => {
      // Arrange
      const { activateBlocker, getBlockedSites } =
        await import('../src/popup/services/blockService');
      await activateBlocker();
      await getBlockedSites(); // Initialize defaults

      // Act
      const { shouldBlockUrl } = await import('../src/popup/services/blockService');
      const result = await shouldBlockUrl('https://reddit.com');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('validateAndCreateTab', () => {
    beforeEach(() => {
      // Clear tabs.create call history so each test starts fresh
      mocks.tabs.create.mockClear();
    });

    it('should create a tab for a valid http URL', async () => {
      // Arrange
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('https://example.com');

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mocks.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/' }),
      );
    });

    it('should create a tab for a valid https URL', async () => {
      // Arrange
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('https://example.com/page?q=1');

      // Assert
      expect(result.success).toBe(true);
      expect(mocks.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/page?q=1' }),
      );
    });

    it('should return error for an invalid URL', async () => {
      // Arrange
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('not-a-valid-url');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mocks.tabs.create).not.toHaveBeenCalled();
    });

    it('should return error for non-http protocol', async () => {
      // Arrange
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('ftp://files.example.com');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mocks.tabs.create).not.toHaveBeenCalled();
    });

    it('should return error for chrome:// URLs', async () => {
      // Arrange
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('chrome://settings');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mocks.tabs.create).not.toHaveBeenCalled();
    });

    it('should handle chrome.tabs.create failures', async () => {
      // Arrange
      mocks.tabs.create.mockRejectedValueOnce(new Error('Tab creation failed'));
      const { validateAndCreateTab } = await import('../src/popup/services/blockService');

      // Act
      const result = await validateAndCreateTab('https://example.com');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab creation failed');
    });
  });
});
