import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StrategyControls from './components/StrategyControls';
import MetricsHUD from './components/MetricsHUD';
import PriceChart from './components/PriceChart';
import EquityChart from './components/EquityChart';
import OptimizerGrid from './components/OptimizerGrid';
import TradesTable from './components/TradesTable';
import WarmupModal from './components/WarmupModal';
import ApiKeyModal from './components/ApiKeyModal';
import { fetchHealth, fetchAssets, executeBacktest, fetchApiKeysConfig } from './services/api';
import { AlertCircle, Terminal, Cpu } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [availableAssets, setAvailableAssets] = useState([
    { symbol: 'BTC', name: 'Bitcoin', market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', market: 'crypto' },
    { symbol: 'SOL', name: 'Solana', market: 'crypto' },
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'stocks' },
    { symbol: 'SPY', name: 'S&P 500 ETF', market: 'stocks' },
    { symbol: 'QQQ', name: 'Invesco QQQ', market: 'stocks' }
  ]);

  const [config, setConfig] = useState({
    symbol: 'BTC',
    market: 'crypto',
    strategy: 'SMA_CROSSOVER',
    params: {
      fast: 9,
      slow: 21,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      trailingStopPct: 5
    },
    capital: 10000,
    feeBps: 10,
    slippageBps: 5,
    days: 365
  });

  const [backtestResult, setBacktestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupRetries, setWarmupRetries] = useState(0);
  const [lastReplayTime, setLastReplayTime] = useState(null);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [keyConfig, setKeyConfig] = useState(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const loadKeyConfig = useCallback(async () => {
    try {
      const data = await fetchApiKeysConfig();
      setKeyConfig(data);
    } catch (err) {
      console.warn('Could not fetch API keys config:', err.message);
    }
  }, []);

  // Poll server health & warmup detection
  const checkHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setIsWarmingUp(false);
      setErrorMsg(null);
      return true;
    } catch (err) {
      console.warn('Health check retry:', err.message);
      setIsWarmingUp(true);
      setWarmupRetries(r => r + 1);
      return false;
    }
  }, []);

  // Initial load: probe server and load assets
  useEffect(() => {
    async function initialize() {
      const isLive = await checkHealth();
      loadKeyConfig();
      try {
        const assets = await fetchAssets('all');
        if (assets && assets.length > 0) {
          setAvailableAssets(assets);
        }
      } catch (err) {
        console.warn('Using fallback asset catalog:', err.message);
      }

      // Automatically trigger initial simulation for immediate rich visualization
      handleRunBacktest();
    }

    initialize();

    // Heartbeat every 25 seconds
    const interval = setInterval(checkHealth, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleRunBacktest = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await executeBacktest(config);
      setBacktestResult(res);
      setLastReplayTime(res.clientLatencyMs);
      setIsCacheHit(res.cacheHit);
    } catch (err) {
      console.error('Backtest error:', err);
      setErrorMsg(err.message || 'Backtest execution failed');
      // If network failure, might be Render cold start
      if (err.message.includes('Failed to fetch')) {
        setIsWarmingUp(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header with Server Telemetry & Replay Speed */}
      <Header
        health={health}
        lastReplayTime={lastReplayTime}
        isCacheHit={isCacheHit}
        keyConfig={keyConfig}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* API Key Connection Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        keyConfig={keyConfig}
        onKeyUpdated={loadKeyConfig}
      />

      {/* Render Cold-Start Graceful Fallback Modal */}
      <WarmupModal
        isWarmingUp={isWarmingUp}
        retryCount={warmupRetries}
        onRetry={checkHealth}
      />

      {/* Error notification banner if any */}
      {errorMsg && (
        <div className="glass-panel p-4 mb-6 border-rose-500/50 bg-rose-950/40 text-rose-300 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={handleRunBacktest}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40"
          >
            Retry Simulation
          </button>
        </div>
      )}

      {/* Strategy Configuration Form & Interactive Sliders */}
      <StrategyControls
        config={config}
        setConfig={setConfig}
        onRunBacktest={handleRunBacktest}
        isLoading={isLoading}
        availableAssets={availableAssets}
      />

      {/* Quant Risk Metrics & HUD Engine Cards */}
      <MetricsHUD
        metrics={backtestResult?.metrics}
        symbol={config.symbol}
      />

      {/* Quantitative Parameter Grid Search & Sharpe Heatmap */}
      <OptimizerGrid
        config={config}
        onApplyParams={(fast, slow) => {
          setConfig(prev => ({
            ...prev,
            params: { ...prev.params, fast, slow }
          }));
        }}
        onRunSimulation={handleRunBacktest}
      />

      {/* Synchronized Panel 1: Asset Price Overlay with Moving Averages & Buy/Sell Flags */}
      <PriceChart
        data={backtestResult?.equityCurve}
        trades={backtestResult?.trades || []}
        symbol={config.symbol}
        fastPeriod={config.params.fast}
        slowPeriod={config.params.slow}
        strategy={config.strategy}
      />

      {/* Synchronized Panel 2: Portfolio Equity Curve & Underwater Drawdown Heat-Fill */}
      <EquityChart
        data={backtestResult?.equityCurve}
        initialCapital={config.capital}
        maxDrawdown={backtestResult?.metrics?.maxDrawdown || 0}
      />

      {/* Chronological Trade Execution Log Table */}
      <TradesTable
        trades={backtestResult?.trades || []}
      />

      {/* Architecture & Engineering Footnote */}
      <footer className="mt-8 pt-4 pb-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Production Stack: React (Vite) + Express (Node 20) + Redis + CoinGecko & Alpha Vantage</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Lookahead Bias: 0% (Signal t → Exec t+1)</span>
          <span>•</span>
          <span>Target Replay: &le;80ms</span>
          <span>•</span>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:underline"
          >
            Health Probe JSON
          </a>
        </div>
      </footer>
    </div>
  );
}
