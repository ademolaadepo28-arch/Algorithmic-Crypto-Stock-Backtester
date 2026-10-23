import React from 'react';
import { RefreshCw, Server, AlertCircle } from 'lucide-react';

export default function WarmupModal({ isWarmingUp, retryCount, onRetry }) {
  if (!isWarmingUp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-panel p-6 max-w-md w-full border border-cyan-500/40 shadow-2xl shadow-cyan-500/10 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
          <Server className="w-7 h-7 text-cyan-400 animate-pulse" />
        </div>

        <h3 className="font-heading font-bold text-lg text-white mb-2">
          WARMING UP CLOUD BACKEND ENGINE
        </h3>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          The Render Web Service is currently provisioning from sleep mode. This standard cold-start cycle completes in ~30 seconds, after which cached replay will execute in <span className="text-cyan-400 font-mono font-bold">&le; 80ms</span>.
        </p>

        <div className="flex items-center justify-center gap-2 mb-4 text-xs font-mono text-cyan-300 bg-slate-900/80 py-2 px-3 rounded-lg border border-slate-800">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Polling health probe (Attempt #{retryCount})...</span>
        </div>

        <button
          onClick={onRetry}
          className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all cursor-pointer"
        >
          Force Immediate Probe Retry
        </button>
      </div>
    </div>
  );
}
