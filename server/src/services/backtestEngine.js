/**
 * High-Performance Vectorized Algorithmic Backtesting Engine
 *
 * Implements:
 * 1. Fast/Slow SMA crossover
 * 2. Fast/Slow EMA crossover
 * 3. RSI bounds strategy
 * 4. Trailing stop-loss & take-profit
 * 5. Strict Lookahead Bias Prevention (Signal at t using Close_t -> Execution at t+1 at Open_t+1)
 * 6. Slippage (0.05% default) and trade commission fee (10 bps default)
 * 7. Quant Risk Metrics: Sharpe Ratio, Sortino Ratio, Max Peak-to-Trough Drawdown (MDD),
 *    Cumulative ROI, Annualized Return, Win/Loss Ratio, Profit Factor, Benchmark Return
 */

export function calculateSMA(data, period) {
  const sma = new Array(data.length).fill(null);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) {
      sum -= data[i - period].close;
    }
    if (i >= period - 1) {
      sma[i] = Number((sum / period).toFixed(4));
    }
  }
  return sma;
}

export function calculateEMA(data, period) {
  const ema = new Array(data.length).fill(null);
  const alpha = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEMA = sum / period;
  ema[period - 1] = Number(prevEMA.toFixed(4));

  for (let i = period; i < data.length; i++) {
    const current = data[i].close * alpha + prevEMA * (1 - alpha);
    ema[i] = Number(current.toFixed(4));
    prevEMA = current;
  }
  return ema;
}

