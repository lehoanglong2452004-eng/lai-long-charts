// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
const LW = window.LightweightCharts;

export const store = {
  get(k, d) {
    try { const v = localStorage.getItem('llc.' + k); return v === null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('llc.' + k, JSON.stringify(v)); } catch { /* private mode */ }
  },
};

const cache = new Map();
// fresh=true bypasses both our cache and the browser/CDN cache (for intraday polling).
export async function loadJSON(path, fresh = false) {
  if (!fresh && cache.has(path)) return cache.get(path);
  const p = fetch(path + (fresh ? `?t=${Date.now()}` : ''), { cache: fresh ? 'no-store' : 'default' })
    .then(r => { if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json(); });
  if (!fresh) cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false)
    e.append(kid instanceof Node ? kid : String(kid));
  return e;
}

export function decimals(v) {
  const a = Math.abs(v);
  if (a === 0) return 2;
  if (a < 0.02) return 6;
  if (a < 2) return 4;
  if (a < 20) return 3;
  return 2;
}
export const fmtPrice = (v, dp = decimals(v)) =>
  v === null || v === undefined || isNaN(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtInt = v => v === null || v === undefined || isNaN(v) ? '—' : Math.round(v).toLocaleString('en-US');
export const fmtSigned = v => (v > 0 ? '+' : '') + fmtInt(v);
export const fmtPct = (v, dp = 2) => v === null || v === undefined || isNaN(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(dp) + '%';
export const signClass = v => v > 0 ? 'up' : v < 0 ? 'dn' : '';

// "2026-10-13" -> unix seconds (UTC midnight)
export const dayTime = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000;
export const isoDay = ts => new Date(ts * 1000).toISOString().slice(0, 10);

export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const DEFAULT_COLORS = { up: '#00c176', down: '#ff433d', line: '#ffa028', bg: '' };
export const colors = () => ({ ...DEFAULT_COLORS, ...store.get('colors', {}) });

// Chart factory with the terminal look. Every chart made here is tracked so a tab can dispose them.
export function makeChart(container, opts = {}) {
  const c = colors();
  const chart = LW.createChart(container, {
    autoSize: true,
    layout: {
      background: { type: 'solid', color: c.bg || css('--chart-bg') },
      textColor: css('--muted'),
      fontFamily: "'Roboto Mono', monospace",
      fontSize: 11,
      attributionLogo: false,
      panes: { separatorColor: css('--line'), separatorHoverColor: css('--amber-dim') },
    },
    grid: { vertLines: { color: css('--grid') }, horzLines: { color: css('--grid') } },
    rightPriceScale: { borderColor: css('--line') },
    timeScale: { borderColor: css('--line'), timeVisible: false, rightOffset: 4 },
    crosshair: {
      mode: LW.CrosshairMode.Normal,
      vertLine: { color: css('--muted'), labelBackgroundColor: css('--amber-dim') },
      horzLine: { color: css('--muted'), labelBackgroundColor: css('--amber-dim') },
    },
    ...opts,
  });
  return chart;
}

export { LW };

export function debounce(fn, ms) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

// Pearson correlation of two equal-length arrays
export function corr(a, b) {
  const n = a.length;
  if (n < 3) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return num / Math.sqrt(da * db);
}
