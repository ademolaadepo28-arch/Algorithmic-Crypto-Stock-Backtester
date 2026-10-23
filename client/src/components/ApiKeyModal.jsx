import React, { useState } from 'react';
import { Key, ShieldCheck, AlertCircle, ExternalLink, X, Check, RefreshCw } from 'lucide-react';
import { saveAlphaVantageKey } from '../services/api';

export default function ApiKeyModal({ isOpen, onClose, keyConfig, onKeyUpdated }) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isError, setIsError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setIsError(true);
      setStatusMsg('Please enter an API key');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);
    setIsError(false);

    try {
      const res = await saveAlphaVantageKey(apiKeyInput.trim());
      setIsError(false);
      setStatusMsg(res.message || 'API key verified and connected successfully!');
      setApiKeyInput('');
      if (onKeyUpdated) {
        onKeyUpdated();
      }
    } catch (err) {
      setIsError(true);
      setStatusMsg(err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlphaConfigured = keyConfig?.alphaVantage?.configured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-panel p-6 max-w-lg w-full border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white">
              CONNECT EXTERNAL FINANCIAL DATA APIS
            </h3>
            <p className="text-xs text-slate-400">
              Alpha Vantage (Equities) & CoinGecko (Cryptocurrencies)
            </p>
          </div>
        </div>

        {/* Current Connection Status Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
          {/* Alpha Vantage */}
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-semibold">Alpha Vantage</span>
              <span className={`w-2 h-2 rounded-full ${isAlphaConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>
            <div className="text-[11px] mb-1">
              {isAlphaConfigured ? (
                <span className="text-emerald-300 font-bold">Connected ({keyConfig.alphaVantage.keyMasked})</span>
              ) : (
                <span className="text-amber-400 font-bold">Unset (Seeded High-Fidelity Fallback)</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              Limit: 5 calls/min
            </div>
          </div>

          {/* CoinGecko */}
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-semibold">CoinGecko API</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-[11px] text-emerald-300 font-bold mb-1">
              Public Tier Active
            </div>
            <div className="text-[10px] text-slate-500">
              Limit: 30 calls/min (No key needed)
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Connect Alpha Vantage API Key
            </label>
            <input
              type="text"
              placeholder="e.g. your 16-character Alpha Vantage API key"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="custom-input font-mono text-xs py-2"
            />
          </div>

          {statusMsg && (
            <div className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
              isError ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <a
              href="https://www.alphavantage.co/support/#api-key"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono hover:underline"
            >
              <span>Get Free API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-heading font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Key...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save & Verify Key</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <p>
            <strong>Note:</strong> If an Alpha Vantage key is not supplied, the backtester seamlessly uses pre-computed, high-fidelity daily candles for <code className="text-cyan-300">AAPL</code>, <code className="text-cyan-300">SPY</code>, and <code className="text-cyan-300">QQQ</code> with 0 HTTP 429 errors.
          </p>
        </div>
      </div>
    </div>
  );
}
