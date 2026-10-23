import express from 'express';
import { getAvailableAssets } from '../services/dataService.js';

const router = express.Router();

/**
 * GET /api/assets
 * Query params: market=crypto|stocks|all
 * Cached: 24h TTL
 */
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const market = req.query.market || 'all';
    const assets = await getAvailableAssets(market);

    res.set('X-Response-Time', `${Date.now() - start}ms`);
    return res.json({
      status: 'success',
      market,
      count: assets.length,
      data: assets
    });
  } catch (err) {
    console.error('[Route /api/assets] Error:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

export default router;
