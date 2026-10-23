/**
 * High-fidelity realistic daily price sequences for default assets (365 daily candles)
 * Used as high-reliability baseline and offline/fallback when external APIs are rate limited or unconfigured.
 */

function generateRealisticCandles(symbol, startPrice, endPrice, volatility, days = 365) {
  const candles = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startTime = now - days * dayMs;

  let currentPrice = startPrice;
  // Calculate daily drift to reach approximately endPrice
  const totalReturn = Math.log(endPrice / startPrice);
  const dailyDrift = totalReturn / days;

  // Use a deterministic seed generator for consistency
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 100000;
  }

  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < days; i++) {
    const timestamp = startTime + i * dayMs;

    // Daily return with drift + noise
    const u1 = Math.max(0.0001, pseudoRandom());
    const u2 = pseudoRandom();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2); // Box-Muller

    const returnPct = dailyDrift + z * volatility;
    const open = Number(currentPrice.toFixed(2));
    const close = Number(Math.max(1, currentPrice * Math.exp(returnPct)).toFixed(2));

    const highFactor = 1 + Math.abs(pseudoRandom() * volatility * 1.8);
    const lowFactor = 1 - Math.abs(pseudoRandom() * volatility * 1.8);
    const high = Number(Math.max(open, close, open * highFactor).toFixed(2));
    const low = Number(Math.min(open, close, open * lowFactor).toFixed(2));

    const baseVolume = startPrice > 500 ? 50000 : 2000000;
    const volume = Math.round(baseVolume * (0.6 + pseudoRandom() * 0.8));

    candles.push({
      timestamp,
      date: new Date(timestamp).toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
  }

  return candles;
}

// Pre-seeded standard asset profiles
export const ASSET_PROFILES = {
  crypto: {
    BTC: {
      name: 'Bitcoin',
      coingeckoId: 'bitcoin',
      market: 'crypto',
      startPrice: 28000,
      endPrice: 65000,
      volatility: 0.024,
      description: 'Bitcoin / US Dollar (BTC/USD)'
    },
    ETH: {
      name: 'Ethereum',
      coingeckoId: 'ethereum',
      market: 'crypto',
      startPrice: 1600,
      endPrice: 3400,
      volatility: 0.029,
      description: 'Ethereum / US Dollar (ETH/USD)'
    },
    SOL: {
      name: 'Solana',
      coingeckoId: 'solana',
      market: 'crypto',
      startPrice: 22,
      endPrice: 175,
      volatility: 0.042,
      description: 'Solana / US Dollar (SOL/USD)'
    }
  },
  stocks: {
    AAPL: {
      name: 'Apple Inc.',
      symbol: 'AAPL',
      market: 'stocks',
      startPrice: 170,
      endPrice: 230,
      volatility: 0.012,
      description: 'Apple Inc. Common Stock'
    },
    SPY: {
      name: 'SPDR S&P 500 ETF',
      symbol: 'SPY',
      market: 'stocks',
      startPrice: 420,
      endPrice: 560,
      volatility: 0.008,
      description: 'SPDR S&P 500 ETF Trust'
    },
    QQQ: {
      name: 'Invesco QQQ Trust',
      symbol: 'QQQ',
      market: 'stocks',
      startPrice: 360,
      endPrice: 480,
      volatility: 0.013,
      description: 'Invesco QQQ Trust Series 1 (Nasdaq 100)'
    }
  }
};

export function getSeededCandles(symbol, days = 365) {
  const sym = symbol.toUpperCase();
  let profile = ASSET_PROFILES.crypto[sym] || ASSET_PROFILES.stocks[sym];
  if (!profile) {
    // Generic fallback profile
    profile = {
      name: sym,
      market: 'crypto',
      startPrice: 100,
      endPrice: 180,
      volatility: 0.025,
      description: `${sym} Asset`
    };
  }

  return generateRealisticCandles(sym, profile.startPrice, profile.endPrice, profile.volatility, days);
}
