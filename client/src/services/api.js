/**
 * Client API Client with Render Cold-Start Warmup Support and Latency Telemetry
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/api/health`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Health probe failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchAssets(market = 'all') {
  const res = await fetch(`${BASE_URL}/api/assets?market=${market}`);
  if (!res.ok) {
    throw new Error(`Failed to load assets: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchQuotes(symbol, days = 365, market = 'crypto') {
  const res = await fetch(`${BASE_URL}/api/quotes?symbol=${symbol}&days=${days}&market=${market}`);
  if (!res.ok) {
    throw new Error(`Failed to load quotes: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

export async function executeBacktest(payload) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/api/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Backtest failed: ${res.status} ${res.statusText}`);
  }

  const clientLatency = Math.round(performance.now() - start);
  const data = await res.json();
  const serverHeaderCache = res.headers.get('X-Cache');
  const serverHeaderTime = res.headers.get('X-Response-Time');

  return {
    ...data,
    clientLatencyMs: clientLatency,
    cacheHit: serverHeaderCache === 'HIT' || data.cached === true,
    serverDuration: serverHeaderTime || `${data.replayTimeMs}ms`
  };
}
