import React, { useState } from 'react';
import { ListFilter, Download, ArrowUpRight, ArrowDownRight, Search, FileSpreadsheet } from 'lucide-react';

export default function TradesTable({ trades }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'SELLS' | 'WINS' | 'LOSSES'
  const [searchTerm, setSearchTerm] = useState('');

  if (!trades || trades.length === 0) {
    return (
      <div className="glass-panel p-6 text-center text-slate-500 font-mono text-sm">
        No executed trades for this parameter set. Adjust indicators or parameters to generate signals.
      </div>
    );
  }

  // Filter trades
  const filteredTrades = trades.filter(t => {
    if (filter === 'SELLS' && t.type !== 'SELL') return false;
    if (filter === 'WINS' && (t.type !== 'SELL' || t.pnl <= 0)) return false;
    if (filter === 'LOSSES' && (t.type !== 'SELL' || t.pnl >= 0)) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        t.date.toLowerCase().includes(term) ||
        t.reason?.toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ['ID', 'Type', 'Date', 'NominalPrice', 'ExecutedPrice', 'Size', 'Value', 'Fee', 'Slippage', 'PnL', 'PnLPercent', 'Reason'];
    const rows = trades.map(t => [
      t.id,
      t.type,
      t.date,
      t.nominalPrice,
      t.executedPrice,
      t.size,
      t.value,
      t.fee,
      t.slippage,
      t.pnl,
      t.pnlPercent,
      `"${t.reason || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `backtest_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-cyan-400" />
          <h3 className="font-heading font-semibold text-sm text-slate-200">
            CHRONOLOGICAL EXECUTION LOG & TRADE AUDIT TRAIL
          </h3>
          <span className="text-xs font-mono text-slate-400">({trades.length} events)</span>
        </div>

        {/* Filter buttons & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter trades..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="custom-input text-xs pl-8 pr-2 py-1.5 w-36 font-mono"
            />
          </div>

          <div className="flex items-center gap-1 font-mono text-xs">
            {['ALL', 'SELLS', 'WINS', 'LOSSES'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2 py-1 rounded text-[11px] ${
                  filter === tab
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-mono border border-slate-700 transition-all cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md text-slate-400 border-b border-slate-800 text-[11px]">
            <tr>
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Execution Date</th>
              <th className="py-2 px-3 text-right">Exec Price (Slippage)</th>
              <th className="py-2 px-3 text-right">Size / Value</th>
              <th className="py-2 px-3 text-right">Friction (Fee+Slip)</th>
              <th className="py-2 px-3 text-right">Realized PnL</th>
              <th className="py-2 px-3">Execution Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredTrades.map(trade => {
              const isBuy = trade.type === 'BUY';
              const isProfit = trade.pnl > 0;

              return (
                <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 text-slate-500">#{trade.id}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      isBuy ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                    }`}>
                      {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {trade.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300">{trade.date}</td>
                  <td className="py-2 px-3 text-right text-slate-200">
                    <div>${trade.executedPrice?.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Nom: ${trade.nominalPrice?.toLocaleString()}</div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="text-slate-300">{trade.size}</div>
                    <div className="text-[10px] text-slate-500">${trade.value?.toLocaleString()}</div>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400">
                    <div>${trade.fee} fee</div>
                    <div className="text-[10px] text-slate-500">${trade.slippage} slip</div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {isBuy ? (
                      <span className="text-slate-600">-</span>
                    ) : (
                      <div>
                        <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${trade.pnl?.toLocaleString()}
                        </span>
                        <div className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfit ? '+' : ''}{trade.pnlPercent}%
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px] max-w-xs truncate" title={trade.reason}>
                    {trade.reason || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
