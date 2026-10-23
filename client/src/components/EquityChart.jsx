import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

function EquityTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="custom-chart-tooltip">
      <div className="text-xs text-slate-400 border-b border-slate-700/80 pb-1 mb-1.5 flex justify-between font-mono">
        <span className="font-semibold text-slate-200">{data.date}</span>
        <span className={data.drawdown < -5 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
          DD: {data.drawdown}%
        </span>
      </div>

      <div className="space-y-1 text-[11px] font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-purple-400">Portfolio Equity:</span>
          <span className="font-bold text-white">${data.equity?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Cash Balance:</span>
          <span className="text-slate-300">${data.cash?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Position Value:</span>
          <span className="text-cyan-300">${data.positionValue?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 text-[10px]">
          <span className="text-slate-500">High Water Mark:</span>
          <span className="text-slate-400">${data.highWaterMark?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function EquityChart({ data, initialCapital, maxDrawdown }) {
  if (!data || data.length === 0) return null;

  const equities = data.map(d => d.equity).filter(Boolean);
  const minEquity = Math.min(...equities) * 0.95;
  const maxEquity = Math.max(...equities) * 1.05;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Panel 2A: Portfolio Equity Curve (2 Cols) */}
      <div className="glass-panel p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
            <h3 className="font-heading font-semibold text-sm text-slate-200">
              PANEL 2: PORTFOLIO EQUITY CURVE & CAPITAL TRAJECTORY
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Initial: ${initialCapital?.toLocaleString()}</span>
            <span className="text-purple-400 font-bold">
              Final: ${data[data.length - 1]?.equity?.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="h-64 w-full" style={{ minHeight: '260px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} syncId="backtestCharts" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                minTickGap={40}
                fontFamily="JetBrains Mono"
              />
              <YAxis
                domain={[minEquity, maxEquity]}
                stroke="#64748b"
                fontSize={11}
                orientation="right"
                tickLine={false}
                tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                fontFamily="JetBrains Mono"
              />
              <Tooltip content={<EquityTooltip />} />

              {/* Initial Capital Baseline */}
              <ReferenceLine y={initialCapital} stroke="#475569" strokeDasharray="4 4" />

              {/* Equity Fill Area */}
              <Area
                type="monotone"
                dataKey="equity"
                fill="url(#equityGradient)"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />

              {/* High Water Mark Baseline */}
              <Line
                type="stepAfter"
                dataKey="highWaterMark"
                name="High Water Mark"
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Panel 2B: Real-time Underwater Drawdown Heat-Fill (1 Col) */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <h3 className="font-heading font-semibold text-sm text-slate-200">
              UNDERWATER DRAWDOWN
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-rose-400">
            MDD: {maxDrawdown}%
          </span>
        </div>

        <div className="h-64 w-full" style={{ minHeight: '260px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} syncId="backtestCharts" margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.05} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.65} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                minTickGap={30}
                fontFamily="JetBrains Mono"
              />
              <YAxis
                domain={['dataMin', 0]}
                stroke="#64748b"
                fontSize={10}
                orientation="right"
                tickLine={false}
                tickFormatter={v => `${v.toFixed(0)}%`}
                fontFamily="JetBrains Mono"
              />
              <Tooltip content={<EquityTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />

              {/* Underwater Heat-Fill Area */}
              <Area
                type="monotone"
                dataKey="drawdown"
                fill="url(#drawdownGradient)"
                stroke="#f43f5e"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
