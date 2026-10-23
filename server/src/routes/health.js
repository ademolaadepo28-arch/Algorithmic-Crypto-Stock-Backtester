import express from 'express';
import cache from '../cache/redisClient.js';
import { apiMetrics, getLimiterQueueStatus } from '../services/dataService.js';

const router = express.Router();
const serverStartTime = Date.now();

/**
 * GET /api/health
 * Returns server health, Redis connection status, memory consumption, rate-limiter quotas
 * No-cache
 */
router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const memoryUsage = process.memoryUsage();
  const cacheStatus = cache.getStatus();
  const limiterQueues = getLimiterQueueStatus();

  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    redis: {
      connected: cacheStatus.connected,
      backendType: cacheStatus.type,
      stats: cacheStatus.stats
    },
    memory: {
      rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
      externalMb: Number((memoryUsage.external / 1024 / 1024).toFixed(2))
    },
    apiQuotas: {
      metrics: apiMetrics,
      queues: limiterQueues,
      alphaVantageCeiling: '5 calls/min (Bottleneck paced at 1 call per 12.5s)',
      coinGeckoCeiling: '30 calls/min (Bottleneck paced at 1 call per 2.0s)'
    }
  });
});

export default router;
