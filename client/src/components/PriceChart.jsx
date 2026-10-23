import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceDot
} from 'recharts';

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="custom-chart-tooltip">
      <div className="text-xs text-slate-400 border-b border-slate-700/80 pb-1 mb-1.5 flex justify-between">
        <span className="font-semibold text-slate-200">{data.date}</span>
        {data.signal && (
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
            data.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }`}>
            SIGNAL: {data.signal}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div>
          <span className="text-slate-400">Close: </span>
          <span className="font-bold text-white">${data.close?.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400">Open: </span>
          <span className="text-slate-300">${data.open?.toLocaleString()}</span>
        </div>
        {data.fastMA !== null && (
          <div>
            <span className="text-cyan-400">Fast MA: </span>
            <span className="font-bold text-cyan-300">${data.fastMA}</span>
          </div>
        )}
        {data.slowMA !== null && (
          <div>
            <span className="text-amber-400">Slow MA: </span>
            <span className="font-bold text-amber-300">${data.slowMA}</span>
          </div>
        )}
        {data.rsi !== null && (
          <div>
            <span className="text-purple-400">RSI: </span>
            <span className="font-bold text-purple-300">{data.rsi}</span>
          </div>
        )}
        <div>
          <span className="text-slate-400">Vol: </span>
          <span className="text-slate-300">{data.volume ? (data.volume / 1000).toFixed(0) + 'k' : '-'}</span>
        </div>
      </div>

      {data.signalReason && (
        <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] text-cyan-300 italic">
          Trigger: {data.signalReason}
        </div>
      )}
    </div>
  );
}

export default function PriceChart({ data, trades, symbol, fastPeriod, slowPeriod, strategy }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel p-6 h-80 flex items-center justify-center text-slate-500 font-mono">
        No price series loaded. Click RUN BACKTEST to simulate.
      </div>
    );
  }

  // Find min and max for price axis padding
  const prices = data.map(d => d.close).filter(Boolean);
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;

  // Filter trades for reference dots
  const buyTrades = trades.filter(t => t.type === 'BUY');
  const sellTrades = trades.filter(t => t.type === 'SELL');

  return (
    <div className="glass-panel p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
          <h3 className="font-heading font-semibold text-sm text-slate-200">
            PANEL 1: ASSET PRICE & STRATEGY EXECUTION OVERLAY ({symbol})
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
            Fast ({fastPeriod})
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" />
            Slow ({slowPeriod})
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            ▲ BUY ({buyTrades.length})
          </span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            ▼ SELL ({sellTrades.length})
          </span>
        </div>
      </div>

      <div className="h-80 w-full" style={{ minHeight: '320px' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} syncId="backtestCharts" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              domain={[minPrice, maxPrice]}
              stroke="#64748b"
              fontSize={11}
              orientation="right"
              tickLine={false}
              tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
              fontFamily="JetBrains Mono"
            />
            <Tooltip content={<PriceTooltip />} />

            {/* Asset Close Price Line */}
            <Line
              type="monotone"
              dataKey="close"
              name="Price"
              stroke="#94a3b8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Fast Moving Average */}
            <Line
              type="monotone"
              dataKey="fastMA"
              name={`Fast MA (${fastPeriod})`}
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Slow Moving Average */}
            <Line
              type="monotone"
              dataKey="slowMA"
              name={`Slow MA (${slowPeriod})`}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Buy Trade Execution Markers */}
            {buyTrades.map(trade => (
              <ReferenceDot
                key={`buy-${trade.id}`}
                x={trade.date}
                y={trade.executedPrice}
                r={5}
                fill="#10b981"
                stroke="#022c22"
                strokeWidth={2}
                label={{
                  value: '▲ BUY',
                  position: 'bottom',
                  fill: '#34d399',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 'bold'
                }}
              />
            ))}

            {/* Sell Trade Execution Markers */}
            {sellTrades.map(trade => (
              <ReferenceDot
                key={`sell-${trade.id}`}
                x={trade.date}
                y={trade.executedPrice}
                r={5}
                fill="#f43f5e"
                stroke="#4c0519"
                strokeWidth={2}
                label={{
                  value: '▼ SELL',
                  position: 'top',
                  fill: '#fb7185',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 'bold'
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
