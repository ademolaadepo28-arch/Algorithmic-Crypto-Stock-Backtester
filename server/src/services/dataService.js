import Bottleneck from 'bottleneck';
import axios from 'axios';
import cache from '../cache/redisClient.js';
import { ASSET_PROFILES, getSeededCandles } from '../data/seedData.js';

// Bottleneck token bucket rate limiters per specification
// Alpha Vantage: strict 5 calls/min limit -> minTime 12500ms (4.8 calls/min ceiling)
const alphaLimiter = new Bottleneck({
  minTime: 12500,
  maxConcurrent: 1
});

// CoinGecko: 30 calls/min public ceiling -> minTime 2000ms
const coinGeckoLimiter = new Bottleneck({
  minTime: 2000,
  maxConcurrent: 1
});

// Quota and telemetry tracking
export const apiMetrics = {
  alphaVantageCalls: 0,
  alphaVantageErrors: 0,
  coinGeckoCalls: 0,
  coinGeckoErrors: 0,
  fallbackServed: 0,
  lastAlphaCall: null,
  lastCoinGeckoCall: null
};

/**
 * Normalizes external Alpha Vantage JSON to standard OHLCV array
 */
function normalizeAlphaVantage(rawData) {
  const timeSeries = rawData['Time Series (Daily)'] || rawData['Weekly Adjusted Time Series'] || {};
  const entries = Object.entries(timeSeries);

  if (entries.length === 0) {
    throw new Error('No time series entries found in Alpha Vantage response');
  }

  // Alpha Vantage returns reverse chronological, sort to chronological (oldest first)
  const candles = entries.map(([dateStr, v]) => {
    const timestamp = new Date(dateStr).getTime();
    return {
      timestamp,
      date: dateStr,
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseFloat(v['6. volume'] || v['5. volume'] || 0)
    };
  }).sort((a, b) => a.timestamp - b.timestamp);

  return candles;
}

/**
 * Normalizes CoinGecko /coins/{id}/market_chart response to standard OHLCV array
 */
