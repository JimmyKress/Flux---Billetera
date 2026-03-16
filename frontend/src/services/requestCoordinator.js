import api from '../api/axiosClient';

// Global request queue and rate limiting
const requestQueue = new Map();
const activeRequests = new Map();
const requestTimestamps = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
  'notificaciones': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  'default': { maxRequests: 30, windowMs: 60000 } // 30 requests per minute
};

class RequestCoordinator {
  constructor() {
    this.requestCache = new Map();
    this.pendingRequests = new Map();
    this.requestCounts = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000); // Cleanup every 30 seconds
  }

  cleanup() {
    const now = Date.now();
    
    // Clean up old request timestamps
    for (const [key, timestamps] of this.requestCounts.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < 60000);
      if (validTimestamps.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, validTimestamps);
      }
    }

    // Clean up expired cache entries
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > 30000) { // 30 seconds cache
        this.requestCache.delete(key);
      }
    }
  }

  getRateLimitKey(url) {
    if (url.includes('/notificaciones')) return 'notificaciones';
    return 'default';
  }

  isRateLimited(key) {
    const limit = RATE_LIMITS[key];
    const now = Date.now();
    const timestamps = this.requestCounts.get(key) || [];
    const recentTimestamps = timestamps.filter(ts => now - ts < limit.windowMs);
    
    if (recentTimestamps.length >= limit.maxRequests) {
      return true;
    }
    
    this.requestCounts.set(key, [...recentTimestamps, now]);
    return false;
  }

  async executeRequest(url, requestFn, options = {}) {
    const cacheKey = `${url}:${JSON.stringify(options.params || {})}`;
    const rateLimitKey = this.getRateLimitKey(url);
    const now = Date.now();

    // Check cache first
    if (!options.skipCache && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey);
      if (now - cached.timestamp < 30000) { // 30 seconds cache
        return cached.data;
      }
    }

    // Check rate limiting
    if (this.isRateLimited(rateLimitKey)) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.executeRequest(url, requestFn, options);
    }

    // Check if there's already a pending request for the same resource
    if (this.pendingRequests.has(cacheKey)) {
      try {
        return await this.pendingRequests.get(cacheKey);
      } catch (error) {
        // If pending request fails, proceed with new request
      }
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        const response = await requestFn();
        
        // Cache successful response
        if (!options.skipCache) {
          this.requestCache.set(cacheKey, {
            data: response.data,
            timestamp: now
          });
        }
        
        return response.data;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(cacheKey);
      }
    })();

    // Store pending request
    this.pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  // Specific method for notification requests
  async fetchNotifications(cuit) {
    return this.executeRequest(
      `/notificaciones/${cuit}`,
      () => api.get(`/notificaciones/${cuit}`),
      { skipCache: false }
    );
  }

  // Invalidate cache for specific resource
  invalidateCache(url, params = {}) {
    const cacheKey = `${url}:${JSON.stringify(params)}`;
    this.requestCache.delete(cacheKey);
  }

  // Clear all caches
  clearAllCaches() {
    this.requestCache.clear();
    this.pendingRequests.clear();
    this.requestCounts.clear();
  }

  // Get request statistics
  getStats() {
    return {
      cacheSize: this.requestCache.size,
      pendingRequests: this.pendingRequests.size,
      requestCounts: Object.fromEntries(this.requestCounts)
    };
  }
}

// Global instance
export const requestCoordinator = new RequestCoordinator();

// Enhanced API wrapper with request coordination
export const coordinatedApi = {
  get: (url, config = {}) => {
    return requestCoordinator.executeRequest(
      url,
      () => api.get(url, config),
      { params: config.params, skipCache: config.skipCache }
    );
  },

  post: (url, data, config = {}) => {
    // POST requests invalidate cache by default
    requestCoordinator.invalidateCache(url);
    return api.post(url, data, config);
  },

  put: (url, data, config = {}) => {
    // PUT requests invalidate cache by default
    requestCoordinator.invalidateCache(url);
    return api.put(url, data, config);
  },

  patch: (url, data, config = {}) => {
    // PATCH requests invalidate cache by default
    requestCoordinator.invalidateCache(url);
    return api.patch(url, data, config);
  },

  delete: (url, config = {}) => {
    // DELETE requests invalidate cache by default
    requestCoordinator.invalidateCache(url);
    return api.delete(url, config);
  }
};

export default requestCoordinator;
