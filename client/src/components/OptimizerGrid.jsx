import React, { useState } from 'react';
import { Grid, Sparkles, CheckCircle2, ChevronRight, Activity, ArrowRight } from 'lucide-react';
import { executeOptimizer } from '../services/api';

export default function OptimizerGrid({ config, onApplyParams, onRunSimulation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const fastOptions = [5, 9, 12, 16, 20];
  const slowOptions = [21, 26, 35, 50, 100];

  const runGridSearch = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const data = await executeOptimizer({
        symbol: config.symbol,
        market: config.market,
        strategy: config.strategy,
        capital: config.capital,
        feeBps: config.feeBps,
        slippageBps: config.slippageBps,
        days: config.days,
        fastRange: fastOptions,
        slowRange: slowOptions
      });
      setResults(data);
    } catch (err) {
      setError(err.message || 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const getSharpeColor = (sharpe) => {
    if (sharpe >= 1.5) return 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/50';
    if (sharpe >= 0.8) return 'bg-cyan-500/25 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/40';
    if (sharpe >= 0) return 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/35';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/35';
  };

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-cyan-400" />
          <h3 className="font-heading font-semibold text-sm text-slate-200">
            QUANTITATIVE PARAMETER GRID SEARCH & SHARPE HEATMAP
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            OPTIMIZER
          </span>
        </div>

        <button
          type="button"
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          <span>{isOpen ? 'Collapse Matrix' : 'Expand Matrix'}</span>
          <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Scan across Fast & Slow Moving Average parameter spaces to compute the empirical Sharpe surface. Click any cell to immediately backtest that parameter pair.
            </p>

            <button
              onClick={runGridSearch}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isOptimizing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Computing Matrix...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>RUN PARAMETER GRID SEARCH</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {results?.optimalParams && (
            <div className="mb-4 p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-heading font-semibold text-white">OPTIMAL EMPIRICAL CONFIG:</span>
                <span className="text-xs font-mono text-emerald-300 font-bold">
                  Fast: {results.optimalParams.fast} / Slow: {results.optimalParams.slow}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  (Sharpe: <strong className="text-cyan-300">{results.optimalParams.sharpeRatio}</strong>, ROI: <strong className="text-emerald-300">{results.optimalParams.cumulativeRoi}%</strong>, MDD: {results.optimalParams.maxDrawdown}%)
                </span>
              </div>

              <button
                onClick={() => {
                  onApplyParams(results.optimalParams.fast, results.optimalParams.slow);
                  onRunSimulation();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-heading font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
              >
                <span>Apply Optimal Parameters</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {results?.grid && (
            <div className="overflow-x-auto">
              <div className="text-[11px] font-mono text-slate-400 mb-2 flex justify-between">
                <span>Y-Axis: Fast MA &bull; X-Axis: Slow MA</span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/40" /> &gt;1.5
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-cyan-500/40 ml-2" /> 0.8–1.5
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40 ml-2" /> 0.0–0.8
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500/40 ml-2" /> &lt;0
                </span>
              </div>

              <table className="w-full text-center font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2 px-3 text-left">Fast \ Slow</th>
                    {slowOptions.map(s => (
                      <th key={s} className="py-2 px-3">Slow {s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fastOptions.map(f => (
                    <tr key={f}>
                      <td className="py-2.5 px-3 text-left font-semibold text-slate-300">
                        Fast {f}
                      </td>
                      {slowOptions.map(s => {
                        const cell = results.grid.find(c => c.fast === f && c.slow === s);
                        if (!cell) {
                          return (
                            <td key={s} className="py-2 px-2 text-slate-600">
                              -
                            </td>
                          );
                        }

                        const isSelected = config.params.fast === f && config.params.slow === s;

                        return (
                          <td key={s} className="py-1 px-1">
                            <button
                              onClick={() => {
                                onApplyParams(f, s);
                                onRunSimulation();
                              }}
                              className={`w-full py-2 px-1 rounded-md border text-[11px] transition-all cursor-pointer ${getSharpeColor(cell.sharpeRatio)} ${
                                isSelected ? 'ring-2 ring-white font-bold' : ''
                              }`}
                              title={`Fast: ${f}, Slow: ${s}\nSharpe: ${cell.sharpeRatio}\nROI: ${cell.cumulativeRoi}%\nDrawdown: ${cell.maxDrawdown}%\nTrades: ${cell.totalTrades}`}
                            >
                              <div className="font-bold">{cell.sharpeRatio}</div>
                              <div className="text-[9px] opacity-80">{cell.cumulativeRoi}%</div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
