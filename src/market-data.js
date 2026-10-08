'use strict';
// Reused from the Apex research platform's price-fetch logic (server.js),
// trimmed to the subset needed for education modules: a handful of
// diversified-vs-concentrated example tickers rather than the full
// multi-hundred-ticker research universe. No research/consent code here.
const POLYGON_KEY = process.env.POLYGON_KEY || '';

// A small, deliberately diversified teaching universe: tech, broad market,
// bonds, gold, and one volatile leveraged ETF to make concentration visible.
const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'SPY', 'VTI', 'TLT', 'GLD', 'XLE', 'SOXL'];
const prices = new Map();

const YF_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

async function fetchYahooBatch(tickers) {
  const fields = ['regularMarketPrice', 'regularMarketPreviousClose'].join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}&fields=${fields}&lang=en-US&region=US`;
  const r = await fetch(url, { headers: { 'User-Agent': YF_USER_AGENT, 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const results = d?.quoteResponse?.result;
  if (!Array.isArray(results)) throw new Error('no results');
  results.forEach(q => {
    const p = q.regularMarketPrice; if (!p || p <= 0) return;
    const pc = q.regularMarketPreviousClose || p;
    prices.set(q.symbol, { price: p, prevClose: pc, pct: pc ? ((p - pc) / pc) * 100 : 0, ts: Date.now() });
  });
}

async function refresh() {
  try { await fetchYahooBatch(TICKERS); }
  catch (e) { console.warn('[market-data] Yahoo fetch failed, using fallback prices:', e.message); seedFallback(); }
}

// If the free Yahoo endpoint is unreachable (rate-limited, blocked, offline dev),
// fall back to static-but-labeled example prices so the simulation still runs.
// These are NEVER presented to users as "live" -- the UI should show source status.
function seedFallback() {
  const fallback = {
    AAPL: 230, MSFT: 420, NVDA: 125, SPY: 560, VTI: 280, TLT: 90, GLD: 240, XLE: 85, SOXL: 22,
  };
  for (const [sym, price] of Object.entries(fallback)) {
    if (!prices.has(sym)) prices.set(sym, { price, prevClose: price, pct: 0, ts: Date.now(), fallback: true });
  }
}

seedFallback(); // guarantee something is available immediately on boot
refresh();
setInterval(refresh, 60000); // education product needs far less frequent polling than the live research app

function getPrices() {
  return Object.fromEntries(prices);
}

function getTickers() { return TICKERS.slice(); }

module.exports = { getPrices, getTickers };
