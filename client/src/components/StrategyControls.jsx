import React from 'react';
import { Sliders, Play, RotateCcw, TrendingUp, Sparkles, DollarSign, Percent, ShieldCheck } from 'lucide-react';

const PRESETS = [
  {
    name: 'Crypto Momentum',
    strategy: 'SMA_CROSSOVER',
    symbol: 'BTC',
    market: 'crypto',
    fast: 9,
    slow: 21,
    desc: 'Fast 9 / Slow 21 crossover for crypto trends'
  },
  {
    name: 'Golden Cross',
    strategy: 'SMA_CROSSOVER',
    symbol: 'SPY',
    market: 'stocks',
    fast: 50,
    slow: 200,
    desc: 'Classic 50 / 200 institutional trend filter'
  },
  {
    name: 'EMA Reactive Scalp',
    strategy: 'EMA_CROSSOVER',
    symbol: 'ETH',
    market: 'crypto',
    fast: 5,
    slow: 13,
    desc: 'Rapid EMA crossover for volatile swings'
  },
  {
    name: 'RSI Mean Reversion',
    strategy: 'RSI_BOUNDS',
    symbol: 'AAPL',
    market: 'stocks',
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    desc: 'Buy oversold bounces (<30), sell overbought (>70)'
  },
  {
    name: 'Trailing Protect',
    strategy: 'TRAILING_STOP',
    symbol: 'SOL',
    market: 'crypto',
    fast: 12,
    slow: 26,
    trailingStopPct: 5,
    desc: 'Trend entry with 5% trailing stop-loss'
  }
];

