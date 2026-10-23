import express from 'express';
import cache from '../cache/redisClient.js';
import { fetchHistoricalDataWithCache } from '../services/dataService.js';
import { runBacktest } from '../services/backtestEngine.js';

const router = express.Router();

/**
 * POST /api/backtest
 * Payload:
 * {
 *   symbol: "BTC",
 *   market: "crypto",
 *   strategy: "SMA_CROSSOVER" | "EMA_CROSSOVER" | "RSI_BOUNDS" | "TRAILING_STOP",
 *   params: { fast: 9, slow: 21, rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, trailingStopPct: 5 },
 *   capital: 10000,
 *   feeBps: 10,
 *   slippageBps: 5,
 *   days: 365
 * }
 * Cached: 1h TTL (3600 seconds)
 */
router.post('/', async (req, res) => {
  const start = performance.now();

  try {
    const {
      symbol = 'BTC',
      market = ['BTC', 'ETH', 'SOL'].includes((req.body.symbol || '').toUpperCase()) ? 'crypto' : 'stocks',
      strategy = 'SMA_CROSSOVER',
      params = { fast: 9, slow: 21 },
      capital = 10000,
      feeBps = 10,
      slippageBps = 5,
      days = 365
    } = req.body;

    const normSymbol = symbol.toUpperCase();
    const sortedParamKey = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join(',');
    const cacheKey = `backtest:${normSymbol}:${market}:${strategy}:${sortedParamKey}:${capital}:${feeBps}:${slippageBps}:${days}`;

    // 1. Check Redis / In-Memory Cache (Sub-80ms target)
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      const duration = Math.round(performance.now() - start);
      const parsed = typeof cachedResult === 'string' ? JSON.parse(cachedResult) : cachedResult;

      res.set('X-Cache', 'HIT');
      res.set('X-Response-Time', `${duration}ms`);

      return res.json({
        ...parsed,
        cached: true,
        replayTimeMs: duration
      });
    }

    // 2. Fetch candles (using cached quotes if available)
    const quoteResponse = await fetchHistoricalDataWithCache(normSymbol, market, days);
    const candles = quoteResponse.data;

    // 3. Execute Vectorized Backtest Simulation
    const backtestResult = runBacktest(candles, {
      strategy,
      params,
      capital: Number(capital),
      feeBps: Number(feeBps),
      slippageBps: Number(slippageBps),
      market
    });

    const duration = Math.round(performance.now() - start);

    const payload = {
      status: 'success',
      symbol: normSymbol,
      market,
      strategy,
      params: backtestResult.params,
      capital: backtestResult.capital,
      candleCount: candles.length,
      metrics: backtestResult.metrics,
      trades: backtestResult.trades,
      equityCurve: backtestResult.equityCurve,
      cached: false,
      replayTimeMs: duration
    };

    // 4. Save to Cache with 1-hour TTL (3600 seconds)
    await cache.setEx(cacheKey, 3600, JSON.stringify(payload));

    res.set('X-Cache', 'MISS');
    res.set('X-Response-Time', `${duration}ms`);

    return res.json(payload);
  } catch (err) {
    console.error('[Route /api/backtest] Error:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

export default router;