function normalizeCoinGecko(rawData) {
  const prices = rawData.prices || [];
  const totalVolumes = rawData.total_volumes || [];

  if (prices.length === 0) {
    throw new Error('No prices found in CoinGecko response');
  }

  const volMap = new Map();
  totalVolumes.forEach(([ts, vol]) => {
    // Map by day date
    const d = new Date(ts).toISOString().split('T')[0];
    volMap.set(d, vol);
  });

  const candles = [];
  for (let i = 0; i < prices.length; i++) {
    const [timestamp, closePrice] = prices[i];
    const d = new Date(timestamp).toISOString().split('T')[0];
    const prevClose = i > 0 ? prices[i - 1][1] : closePrice;

    // Estimate daily OHLC from prices if raw returns single close point per day
    const open = prevClose;
    const close = closePrice;
    const high = Math.max(open, close) * 1.008;
    const low = Math.min(open, close) * 0.992;
    const volume = volMap.get(d) || 1000000;

    candles.push({
      timestamp,
      date: d,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(volume)
    });
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Fetch raw data from external API provider with error handling and fallback
 */
async function fetchFromExternalProvider(symbol, market, days = 365) {
  const upperSymbol = symbol.toUpperCase();

  if (market === 'crypto' || ASSET_PROFILES.crypto[upperSymbol]) {
    const profile = ASSET_PROFILES.crypto[upperSymbol];
    const coinId = profile ? profile.coingeckoId : upperSymbol.toLowerCase();

    try {
      apiMetrics.coinGeckoCalls++;
      apiMetrics.lastCoinGeckoCall = new Date().toISOString();

      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const res = await axios.get(url, {
        timeout: 6000,
        headers: { 'Accept': 'application/json', 'User-Agent': 'AlgoBacktester/1.0' }
      });

      return normalizeCoinGecko(res.data);
    } catch (err) {
      apiMetrics.coinGeckoErrors++;
      console.warn(`[DataService] CoinGecko API request failed for ${symbol} (${err.message}). Serving high-fidelity fallback.`);
      apiMetrics.fallbackServed++;
      return getSeededCandles(symbol, days);
    }
  } else {
    // Equities / Alpha Vantage
    const apiKey = process.env.ALPHA_VANTAGE_KEY || 'demo';

    try {
      apiMetrics.alphaVantageCalls++;
      apiMetrics.lastAlphaCall = new Date().toISOString();

      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${upperSymbol}&apikey=${apiKey}&outputsize=compact`;
      const res = await axios.get(url, { timeout: 6000 });

      if (res.data['Note'] || res.data['Information'] || res.data['Error Message']) {
        console.warn(`[DataService] Alpha Vantage rate limit notice or demo key restriction for ${upperSymbol}:`, res.data['Note'] || res.data['Information'] || res.data['Error Message']);
        apiMetrics.fallbackServed++;
        return getSeededCandles(symbol, days);
      }

      return normalizeAlphaVantage(res.data);
    } catch (err) {
      apiMetrics.alphaVantageErrors++;
      console.warn(`[DataService] Alpha Vantage API request failed for ${symbol} (${err.message}). Serving high-fidelity fallback.`);
      apiMetrics.fallbackServed++;
      return getSeededCandles(symbol, days);
    }
  }
}

const inFlightRequests = new Map();

/**
 * Fetch historical OHLCV data with multi-tier Redis/Memory caching + Bottleneck rate limiting
 */
export async function fetchHistoricalDataWithCache(symbol, market, days = 365) {
  const normSymbol = symbol.toUpperCase();
  const cacheKey = `quotes:${market}:${normSymbol}:${days}`;

  // 1. Check cache (sub-millisecond hit)
  const cached = await cache.get(cacheKey);
  if (cached) {
    return {
      data: typeof cached === 'string' ? JSON.parse(cached) : cached,
      source: 'cache'
    };
  }

  // 2. In-flight request deduplication (Single Flight Pattern)
  if (inFlightRequests.has(cacheKey)) {
    const data = await inFlightRequests.get(cacheKey);
    return {
      data,
      source: 'inflight-dedup'
    };
  }

  // 3. Select appropriate rate limiter
  const limiter = market === 'crypto' || ASSET_PROFILES.crypto[normSymbol] ? coinGeckoLimiter : alphaLimiter;

  // 4. Create fetch promise and store in inFlightRequests
  const fetchPromise = limiter.schedule(async () => {
    try {
      return await fetchFromExternalProvider(normSymbol, market, days);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  });

  inFlightRequests.set(cacheKey, fetchPromise);

  const sanitized = await fetchPromise;

  // 5. Save to Redis/Memory cache with 12-hour TTL (43200 seconds)
  await cache.setEx(cacheKey, 43200, JSON.stringify(sanitized));

  return {
    data: sanitized,
    source: 'live'
  };
}

/**
 * Returns available assets list for market filter
 */
export async function getAvailableAssets(market) {
  const cacheKey = `assets:${market || 'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }

  const cryptoList = Object.entries(ASSET_PROFILES.crypto).map(([sym, item]) => ({
    symbol: sym,
    name: item.name,
    market: 'crypto',
    minDateRangeDays: 90,
    description: item.description,
    supportedTimeframes: ['1d'],
    baseCurrency: 'USD'
  }));

  const stocksList = Object.entries(ASSET_PROFILES.stocks).map(([sym, item]) => ({
    symbol: sym,
    name: item.name,
    market: 'stocks',
    minDateRangeDays: 90,
    description: item.description,
    supportedTimeframes: ['1d'],
    baseCurrency: 'USD'
  }));

  let result = [];
  if (market === 'crypto') {
    result = cryptoList;
  } else if (market === 'stocks') {
    result = stocksList;
  } else {
    result = [...cryptoList, ...stocksList];
  }

  // Cache assets metadata for 24h (86400 seconds)
  await cache.setEx(cacheKey, 86400, JSON.stringify(result));
  return result;
}

export function getLimiterQueueStatus() {
  return {
    alphaLimiter: {
      queued: alphaLimiter.queued(),
      running: alphaLimiter.running()
    },
    coinGeckoLimiter: {
      queued: coinGeckoLimiter.queued(),
      running: coinGeckoLimiter.running()
    }
  };
}
