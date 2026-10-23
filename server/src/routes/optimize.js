import express from 'express';
import cache from '../cache/redisClient.js';
import { fetchHistoricalDataWithCache } from '../services/dataService.js';
import { runBacktest } from '../services/backtestEngine.js';

const router = express.Router();

/**
 * POST /api/optimize
 * Executes parameter grid search across Fast and Slow MA permutations
 * Returns Sharpe Ratio and ROI matrix for quantitative parameter surface optimization
 */
router.post('/', async (req, res) => {
  const start = performance.now();

  try {
    const {
      symbol = 'BTC',
      market = 'crypto',
      strategy = 'SMA_CROSSOVER',
      capital = 10000,
      feeBps = 10,
      slippageBps = 5,
      days = 365,
      fastRange = [5, 9, 12, 16, 20],
      slowRange = [21, 26, 35, 50, 100]
    } = req.body;

    const normSymbol = symbol.toUpperCase();
    const cacheKey = `optimize:${normSymbol}:${market}:${strategy}:${fastRange.join('-')}:${slowRange.join('-')}:${days}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      const duration = Math.round(performance.now() - start);
      res.set('X-Cache', 'HIT');
      return res.json({
        ...JSON.parse(cached),
        cached: true,
        replayTimeMs: duration
      });
    }

    // Fetch candles once
    const quoteResponse = await fetchHistoricalDataWithCache(normSymbol, market, days);
    const candles = quoteResponse.data;

    const grid = [];
    let bestSharpe = -Infinity;
    let optimalParams = null;

    for (const fast of fastRange) {
      for (const slow of slowRange) {
        if (slow <= fast) continue;

        const result = runBacktest(candles, {
          strategy,
          params: { fast, slow },
          capital: Number(capital),
          feeBps: Number(feeBps),
          slippageBps: Number(slippageBps),
          market
        });

        const cell = {
          fast,
          slow,
          sharpeRatio: result.metrics.sharpeRatio,
          cumulativeRoi: result.metrics.cumulativeRoi,
          maxDrawdown: result.metrics.maxDrawdown,
          winRate: result.metrics.winRate,
          profitFactor: result.metrics.profitFactor,
          totalTrades: result.metrics.completedTrades
        };

        grid.push(cell);

        if (cell.sharpeRatio > bestSharpe) {
          bestSharpe = cell.sharpeRatio;
          optimalParams = cell;
        }
      }
    }

    const duration = Math.round(performance.now() - start);

    const payload = {
      status: 'success',
      symbol: normSymbol,
      strategy,
      totalPermutations: grid.length,
      optimalParams,
      grid,
      durationMs: duration
    };

    await cache.setEx(cacheKey, 3600, JSON.stringify(payload));
    res.set('X-Cache', 'MISS');
    return res.json(payload);
  } catch (err) {
    console.error('[Route /api/optimize] Error:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

export default router;
