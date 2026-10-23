import React from 'react';
import { TrendingUp, TrendingDown, Target, Award, ShieldAlert, BarChart3, ArrowUpRight, Scale } from 'lucide-react';

export default function MetricsHUD({ metrics, symbol }) {
  if (!metrics) return null;

  const isProfit = metrics.cumulativeRoi >= 0;
  const isAlpha = metrics.cumulativeRoi > metrics.benchmarkRoi;

  // Rating badges for Sharpe
  const getSharpeBadge = (val) => {
    if (val >= 2.0) return { text: 'EXCELLENT', color: 'badge-green' };
    if (val >= 1.0) return { text: 'GOOD', color: 'badge-cyan' };
    if (val > 0) return { text: 'MODERATE', color: 'badge-amber' };
    return { text: 'SUB-OPTIMAL', color: 'badge-red' };
  };

  const sharpeBadge = getSharpeBadge(metrics.sharpeRatio);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Cumulative ROI & Alpha */}
      <div className="glass-panel p-4 glass-card-interactive relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">CUMULATIVE ROI</span>
          {isProfit ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div className={`font-mono text-2xl font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isProfit ? '+' : ''}{metrics.cumulativeRoi}%
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
          <span>vs B&H ({symbol}):</span>
          <span className={`font-mono font-semibold ${isAlpha ? 'text-emerald-400' : 'text-slate-400'}`}>
            {metrics.benchmarkRoi >= 0 ? '+' : ''}{metrics.benchmarkRoi}%
          </span>
        </div>
      </div>

      {/* 2. Sharpe Ratio */}
      <div className="glass-panel p-4 glass-card-interactive relative">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">SHARPE RATIO</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${sharpeBadge.color}`}>
            {sharpeBadge.text}
          </span>
        </div>
        <div className="font-mono text-2xl font-bold text-cyan-300">
          {metrics.sharpeRatio}
        </div>
        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
          <span>Rf: {metrics.riskFreeRate}%</span>
          <span className="text-slate-500">√{metrics.annualTradingDays}</span>
        </div>
      </div>

      {/* 3. Sortino Ratio */}
      <div className="glass-panel p-4 glass-card-interactive">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">SORTINO RATIO</span>
          <Award className="w-4 h-4 text-purple-400" />
        </div>
        <div className="font-mono text-2xl font-bold text-purple-300">
          {metrics.sortinoRatio}
        </div>
        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
          <span>Downside Risk Only</span>
        </div>
      </div>

      {/* 4. Maximum Peak-to-Trough Drawdown */}
      <div className="glass-panel p-4 glass-card-interactive">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">MAX DRAWDOWN</span>
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>
        <div className="font-mono text-2xl font-bold text-rose-400">
          {metrics.maxDrawdown}%
        </div>
        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span>Ann. Return:</span>
          <span className="font-mono font-semibold text-slate-300">
            {metrics.annualizedReturn >= 0 ? '+' : ''}{metrics.annualizedReturn}%
          </span>
        </div>
      </div>

      {/* 5. Win Rate & Trades */}
      <div className="glass-panel p-4 glass-card-interactive">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">WIN RATE</span>
          <Target className="w-4 h-4 text-amber-400" />
        </div>
        <div className="font-mono text-2xl font-bold text-amber-300">
          {metrics.winRate}%
        </div>
        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
          <span>Trades: {metrics.completedTrades}</span>
          <span className="text-emerald-400">W:{metrics.winningTrades}</span>
          <span className="text-rose-400">L:{metrics.losingTrades}</span>
        </div>
      </div>

      {/* 6. Profit Factor & Friction */}
      <div className="glass-panel p-4 glass-card-interactive">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">PROFIT FACTOR</span>
          <Scale className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="font-mono text-2xl font-bold text-cyan-200">
          {metrics.profitFactor}
        </div>
        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
          <span>Fees: ${metrics.totalCommissionsPaid}</span>
          <span title="Slippage cost">Slip: ${metrics.totalSlippageCost}</span>
        </div>
      </div>
    </div>
  );
}
