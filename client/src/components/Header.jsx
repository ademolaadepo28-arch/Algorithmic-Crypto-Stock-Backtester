import React from 'react';
import { Activity, Zap, Server, Database, ShieldAlert, Cpu, Key } from 'lucide-react';

export default function Header({ health, lastReplayTime, isCacheHit, keyConfig, onOpenApiKeyModal }) {
  const isConnected = health && health.status === 'ok';
  const redisConnected = health?.redis?.connected;
  const backendType = health?.redis?.backendType || 'In-Memory Cache';
  const isKeyConfigured = keyConfig?.alphaVantage?.configured;

  return (
    <header className="glass-panel px-6 py-4 mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-xl tracking-wide bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
              ALGORITHMIC CRYPTO & STOCK BACKTESTER
            </h1>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              MVP SPEC
            </span>
          </div>
          <p className="text-xs text-slate-400 font-normal">
            Vectorized Execution Pipeline • Sharpe & Sortino Engine • Strict Lookahead Bias Prevention
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2.5 text-xs font-mono">
        {/* Connect API Key Button */}
        <button
          onClick={onOpenApiKeyModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-slate-300 transition-all cursor-pointer"
          title="Connect or configure Alpha Vantage & CoinGecko API keys"
        >
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <span>API Key:</span>
          <span className={`font-bold ${isKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isKeyConfigured ? 'Active' : 'Connect'}
          </span>
        </button>

        {/* Sub-80ms Replay Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
          isCacheHit
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900/60 border-slate-700 text-slate-300'
        }`}>
          <Zap className={`w-3.5 h-3.5 ${isCacheHit ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>Replay:</span>
          <span className="font-bold">{lastReplayTime !== null ? `${lastReplayTime}ms` : 'Ready'}</span>
          {isCacheHit && (
            <span className="px-1.5 py-0.2 text-[10px] rounded bg-emerald-500/20 text-emerald-300 font-semibold">
              CACHE HIT
            </span>
          )}
        </div>

        {/* Redis / Cache Storage Tier */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-300">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Tier:</span>
          <span className="text-cyan-300">{redisConnected ? 'Render Redis' : 'LRU In-Memory'}</span>
        </div>

        {/* Live Server Health Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          isConnected
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 pulse-indicator' : 'bg-rose-500'}`} />
          <span>{isConnected ? 'API LIVE' : 'CONNECTING...'}</span>
        </div>
      </div>
    </header>
  );
}

