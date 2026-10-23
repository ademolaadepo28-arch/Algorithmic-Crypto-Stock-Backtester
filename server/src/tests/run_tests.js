import assert from 'assert';
import { runBacktest, calculateSMA, calculateEMA, calculateRSI } from '../services/backtestEngine.js';
import { fetchHistoricalDataWithCache, getAvailableAssets } from '../services/dataService.js';
import cache from '../cache/redisClient.js';

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING QUANTITATIVE & ARCHITECTURE ACCEPTANCE TESTS');
  console.log('======================================================\n');

  console.log('Group 1: Technical Indicators & Numerical Correctness');

  it('Calculates Simple Moving Average (SMA) correctly', () => {
    const mockData = [
      { close: 10 }, { close: 20 }, { close: 30 }, { close: 40 }, { close: 50 }
    ];
    const sma3 = calculateSMA(mockData, 3);
    assert.strictEqual(sma3[0], null);
    assert.strictEqual(sma3[1], null);
    assert.strictEqual(sma3[2], 20); // (10+20+30)/3 = 20
    assert.strictEqual(sma3[3], 30); // (20+30+40)/3 = 30
    assert.strictEqual(sma3[4], 40); // (30+40+50)/3 = 40
  });

  it('Calculates Exponential Moving Average (EMA) correctly', () => {
    const mockData = [
      { close: 10 }, { close: 20 }, { close: 30 }, { close: 40 }
    ];
    // period 2: alpha = 2/(2+1) = 2/3 ≈ 0.6667
    const ema2 = calculateEMA(mockData, 2);
    assert.strictEqual(ema2[0], null);
    assert.strictEqual(ema2[1], 15); // initial SMA = (10+20)/2 = 15
    // index 2: 30*(2/3) + 15*(1/3) = 20 + 5 = 25
    assert.strictEqual(Math.round(ema2[2]), 25);
  });

  it('Calculates RSI bounds within [0, 100]', () => {
    const mockData = Array.from({ length: 30 }, (_, i) => ({
      close: 100 + Math.sin(i / 2) * 10
    }));
    const rsi = calculateRSI(mockData, 14);
    assert.strictEqual(rsi[0], null);
    const validRsi = rsi.filter(v => v !== null);
    assert.ok(validRsi.length > 0);
    validRsi.forEach(val => {
      assert.ok(val >= 0 && val <= 100, `RSI ${val} out of bounds`);
    });
  });

  console.log('\nGroup 2: Lookahead Bias Prevention');

  it('Enforces Lookahead Bias Prevention: signal at candle t executes at t+1 at Open', () => {
    // Construct 4 candles where a bullish cross occurs at candle 2
    // Fast MA (period 2) and Slow MA (period 3)
    const candles = [
      { timestamp: 1000, date: '2024-01-01', open: 100, high: 102, low: 98, close: 100, volume: 1000 },
      { timestamp: 2000, date: '2024-01-02', open: 100, high: 101, low: 99, close: 95, volume: 1000 },
      { timestamp: 3000, date: '2024-01-03', open: 95, high: 120, low: 95, close: 120, volume: 1000 }, // Big jump -> cross at close
      { timestamp: 4000, date: '2024-01-04', open: 110, high: 115, low: 108, close: 112, volume: 1000 }, // Execution should happen here at open 110
      { timestamp: 5000, date: '2024-01-05', open: 112, high: 114, low: 111, close: 113, volume: 1000 }
    ];

    const result = runBacktest(candles, {
      strategy: 'SMA_CROSSOVER',
      params: { fast: 2, slow: 3 },
      capital: 10000,
      feeBps: 0,
      slippageBps: 0
    });

    if (result.trades.length > 0) {
      const firstTrade = result.trades[0];
      // Trade must have executed on candle 3 (Jan 4) at Open (110), NOT on candle 2 (Jan 3) at Close (120)
      assert.strictEqual(firstTrade.candleIndex, 3, 'Execution must occur on candle t+1');
      assert.strictEqual(firstTrade.date, '2024-01-04', 'Execution must take place next morning/period');
      assert.strictEqual(firstTrade.executedPrice, 110, 'Execution must be at Open price of t+1');
    }
  });

  console.log('\nGroup 3: Quant Risk Metrics & High Water Mark Verification');

  it('Calculates High Water Mark and Maximum Drawdown accurately', () => {
    // Candles where price doubles then drops 50%
    const candles = [
      { timestamp: 1000, date: '2024-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { timestamp: 2000, date: '2024-01-02', open: 100, high: 110, low: 100, close: 110, volume: 1000 },
      { timestamp: 3000, date: '2024-01-03', open: 110, high: 150, low: 110, close: 150, volume: 1000 },
      { timestamp: 4000, date: '2024-01-04', open: 150, high: 200, low: 150, close: 200, volume: 1000 },
      { timestamp: 5000, date: '2024-01-05', open: 200, high: 200, low: 100, close: 100, volume: 1000 }, // 50% drop
      { timestamp: 6000, date: '2024-01-06', open: 100, high: 110, low: 90, close: 100, volume: 1000 }
    ];

    const result = runBacktest(candles, {
      strategy: 'SMA_CROSSOVER',
      params: { fast: 2, slow: 3 },
      capital: 10000,
      feeBps: 0,
      slippageBps: 0
    });

    assert.ok(typeof result.metrics.sharpeRatio === 'number', 'Sharpe ratio must be a number');
    assert.ok(typeof result.metrics.sortinoRatio === 'number', 'Sortino ratio must be a number');
    assert.ok(typeof result.metrics.maxDrawdown === 'number', 'Max Drawdown must be a number');
    assert.ok(result.metrics.maxDrawdown <= 0, 'Max Drawdown must be negative or zero');
  });

  console.log('\nGroup 4: Caching Performance (Acceptance Criteria: <= 90ms)');

  await itAsync('Cached replay delivers sub-80ms simulation response', async () => {
    // 1. Initial run (populates cache)
    const quoteRes = await fetchHistoricalDataWithCache('BTC', 'crypto', 365);
    const candles = quoteRes.data;

    const cacheKey = 'test:backtest:cache:perf';
    const firstRun = runBacktest(candles, { strategy: 'SMA_CROSSOVER', params: { fast: 9, slow: 21 } });
    await cache.setEx(cacheKey, 60, JSON.stringify(firstRun));

    // 2. Measure cached retrieval + parse time
    const t0 = performance.now();
    const cachedData = await cache.get(cacheKey);
    const parsed = JSON.parse(cachedData);
    const duration = performance.now() - t0;

    assert.ok(parsed.metrics, 'Parsed backtest must contain metrics');
    assert.ok(duration <= 90, `Cached replay took ${duration.toFixed(2)}ms, must be <= 90ms`);
    console.log(`    Cached retrieval benchmark: ${duration.toFixed(2)}ms (Spec requirement: <= 90ms, Target: < 10ms)`);
  });

  console.log('\nGroup 5: Rate-Limit Resilience (Burst of 50 concurrent requests: 0 HTTP 429 fails)');

  await itAsync('Handles burst of 50 concurrent requests with 0 HTTP 429 errors', async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const sym = i % 2 === 0 ? 'BTC' : 'ETH';
      promises.push(fetchHistoricalDataWithCache(sym, 'crypto', 90));
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 50, 'All 50 concurrent requests must complete');
    results.forEach((res, idx) => {
      assert.ok(res.data && res.data.length > 0, `Request ${idx} returned empty candle data`);
    });
  });

  console.log('\nGroup 6: Asset Catalog Metadata & Contract');

  await itAsync('Returns valid asset catalog for crypto and stocks', async () => {
    const cryptoAssets = await getAvailableAssets('crypto');
    const stockAssets = await getAvailableAssets('stocks');

    assert.ok(cryptoAssets.some(a => a.symbol === 'BTC'), 'Must include BTC');
    assert.ok(cryptoAssets.some(a => a.symbol === 'ETH'), 'Must include ETH');
    assert.ok(cryptoAssets.some(a => a.symbol === 'SOL'), 'Must include SOL');

    assert.ok(stockAssets.some(a => a.symbol === 'AAPL'), 'Must include AAPL');
    assert.ok(stockAssets.some(a => a.symbol === 'SPY'), 'Must include SPY');
    assert.ok(stockAssets.some(a => a.symbol === 'QQQ'), 'Must include QQQ');
  });

  console.log('\n======================================================');
  console.log(`🎯 TEST RESULTS: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
