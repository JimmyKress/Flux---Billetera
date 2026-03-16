import { useRef, useCallback } from 'react';
import { requestCoordinator } from './requestCoordinator.js';

// Global notification cache and request coordination
const notificationCache = new Map();
const pendingRequests = new Map();
const lastFetchTimes = new Map();

// Minimum time between fetches for the same CUIT (milliseconds)
const MIN_FETCH_INTERVAL = 2000; // 2 seconds
const CACHE_DURATION = 10000; // 10 seconds cache

export const useNotificationService = () => {
  const fetchWithCoordination = useCallback(async (cuit, apiCall) => {
    if (!cuit) return null;

    // Use the request coordinator for notification requests
    return requestCoordinator.fetchNotifications(cuit);
  }, []);

  const invalidateCache = useCallback((cuit) => {
    if (cuit) {
      requestCoordinator.invalidateCache(`/notificaciones/${cuit}`);
      notificationCache.delete(cuit);
      lastFetchTimes.delete(cuit);
    }
  }, []);

  const clearAllCache = useCallback(() => {
    requestCoordinator.clearAllCaches();
    notificationCache.clear();
    pendingRequests.clear();
    lastFetchTimes.clear();
  }, []);

  return {
    fetchWithCoordination,
    invalidateCache,
    clearAllCache
  };
};

// Non-hook version for use outside components
export const notificationService = {
  async fetchWithCoordination(cuit, apiCall) {
    if (!cuit) return null;

    // Use the request coordinator for notification requests
    return requestCoordinator.fetchNotifications(cuit);
  },

  invalidateCache(cuit) {
    if (cuit) {
      requestCoordinator.invalidateCache(`/notificaciones/${cuit}`);
      notificationCache.delete(cuit);
      lastFetchTimes.delete(cuit);
    }
  },

  clearAllCache() {
    requestCoordinator.clearAllCaches();
    notificationCache.clear();
    pendingRequests.clear();
    lastFetchTimes.clear();
  }
};
