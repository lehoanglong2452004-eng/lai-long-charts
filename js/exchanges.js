// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Live market data from Binance, OKX, Bybit and Hyperliquid with automatic failover.
// Bars are returned with UTC unix-second times: { time, open, high, low, close, volume }.

export const EXCHANGE_ORDER = ['binance', 'okx', 'bybit', 'hyperliquid'];
export const EXCHANGE_LABEL = { binance: 'BINANCE', okx: 'OKX', bybit: 'BYBIT', hyperliquid: 'HYPERLIQUID' };

// symbol id -> market per exchange. Crypto = spot (perp on Hyperliquid); commodities = USDT perpetuals.
export const MARKETS = {
  BTC: { binance: ['spot', 'BTCUSDT'], okx: 'BTC-USDT', bybit: ['spot', 'BTCUSDT'], hyperliquid: 'BTC' },
  ETH: { binance: ['spot', 'ETHUSDT'], okx: 'ETH-USDT', bybit: ['spot', 'ETHUSDT'], hyperliquid: 'ETH' },
  GOLD: { binance: ['usdm', 'XAUUSDT'], okx: 'XAU-USDT-SWAP', bybit: ['linear', 'XAUUSDT'], hyperliquid: 'xyz:GOLD' },
  SILVER: { binance: ['usdm', 'XAGUSDT'], okx: 'XAG-USDT-SWAP', bybit: ['linear', 'XAGUSDT'], hyperliquid: 'xyz:SILVER' },
  PLATINUM: { binance: ['usdm', 'XPTUSDT'], okx: 'XPT-USDT-SWAP', hyperliquid: 'xyz:PLATINUM' },
  PALLADIUM: { binance: ['usdm', 'XPDUSDT'], okx: 'XPD-USDT-SWAP', hyperliquid: 'xyz:PALLADIUM' },
  COPPER: { binance: ['usdm', 'COPPERUSDT'], okx: 'XCU-USDT-SWAP', hyperliquid: 'xyz:COPPER' },
  WTI: { binance: ['usdm', 'CLUSDT'], okx: 'CL-USDT-SWAP', bybit: ['linear', 'CLUSDT'], hyperliquid: 'xyz:CL' },
  BRENT: { binance: ['usdm', 'BZUSDT'], okx: 'BZ-USDT-SWAP', bybit: ['linear', 'BZUSDT'], hyperliquid: 'xyz:BRENTOIL' },
  NATGAS: { binance: ['usdm', 'NATGASUSDT'], okx: 'NG-USDT-SWAP', hyperliquid: 'xyz:NATGAS' },
};

export const exchangesFor = id => EXCHANGE_ORDER.filter(ex => MARKETS[id]?.[ex]);
export const marketName = (id, ex) => { const m = MARKETS[id]?.[ex]; return Array.isArray(m) ? m[1] : m; };

const TF_SEC = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800 };
const LIMIT = 1000;
const num = Number;

async function getJSON(url, opts = {}, ms = 8000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(id); }
}

