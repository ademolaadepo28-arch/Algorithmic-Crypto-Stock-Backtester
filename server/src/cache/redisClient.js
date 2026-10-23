import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

class CacheService {
  constructor() {
    this.redisClient = null;
    this.isRedisConnected = false;
    this.memoryCache = new LRUCache({
      max: 500, // Maximum items in memory cache
      ttl: 1000 * 60 * 60 * 24 // 24 hours default max TTL in ms
    });
    this.stats = {
      hits: 0,
      misses: 0,
      redisHits: 0,
      memoryHits: 0,
      sets: 0
    };

    this.init();
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 2,
          connectTimeout: 4000,
          retryStrategy: (times) => {
            if (times > 3) {
              console.warn('[CacheService] Redis reconnection limit reached. Operating in Memory Cache mode.');
              return null; // Stop retrying
            }
            return Math.min(times * 1000, 3000);
          }
        });

        this.redisClient.on('connect', () => {
          this.isRedisConnected = true;
          console.log('[CacheService] Successfully connected to Redis instance.');
        });

        this.redisClient.on('error', (err) => {
          this.isRedisConnected = false;
          console.warn('[CacheService] Redis error (falling back to In-Memory LRU cache):', err.message);
        });

        this.redisClient.on('close', () => {
          this.isRedisConnected = false;
        });
      } catch (err) {
        console.warn('[CacheService] Failed to initialize Redis client. Using In-Memory LRU cache:', err.message);
      }
    } else {
      console.log('[CacheService] No REDIS_URL provided. Running with high-performance In-Memory LRU cache.');
    }
  }

  async get(key) {
    // 1. Try Redis if connected
    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        if (val !== null && val !== undefined) {
          this.stats.hits++;
          this.stats.redisHits++;
          return val;
        }
      } catch (err) {
        console.warn(`[CacheService] Redis GET error for key ${key}, falling back to memory:`, err.message);
      }
    }

    // 2. Check Memory cache
    const memVal = this.memoryCache.get(key);
    if (memVal !== undefined) {
      this.stats.hits++;
      this.stats.memoryHits++;
      return memVal;
    }

    this.stats.misses++;
    return null;
  }

  async setEx(key, ttlSeconds, value) {
    this.stats.sets++;
    // Write to memory cache (with ms TTL)
    this.memoryCache.set(key, value, { ttl: ttlSeconds * 1000 });

    // Write to Redis if connected
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } catch (err) {
        console.warn(`[CacheService] Redis SETEX error for key ${key}:`, err.message);
      }
    }
  }

  async flushAll() {
    this.memoryCache.clear();
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.flushall();
      } catch (err) {
        console.warn('[CacheService] Redis FLUSHALL error:', err.message);
      }
    }
  }

  getStatus() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((this.stats.hits / totalRequests) * 100).toFixed(1) + '%' : '0.0%';
    return {
      type: this.isRedisConnected ? 'Redis (Connected)' : 'In-Memory LRU Cache',
      connected: this.isRedisConnected,
      stats: {
        ...this.stats,
        totalRequests,
        hitRate,
        memoryCacheItems: this.memoryCache.size
      }
    };
  }
}

export const cache = new CacheService();
export default cache;
