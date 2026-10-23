import express from 'express';
import { fetchHistoricalDataWithCache } from '../services/dataService.js';

const router = express.Router();

/**
 * GET /api/quotes
 * Query params: symbol=BTC, days=365, market=crypto|stocks
 * Cached: 12h TTL
 */
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const symbol = (req.query.symbol || 'BTC').toUpperCase();
    const market = req.query.market || (['BTC', 'ETH', 'SOL'].includes(symbol) ? 'crypto' : 'stocks');
    const days = parseInt(req.query.days || '365', 10);

    const result = await fetchHistoricalDataWithCache(symbol, market, days);
    const duration = Date.now() - start;

    res.set('X-Cache', result.source === 'cache' ? 'HIT' : 'MISS');
    res.set('X-Response-Time', `${duration}ms`);

    return res.json({
      status: 'success',
      symbol,
      market,
      days,
      count: result.data.length,
      cached: result.source === 'cache',
      responseTimeMs: duration,
      quotes: result.data
    });
  } catch (err) {
    console.error('[Route /api/quotes] Error:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

export default router;