// ---------------------------------------------------------------- adapters
const ADAPTERS = {
  binance: {
    tf: { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w' },
    async bars([kind, s], tf) {
      const base = kind === 'usdm' ? 'https://fapi.binance.com/fapi/v1' : 'https://api.binance.com/api/v3';
      const rows = await getJSON(`${base}/klines?symbol=${s}&interval=${this.tf[tf]}&limit=${LIMIT}`);
      return rows.map(k => ({ time: k[0] / 1000, open: num(k[1]), high: num(k[2]), low: num(k[3]), close: num(k[4]), volume: num(k[5]) }));
    },
    ws([kind, s], tf) {
      // USD-M futures market streams live under /market/ws (the old /ws path connects but stays silent)
      const host = kind === 'usdm' ? 'wss://fstream.binance.com/market' : 'wss://stream.binance.com:9443';
      return {
        url: `${host}/ws/${s.toLowerCase()}@kline_${this.tf[tf]}`,
        parse: m => { const k = m.k; return k && { time: k.t / 1000, open: num(k.o), high: num(k.h), low: num(k.l), close: num(k.c), volume: num(k.v) }; },
      };
    },
  },
  okx: {
    tf: { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1H': '1H', '4H': '4H', '1D': '1Dutc', '1W': '1Wutc' },
    async bars(inst, tf) {
      // 300 bars per call: latest page from /candles, older pages from /history-candles
      const row = k => ({ time: num(k[0]) / 1000, open: num(k[1]), high: num(k[2]), low: num(k[3]), close: num(k[4]), volume: num(k[6]) });
      let out = [], after = '';
      for (let page = 0; page < 3; page++) {
        const ep = page === 0 ? 'candles' : 'history-candles';
        const d = await getJSON(`https://www.okx.com/api/v5/market/${ep}?instId=${inst}&bar=${this.tf[tf]}&limit=300${after}`);
        if (d.code !== '0') throw new Error('OKX ' + d.msg);
        if (!d.data.length) break;
        out = out.concat(d.data.map(row));
        after = `&after=${d.data[d.data.length - 1][0]}`;
        if (d.data.length < 300) break;
      }
      return dedupe(out);
    },
    ws(inst, tf) {
      return {
        url: 'wss://ws.okx.com:8443/ws/v5/business',
        sub: { op: 'subscribe', args: [{ channel: 'candle' + this.tf[tf], instId: inst }] },
        ping: 'ping',
        parse: m => { const k = m.data?.[0]; return k && { time: num(k[0]) / 1000, open: num(k[1]), high: num(k[2]), low: num(k[3]), close: num(k[4]), volume: num(k[6]) }; },
      };
    },
  },
  bybit: {
    tf: { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1H': '60', '4H': '240', '1D': 'D', '1W': 'W' },
    async bars([cat, s], tf) {
      const d = await getJSON(`https://api.bybit.com/v5/market/kline?category=${cat}&symbol=${s}&interval=${this.tf[tf]}&limit=${LIMIT}`);
      if (d.retCode !== 0) throw new Error('Bybit ' + d.retMsg);
      return dedupe(d.result.list.map(k => ({ time: num(k[0]) / 1000, open: num(k[1]), high: num(k[2]), low: num(k[3]), close: num(k[4]), volume: num(k[5]) })));
    },
    ws([cat, s], tf) {
      return {
        url: `wss://stream.bybit.com/v5/public/${cat}`,
        sub: { op: 'subscribe', args: [`kline.${this.tf[tf]}.${s}`] },
        ping: JSON.stringify({ op: 'ping' }),
        parse: m => { const k = m.data?.[0]; return k && m.topic && { time: k.start / 1000, open: num(k.open), high: num(k.high), low: num(k.low), close: num(k.close), volume: num(k.volume) }; },
      };
    },
  },
  hyperliquid: {
    tf: { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w' },
    async bars(coin, tf) {
      const end = Date.now(), start = end - TF_SEC[tf] * 1000 * LIMIT;
      const rows = await getJSON('https://api.hyperliquid.xyz/info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: this.tf[tf], startTime: start, endTime: end } }),
      });
      return rows.map(k => ({ time: k.t / 1000, open: num(k.o), high: num(k.h), low: num(k.l), close: num(k.c), volume: num(k.v) }));
    },
    ws(coin, tf) {
      return {
        url: 'wss://api.hyperliquid.xyz/ws',
        sub: { method: 'subscribe', subscription: { type: 'candle', coin, interval: this.tf[tf] } },
        ping: JSON.stringify({ method: 'ping' }),
        parse: m => { const k = m.channel === 'candle' && m.data; return k && { time: k.t / 1000, open: num(k.o), high: num(k.h), low: num(k.l), close: num(k.c), volume: num(k.v) }; },
      };
    },
  },
};

// oldest first, one bar per time
function dedupe(bars) {
  const m = new Map();
  for (const b of bars) m.set(b.time, b);
  return [...m.values()].sort((a, b) => a.time - b.time);
}

// ---------------------------------------------------------------- live feed with failover
// pref: 'auto' (try exchanges in EXCHANGE_ORDER) or one exchange id.
// Calls onBars(bars, exchange) on (re)load, onBar(bar) for each stream update, onError(msg) if all fail.
export function liveFeed(id, tf, pref, { onBars, onBar, onError }) {
  const order = pref === 'auto' ? exchangesFor(id) : [pref].filter(ex => MARKETS[id]?.[ex]);
  let k = 0, ws = null, pingT = null, watchT = null, closed = false, fails = 0, lastMsg = 0, stalled = false, gotAny = false;
  const STALL_MS = 120000, FIRST_MSG_MS = 45000;

  async function start(i) {
    stopSocket();
    if (closed) return;
    if (i >= order.length) { onError('all exchanges unavailable'); retryLater(); return; }
    k = i;
    const ex = order[i], mkt = MARKETS[id][ex], A = ADAPTERS[ex];
    try {
      const bars = await A.bars(mkt, tf);
      if (closed) return;
      if (!bars.length) throw new Error('empty');
      onBars(bars, ex);
      openSocket(ex, A.ws(mkt, tf));
    } catch (e) {
      console.warn(`[feed] ${ex} ${id} ${tf}:`, e.message);
      start(i + 1);
    }
  }

  function openSocket(ex, spec) {
    lastMsg = Date.now();
    stalled = false;
    gotAny = false;
    ws = new WebSocket(spec.url);
    ws.onopen = () => {
      if (spec.sub) ws.send(JSON.stringify(spec.sub));
      if (spec.ping) pingT = setInterval(() => ws?.readyState === 1 && ws.send(spec.ping), 20000);
    };
    ws.onmessage = e => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      const bar = spec.parse(m);
      if (!bar) return;
      lastMsg = Date.now();
      gotAny = true;
      fails = 0;
      onBar(bar, ex);
    };
    ws.onerror = () => ws?.close();
    ws.onclose = () => {
      if (closed) return;
      if (!stalled) fails++; // a silent (quiet market) stream is resubscribed, not counted as failure
      // two quick failures on the same exchange -> move to the next one (auto mode)
      const next = fails >= 2 && order.length > 1 ? (k + 1) % order.length : k;
      if (next !== k) fails = 0;
      setTimeout(() => start(next), 1500);
    };
    // no data at all after connecting = broken/congested feed (counts as failure);
    // silence after data was flowing = quiet market or half-open socket (resubscribe only)
    watchT = setInterval(() => {
      const idle = Date.now() - lastMsg;
      if (!gotAny && idle > FIRST_MSG_MS) ws?.close();
      else if (gotAny && idle > STALL_MS) { stalled = true; ws?.close(); }
    }, 5000);
  }

  function stopSocket() {
    clearInterval(pingT); clearInterval(watchT);
    if (ws) { ws.onclose = null; ws.onmessage = null; try { ws.close(); } catch { /* already closed */ } ws = null; }
  }
  function retryLater() { setTimeout(() => !closed && start(0), 30000); }

  if (!order.length) onError('no exchange market'); else start(0);
  return { close() { closed = true; stopSocket(); } };
}
