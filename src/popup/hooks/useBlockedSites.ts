/**
 * useBlockedSites hook — manages the distraction blocker's blocked sites list.
 * Provides the list of blocked sites and actions to add/remove sites.
 */

import { useState, useEffect, useCallback } from 'react';
import type { BlockedSite } from '../types';
import * as blockService from '../services/blockService';

/** Return type for the useBlockedSites hook */
interface UseBlockedSitesReturn {
  /** List of all blocked sites */
  sites: BlockedSite[];
  /** Whether the blocker is currently active */
  isActive: boolean;
  /** Whether sites are loading */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Refresh the blocked sites list */
  refresh: () => Promise<void>;
  /** Add a new site to the block list */
  addSite: (domain: string) => Promise<void>;
  /** Remove a site from the block list */
  removeSite: (domain: string) => Promise<void>;
  /** Toggle the blocker on/off */
  toggleActive: () => Promise<void>;
  /** Force the blocker on (focus mode start) */
  activate: () => Promise<void>;
  /** Force the blocker off (focus mode end) */
  deactivate: () => Promise<void>;
  /** Check if a specific URL is blocked */
  checkUrl: (url: string) => Promise<boolean>;
}

/**
 * Hook for managing the distraction blocker feature.
 * Handles the blocked sites list and the active/inactive state.
 */
export function useBlockedSites(): UseBlockedSitesReturn {
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetches the blocked sites and active state */
  const refresh = useCallback(async () => {
    try {
      const [blockedSites, active] = await Promise.all([
        blockService.getBlockedSites(),
        blockService.isBlockerActive(),
      ]);
      setSites(blockedSites);
      setIsActive(active);
    } catch (err) {
      console.error('Error loading blocked sites:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Adds a domain to the blocked list */
  const addSite = useCallback(
    async (domain: string) => {
      try {
        setError(null);
        await blockService.addBlockedSite(domain);
        await refresh();
      } catch (err) {
        setError('Failed to add blocked site');
        console.error('Error adding blocked site:', err);
        throw err;
      }
    },
    [refresh],
  );

  /** Removes a domain from the blocked list */
  const removeSite = useCallback(
    async (domain: string) => {
      try {
        setError(null);
        await blockService.removeBlockedSite(domain);
        await refresh();
      } catch (err) {
        setError('Failed to remove blocked site');
        console.error('Error removing blocked site:', err);
        throw err;
      }
    },
    [refresh],
  );

  /** Toggles the blocker active state */
  const toggleActive = useCallback(async () => {
    try {
      setError(null);
      if (isActive) {
        await blockService.deactivateBlocker();
      } else {
        await blockService.activateBlocker();
      }
      setIsActive(!isActive);
    } catch (err) {
      setError('Failed to toggle blocker');
      console.error('Error toggling blocker:', err);
      throw err;
    }
  }, [isActive]);

  /** Forces the blocker on (used when focus mode starts) */
  const activate = useCallback(async () => {
    try {
      setError(null);
      await blockService.activateBlocker();
      setIsActive(true);
    } catch (err) {
      setError('Failed to activate blocker');
      console.error('Error activating blocker:', err);
      throw err;
    }
  }, []);

  /** Forces the blocker off (used when focus mode ends) */
  const deactivate = useCallback(async () => {
    try {
      setError(null);
      await blockService.deactivateBlocker();
      setIsActive(false);
    } catch (err) {
      setError('Failed to deactivate blocker');
      console.error('Error deactivating blocker:', err);
      throw err;
    }
  }, []);

  /** Checks if a URL should be blocked */
  const checkUrl = useCallback(async (url: string): Promise<boolean> => {
    return blockService.shouldBlockUrl(url);
  }, []);

  // Load blocked sites on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    sites,
    isActive,
    isLoading,
    error,
    refresh,
    addSite,
    removeSite,
    toggleActive,
    activate,
    deactivate,
    checkUrl,
  };
}
