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
  /** Refresh the blocked sites list */
  refresh: () => Promise<void>;
  /** Add a new site to the block list */
  addSite: (domain: string) => Promise<void>;
  /** Remove a site from the block list */
  removeSite: (domain: string) => Promise<void>;
  /** Toggle the blocker on/off */
  toggleActive: () => Promise<void>;
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
      await blockService.addBlockedSite(domain);
      await refresh();
    },
    [refresh],
  );

  /** Removes a domain from the blocked list */
  const removeSite = useCallback(
    async (domain: string) => {
      await blockService.removeBlockedSite(domain);
      await refresh();
    },
    [refresh],
  );

  /** Toggles the blocker active state */
  const toggleActive = useCallback(async () => {
    if (isActive) {
      await blockService.deactivateBlocker();
    } else {
      await blockService.activateBlocker();
    }
    setIsActive(!isActive);
  }, [isActive]);

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
    refresh,
    addSite,
    removeSite,
    toggleActive,
    checkUrl,
  };
}