export function calculateRSI(data, period = 14) {
  const rsi = new Array(data.length).fill(null);
  if (data.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : Number((100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = Number((100 - (100 / (1 + rs))).toFixed(2));
    }
  }

  return rsi;
}

/**
 * Executes backtest simulation
 *
 * @param {Array} candles Normalized OHLCV daily candle array [{ timestamp, open, high, low, close, volume }]
 * @param {Object} options Configuration parameters:
 *   - strategy: 'SMA_CROSSOVER' | 'EMA_CROSSOVER' | 'RSI_BOUNDS' | 'TRAILING_STOP'
 *   - params: { fast: 9, slow: 21, rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, trailingStopPct: 5 }
 *   - capital: initial capital (default: 10000)
 *   - feeBps: commission fee in basis points (default: 10 bps = 0.10%)
 *   - slippageBps: slippage in basis points (default: 5 bps = 0.05%)
 *   - market: 'crypto' (365 trading days/yr) | 'stocks' (252 trading days/yr)
 *   - riskFreeRate: annual risk-free rate (default 0.04 = 4.0%)
 */
export function runBacktest(candles, options = {}) {
  const {
    strategy = 'SMA_CROSSOVER',
    params = {},
    capital = 10000,
    feeBps = 10,
    slippageBps = 5,
    market = 'crypto',
    riskFreeRate = 0.04
  } = options;

  const fastPeriod = Math.max(2, parseInt(params.fast || 9, 10));
  const slowPeriod = Math.max(fastPeriod + 1, parseInt(params.slow || 21, 10));
  const rsiPeriod = Math.max(2, parseInt(params.rsiPeriod || 14, 10));
  const rsiOversold = parseFloat(params.rsiOversold || 30);
  const rsiOverbought = parseFloat(params.rsiOverbought || 70);
  const trailingStopPct = parseFloat(params.trailingStopPct || 5); // 5% trailing stop

  const feeRate = feeBps / 10000;
  const slippageRate = slippageBps / 10000;
  const annualTradingDays = market === 'stocks' ? 252 : 365;

  if (!candles || candles.length < slowPeriod) {
    throw new Error(`Insufficient candle data for backtest. Requires at least ${slowPeriod} candles.`);
  }

  // Pre-calculate technical indicators
  let fastSeries = [];
  let slowSeries = [];
  let rsiSeries = [];

  if (strategy === 'EMA_CROSSOVER') {
    fastSeries = calculateEMA(candles, fastPeriod);
    slowSeries = calculateEMA(candles, slowPeriod);
  } else {
    // Default SMA
    fastSeries = calculateSMA(candles, fastPeriod);
    slowSeries = calculateSMA(candles, slowPeriod);
  }

  rsiSeries = calculateRSI(candles, rsiPeriod);

  // Backtest simulation state
  let cash = capital;
  let positionSize = 0; // Quantity of asset held
  let entryPrice = 0;
  let highestPriceSinceEntry = 0;
  let totalCommissionsPaid = 0;
  let totalSlippageCost = 0;

  const trades = [];
  const equityCurve = [];
  let tradeCounter = 1;

  // Signal state to prevent lookahead bias
  // Signal generated on candle t using Close_t is scheduled for execution on candle t+1 at Open_t+1
  let pendingSignal = null; // { type: 'BUY' | 'SELL', reason: string, signalIndex: number, signalPrice: number }

  const startIndex = Math.max(slowPeriod, rsiPeriod);

  for (let t = 0; t < candles.length; t++) {
    const candle = candles[t];
    const { timestamp, date, open, high, low, close } = candle;

    // --- STEP 1: EXECUTE PENDING ORDER AT OPEN_{t} (NO LOOKAHEAD BIAS) ---
    if (pendingSignal && t > pendingSignal.signalIndex) {
      if (pendingSignal.type === 'BUY' && positionSize === 0 && cash > 0) {
        // Buy order execution at Open with upward slippage
        const executionPrice = open * (1 + slippageRate);
        const slippagePerUnit = executionPrice - open;

        // Reserve fee from available cash
        const maxInvestable = cash / (1 + feeRate);
        const quantity = maxInvestable / executionPrice;
        const grossValue = quantity * executionPrice;
        const fee = grossValue * feeRate;
        const totalCost = grossValue + fee;

        if (quantity > 0 && totalCost <= cash + 0.01) {
          positionSize = quantity;
          cash = Math.max(0, cash - totalCost);
          entryPrice = executionPrice;
          highestPriceSinceEntry = executionPrice;
          totalCommissionsPaid += fee;
          totalSlippageCost += slippagePerUnit * quantity;

          trades.push({
            id: tradeCounter++,
            type: 'BUY',
            timestamp,
            date,
            candleIndex: t,
            nominalPrice: open,
            executedPrice: Number(executionPrice.toFixed(4)),
            size: Number(quantity.toFixed(6)),
            value: Number(grossValue.toFixed(2)),
            fee: Number(fee.toFixed(2)),
            slippage: Number((slippagePerUnit * quantity).toFixed(2)),
            reason: pendingSignal.reason,
            cashRemaining: Number(cash.toFixed(2)),
            pnl: 0,
            pnlPercent: 0
          });
        }
      } else if (pendingSignal.type === 'SELL' && positionSize > 0) {
        // Sell order execution at Open with downward slippage
        const executionPrice = open * (1 - slippageRate);
        const slippagePerUnit = open - executionPrice;
        const grossValue = positionSize * executionPrice;
        const fee = grossValue * feeRate;
        const netProceeds = grossValue - fee;

        const costBasis = positionSize * entryPrice;
        const tradePnl = netProceeds - costBasis;
        const tradePnlPercent = ((executionPrice - entryPrice) / entryPrice) * 100;

        cash += netProceeds;
        totalCommissionsPaid += fee;
        totalSlippageCost += slippagePerUnit * positionSize;

        trades.push({
          id: tradeCounter++,
          type: 'SELL',
          timestamp,
          date,
          candleIndex: t,
          nominalPrice: open,
          executedPrice: Number(executionPrice.toFixed(4)),
          size: Number(positionSize.toFixed(6)),
          value: Number(grossValue.toFixed(2)),
          fee: Number(fee.toFixed(2)),
          slippage: Number((slippagePerUnit * positionSize).toFixed(2)),
          reason: pendingSignal.reason,
          cashRemaining: Number(cash.toFixed(2)),
          pnl: Number(tradePnl.toFixed(2)),
          pnlPercent: Number(tradePnlPercent.toFixed(2))
        });

        positionSize = 0;
        entryPrice = 0;
        highestPriceSinceEntry = 0;
      }

      // Reset pending signal once evaluated
      pendingSignal = null;
    }

    // --- STEP 2: UPDATE INTRADAY PEAKS & CHECK TRAILING STOP ---
    if (positionSize > 0) {
      if (high > highestPriceSinceEntry) {
        highestPriceSinceEntry = high;
      }

      // Check trailing stop condition during day t
      if (trailingStopPct > 0 && highestPriceSinceEntry > 0) {
        const trailingStopPrice = highestPriceSinceEntry * (1 - trailingStopPct / 100);
        if (low <= trailingStopPrice) {
          // Trailing stop trigger: set sell signal for next open (or immediate execution)
          pendingSignal = {
            type: 'SELL',
            reason: `Trailing Stop Hit (${trailingStopPct}%)`,
            signalIndex: t,
            signalPrice: close
          };
        }
      }
    }

    // --- STEP 3: STRATEGY SIGNAL EVALUATION AT CLOSE_{t} ---
    // Only evaluate new directional signals after warmup period
    if (t >= startIndex && !pendingSignal) {
      const fastCurr = fastSeries[t];
      const fastPrev = fastSeries[t - 1];
      const slowCurr = slowSeries[t];
      const slowPrev = slowSeries[t - 1];
      const rsiCurr = rsiSeries[t];
      const rsiPrev = rsiSeries[t - 1];

      let generatedSignal = null;

      if (strategy === 'SMA_CROSSOVER' || strategy === 'EMA_CROSSOVER') {
        if (fastPrev !== null && slowPrev !== null && fastCurr !== null && slowCurr !== null) {
          const bullishCross = fastPrev <= slowPrev && fastCurr > slowCurr;
          const bearishCross = fastPrev >= slowPrev && fastCurr < slowCurr;

          if (bullishCross && positionSize === 0) {
            generatedSignal = {
              type: 'BUY',
              reason: `${strategy === 'EMA_CROSSOVER' ? 'EMA' : 'SMA'} Bullish Crossover (${fastPeriod}/${slowPeriod})`,
              signalIndex: t,
              signalPrice: close
            };
          } else if (bearishCross && positionSize > 0) {
            generatedSignal = {
              type: 'SELL',
              reason: `${strategy === 'EMA_CROSSOVER' ? 'EMA' : 'SMA'} Bearish Crossover (${fastPeriod}/${slowPeriod})`,
              signalIndex: t,
              signalPrice: close
            };
          }
        }
      } else if (strategy === 'RSI_BOUNDS') {
        if (rsiPrev !== null && rsiCurr !== null) {
          // Buy on oversold bounce (crosses back above oversold)
          const oversoldRebound = rsiPrev <= rsiOversold && rsiCurr > rsiOversold;
          // Sell on overbought cross (crosses above overbought threshold)
          const overboughtCross = rsiPrev < rsiOverbought && rsiCurr >= rsiOverbought;

          if (oversoldRebound && positionSize === 0) {
            generatedSignal = {
              type: 'BUY',
              reason: `RSI Oversold Bounce (RSI=${rsiCurr})`,
              signalIndex: t,
              signalPrice: close
            };
          } else if (overboughtCross && positionSize > 0) {
            generatedSignal = {
              type: 'SELL',
              reason: `RSI Overbought Level (RSI=${rsiCurr})`,
              signalIndex: t,
              signalPrice: close
            };
          }
        }
      } else if (strategy === 'TRAILING_STOP') {
        // Trend following with trailing stop: Buy on SMA fast > slow
        if (fastCurr !== null && slowCurr !== null) {
          if (fastCurr > slowCurr && positionSize === 0) {
            generatedSignal = {
              type: 'BUY',
              reason: `Trend Follow Buy (Fast ${fastCurr} > Slow ${slowCurr})`,
              signalIndex: t,
              signalPrice: close
            };
          }
        }
      }

      if (generatedSignal) {
        pendingSignal = generatedSignal;
      }
    }

    // --- STEP 4: RECORD CURRENT DAY'S EQUITY & DRAWDOWN ---
    const positionValue = positionSize * close;
    const currentEquity = Number((cash + positionValue).toFixed(2));

    equityCurve.push({
      timestamp,
      date,
      close,
      open,
      high,
      low,
      volume: candle.volume,
      fastMA: fastSeries[t] ?? null,
      slowMA: slowSeries[t] ?? null,
      rsi: rsiSeries[t] ?? null,
      equity: currentEquity,
      cash: Number(cash.toFixed(2)),
      positionSize: Number(positionSize.toFixed(6)),
      positionValue: Number(positionValue.toFixed(2)),
      signal: pendingSignal && pendingSignal.signalIndex === t ? pendingSignal.type : null,
      signalReason: pendingSignal && pendingSignal.signalIndex === t ? pendingSignal.reason : null
    });
  }

  // --- STEP 5: CALCULATE QUANT RISK METRICS ---
  let highWaterMark = capital;
  let maxDrawdown = 0;

  // Add high water mark & drawdown to equity points
  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];
    if (pt.equity > highWaterMark) {
      highWaterMark = pt.equity;
    }
    const dd = (pt.equity - highWaterMark) / highWaterMark;
    pt.drawdown = Number((dd * 100).toFixed(2)); // percentage
    pt.highWaterMark = Number(highWaterMark.toFixed(2));

    if (dd < maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  // Calculate daily returns for Sharpe & Sortino
  const dailyReturns = [];
  const dailyExcessReturns = [];
  const dailyRiskFreeRate = riskFreeRate / annualTradingDays;

  for (let i = 1; i < equityCurve.length; i++) {
    const prevEq = equityCurve[i - 1].equity;
    const currEq = equityCurve[i].equity;
    const ret = prevEq > 0 ? (currEq - prevEq) / prevEq : 0;
    const excess = ret - dailyRiskFreeRate;

    dailyReturns.push(ret);
    dailyExcessReturns.push(excess);
  }

  const n = dailyReturns.length;
  let meanExcess = 0;
  let stdDevReturns = 0;
  let downsideVariance = 0;

  if (n > 1) {
    const sumExcess = dailyExcessReturns.reduce((acc, v) => acc + v, 0);
    meanExcess = sumExcess / n;

    const meanReturn = dailyReturns.reduce((acc, v) => acc + v, 0) / n;
    const variance = dailyReturns.reduce((acc, v) => acc + Math.pow(v - meanReturn, 2), 0) / (n - 1);
    stdDevReturns = Math.sqrt(Math.max(0, variance));

    // Downside deviation (only negative excess returns)
    const negativeExcess = dailyExcessReturns.filter(e => e < 0);
    if (negativeExcess.length > 0) {
      const sumNegSq = negativeExcess.reduce((acc, v) => acc + Math.pow(v, 2), 0);
      downsideVariance = sumNegSq / n;
    }
  }

  const downsideDeviation = Math.sqrt(downsideVariance);
  const annualizedFactor = Math.sqrt(annualTradingDays);

  const sharpeRatio = stdDevReturns > 0 ? (meanExcess / stdDevReturns) * annualizedFactor : 0;
  const sortinoRatio = downsideDeviation > 0 ? (meanExcess / downsideDeviation) * annualizedFactor : 0;

  // Trade analytics
  const sellTrades = trades.filter(t => t.type === 'SELL');
  const winningTrades = sellTrades.filter(t => t.pnl > 0);
  const losingTrades = sellTrades.filter(t => t.pnl < 0);

  const totalGrossProfits = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const totalGrossLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));

  const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;
  const winLossRatio = losingTrades.length > 0 ? winningTrades.length / losingTrades.length : winningTrades.length;
  const profitFactor = totalGrossLosses > 0 ? totalGrossProfits / totalGrossLosses : totalGrossProfits > 0 ? totalGrossProfits : 1.0;

  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : capital;
  const cumulativeRoi = ((finalEquity - capital) / capital) * 100;

  const totalDays = candles.length;
  const annualizedReturn = totalDays > 0 ? (Math.pow(finalEquity / capital, annualTradingDays / totalDays) - 1) * 100 : 0;

  // Benchmark return (Buy & Hold)
  const initialAssetPrice = candles[0].close;
  const finalAssetPrice = candles[candles.length - 1].close;
  const benchmarkReturn = ((finalAssetPrice - initialAssetPrice) / initialAssetPrice) * 100;

  return {
    strategy,
    params: {
      fast: fastPeriod,
      slow: slowPeriod,
      rsiPeriod,
      rsiOversold,
      rsiOverbought,
      trailingStopPct
    },
    capital,
    metrics: {
      initialCapital: capital,
      finalEquity: Number(finalEquity.toFixed(2)),
      cumulativeRoi: Number(cumulativeRoi.toFixed(2)),
      annualizedReturn: Number(annualizedReturn.toFixed(2)),
      benchmarkRoi: Number(benchmarkReturn.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(3)),
      sortinoRatio: Number(sortinoRatio.toFixed(3)),
      maxDrawdown: Number((maxDrawdown * 100).toFixed(2)), // e.g. -12.45%
      winRate: Number(winRate.toFixed(1)),
      winLossRatio: Number(winLossRatio.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
      totalTrades: trades.length,
      completedTrades: sellTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalCommissionsPaid: Number(totalCommissionsPaid.toFixed(2)),
      totalSlippageCost: Number(totalSlippageCost.toFixed(2)),
      annualTradingDays,
      riskFreeRate: Number((riskFreeRate * 100).toFixed(1))
    },
    trades,
    equityCurve
  };
}