export default function StrategyControls({
  config,
  setConfig,
  onRunBacktest,
  isLoading,
  availableAssets
}) {
  const currentAssets = availableAssets.filter(
    a => config.market === 'all' || a.market === config.market
  );

  const applyPreset = (preset) => {
    setConfig(prev => ({
      ...prev,
      symbol: preset.symbol || prev.symbol,
      market: preset.market || prev.market,
      strategy: preset.strategy,
      params: {
        ...prev.params,
        fast: preset.fast !== undefined ? preset.fast : prev.params.fast,
        slow: preset.slow !== undefined ? preset.slow : prev.params.slow,
        rsiPeriod: preset.rsiPeriod !== undefined ? preset.rsiPeriod : prev.params.rsiPeriod,
        rsiOversold: preset.rsiOversold !== undefined ? preset.rsiOversold : prev.params.rsiOversold,
        rsiOverbought: preset.rsiOverbought !== undefined ? preset.rsiOverbought : prev.params.rsiOverbought,
        trailingStopPct: preset.trailingStopPct !== undefined ? preset.trailingStopPct : prev.params.trailingStopPct
      }
    }));
  };

  return (
    <div className="glass-panel p-5 mb-6">
      {/* Header and Preset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="font-heading font-semibold text-sm tracking-wide text-slate-200 uppercase">
            STRATEGY CONFIGURATION & ORDER EXECUTION MATRIX
          </h2>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
          </span>
          {PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 font-mono transition-all"
              title={p.desc}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Market & Asset Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Asset & Market</span>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    market: 'crypto',
                    symbol: 'BTC'
                  }));
                }}
                className={`px-2 py-0.5 rounded font-mono ${
                  config.market === 'crypto'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Crypto
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    market: 'stocks',
                    symbol: 'AAPL'
                  }));
                }}
                className={`px-2 py-0.5 rounded font-mono ${
                  config.market === 'stocks'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stocks
              </button>
            </div>
          </label>

          <select
            value={config.symbol}
            onChange={e => {
              const selectedSymbol = e.target.value;
              const asset = availableAssets.find(a => a.symbol === selectedSymbol);
              setConfig(prev => ({
                ...prev,
                symbol: selectedSymbol,
                market: asset ? asset.market : prev.market
              }));
            }}
            className="custom-input font-bold text-cyan-300 bg-slate-900 cursor-pointer"
          >
            {currentAssets.map(a => (
              <option key={a.symbol} value={a.symbol} className="bg-slate-900 text-white">
                {a.symbol} - {a.name} ({a.market.toUpperCase()})
              </option>
            ))}
          </select>

          {/* Timeframe selector */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Time Horizon:</span>
            <div className="flex gap-1 font-mono">
              {[90, 180, 365].map(d => (
                <button
                  key={d}
                  onClick={() => setConfig(prev => ({ ...prev, days: d }))}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    config.days === d
                      ? 'bg-slate-700 text-cyan-300 font-bold border border-slate-600'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Algorithm Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Algorithm Strategy</span>
            <span className="text-[10px] text-cyan-400 font-mono">Signal at Close_t</span>
          </label>
          <select
            value={config.strategy}
            onChange={e => setConfig(prev => ({ ...prev, strategy: e.target.value }))}
            className="custom-input bg-slate-900 cursor-pointer font-medium"
          >
            <option value="SMA_CROSSOVER" className="bg-slate-900 text-white">Fast/Slow SMA Crossover</option>
            <option value="EMA_CROSSOVER" className="bg-slate-900 text-white">Fast/Slow EMA Crossover</option>
            <option value="RSI_BOUNDS" className="bg-slate-900 text-white">RSI Bounds (Mean Reversion)</option>
            <option value="TRAILING_STOP" className="bg-slate-900 text-white">Trend Following + Trailing Stop</option>
          </select>

          <p className="text-[11px] text-slate-400">
            {config.strategy === 'SMA_CROSSOVER' && 'Simple moving average crossover with 0-lookahead execution.'}
            {config.strategy === 'EMA_CROSSOVER' && 'Exponential moving average with exponential α weighting.'}
            {config.strategy === 'RSI_BOUNDS' && 'Wilders RSI momentum oscillator overbought/oversold boundaries.'}
            {config.strategy === 'TRAILING_STOP' && 'Dynamic high-water mark trailing stop-loss risk containment.'}
          </p>
        </div>

        {/* Dynamic Strategy Parameters */}
        <div className="space-y-2">
          {config.strategy === 'RSI_BOUNDS' ? (
            <>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>RSI Period: {config.params.rsiPeriod}</span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {config.params.rsiOversold} / {config.params.rsiOverbought}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={config.params.rsiPeriod || 14}
                onChange={e => setConfig(prev => ({
                  ...prev,
                  params: { ...prev.params, rsiPeriod: parseInt(e.target.value, 10) }
                }))}
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400">Oversold:</span>
                  <input
                    type="number"
                    value={config.params.rsiOversold || 30}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      params: { ...prev.params, rsiOversold: parseFloat(e.target.value) }
                    }))}
                    className="custom-input text-xs py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Overbought:</span>
                  <input
                    type="number"
                    value={config.params.rsiOverbought || 70}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      params: { ...prev.params, rsiOverbought: parseFloat(e.target.value) }
                    }))}
                    className="custom-input text-xs py-1"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Fast MA: <span className="text-cyan-400 font-mono">{config.params.fast}</span></span>
                <span>Slow MA: <span className="text-amber-400 font-mono">{config.params.slow}</span></span>
              </div>
              <div className="space-y-1.5">
                <input
                  type="range"
                  min="2"
                  max="50"
                  value={config.params.fast}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    params: { ...prev.params, fast: parseInt(e.target.value, 10) }
                  }))}
                />
                <input
                  type="range"
                  min={Math.max(10, config.params.fast + 1)}
                  max="200"
                  value={config.params.slow}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    params: { ...prev.params, slow: parseInt(e.target.value, 10) }
                  }))}
                />
              </div>

              {config.strategy === 'TRAILING_STOP' && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Trailing Stop:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="20"
                      value={config.params.trailingStopPct || 5}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        params: { ...prev.params, trailingStopPct: parseFloat(e.target.value) }
                      }))}
                      className="custom-input text-xs w-16 py-0.5 text-right"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Portfolio Capital & Execution Friction */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Portfolio & Slippage</span>
            <span className="text-[10px] text-emerald-400 font-mono">No Optimistic Bias</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <DollarSign className="w-3 h-3 text-emerald-400" /> Capital ($)
              </span>
              <input
                type="number"
                step="500"
                min="1000"
                value={config.capital}
                onChange={e => setConfig(prev => ({ ...prev, capital: parseFloat(e.target.value) || 10000 }))}
                className="custom-input text-xs py-1"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Percent className="w-3 h-3 text-amber-400" /> Fee (bps)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                value={config.feeBps}
                onChange={e => setConfig(prev => ({ ...prev, feeBps: parseInt(e.target.value, 10) || 0 }))}
                className="custom-input text-xs py-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Slippage: {config.slippageBps} bps (0.05%)</span>
            <span className="font-mono text-cyan-400">Open_(t+1) Exec</span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Single-pass chronological vector pipeline with 100% lookahead bias prevention</span>
        </div>

        <button
          onClick={onRunBacktest}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-heading font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-slate-950" />
              <span>RUN BACKTEST</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
