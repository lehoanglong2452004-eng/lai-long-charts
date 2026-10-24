// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Contract registry: what kind of instrument a chart shows and, for futures, which contract month.
// The month comes from the data feed when it says so (Yahoo names the contract, e.g. "Gold Dec 26");
// otherwise it is estimated from each exchange's listing cycle and last-trade rule below.
// Holidays are ignored, so an estimate can be a day or two off right at a roll.
// Pure module (no DOM), shared by the chart tab and the tests; a paid feed can fill the same fields later.

export const MONTH_CODES = 'FGHJKMNQUVXZ';
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTERLY = [3, 6, 9, 12];

// key = price key in config.js (sym.price / sym.cotPrice).
// roll: rule for the day a contract stops being the front month (see lastDay below).
export const SPECS = {
  GOLD: { root: 'GC', exch: 'COMEX', cycle: [2, 4, 6, 8, 10, 12], roll: 'fnd' },
  SILVER: { root: 'SI', exch: 'COMEX', cycle: [3, 5, 7, 9, 12], roll: 'fnd' },
  PLATINUM: { root: 'PL', exch: 'NYMEX', cycle: [1, 4, 7, 10], roll: 'fnd' },
  PALLADIUM: { root: 'PA', exch: 'NYMEX', cycle: QUARTERLY, roll: 'fnd' },
  COPPER: { root: 'HG', exch: 'COMEX', cycle: [3, 5, 7, 9, 12], roll: 'fnd' },
  ALUMINUM: { root: 'ALI', exch: 'COMEX', cycle: ALL, roll: 'monthEnd' },
  STEEL_HRC: { root: 'HRC', exch: 'COMEX', cycle: ALL, roll: 'monthEnd' },
  WHEAT: { root: 'ZW', exch: 'CBOT', cycle: [3, 5, 7, 9, 12], roll: 'fnd' },
  CORN: { root: 'ZC', exch: 'CBOT', cycle: [3, 5, 7, 9, 12], roll: 'fnd' },
  SOYBEANS: { root: 'ZS', exch: 'CBOT', cycle: [1, 3, 5, 7, 8, 9, 11], roll: 'fnd' },
  SOY_OIL: { root: 'ZL', exch: 'CBOT', cycle: [1, 3, 5, 7, 8, 9, 10, 12], roll: 'fnd' },
  SOY_MEAL: { root: 'ZM', exch: 'CBOT', cycle: [1, 3, 5, 7, 8, 9, 10, 12], roll: 'fnd' },
  COFFEE_ARABICA: { root: 'KC', exch: 'ICE US', cycle: [3, 5, 7, 9, 12], roll: 'ice' },
  WTI: { root: 'CL', exch: 'NYMEX', cycle: ALL, roll: 'cl' },
  BRENT: { root: 'BZ', exch: 'NYMEX', cycle: ALL, roll: 'brent' },
  NATGAS: { root: 'NG', exch: 'NYMEX', cycle: ALL, roll: 'ng' },
  RBOB: { root: 'RB', exch: 'NYMEX', cycle: ALL, roll: 'prevMonthEnd' },
  HEATING_OIL: { root: 'HO', exch: 'NYMEX', cycle: ALL, roll: 'prevMonthEnd' },
  EUR_FUT: { root: '6E', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  JPY_FUT: { root: '6J', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  GBP_FUT: { root: '6B', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  CAD_FUT: { root: '6C', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  AUD_FUT: { root: '6A', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  CHF_FUT: { root: '6S', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
  NZD_FUT: { root: '6N', exch: 'CME', cycle: QUARTERLY, roll: 'fx' },
};

// ---------------------------------------------------------------- business-day calendar (UTC dates)
const DAY = 86400000;
const ymd = (y, m, d) => Date.UTC(y, m - 1, d);
const isBiz = t => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6; };
const bizBefore = (t, n) => { for (let k = 0; k < n;) { t -= DAY; if (isBiz(t)) k++; } return t; };
const lastBiz = (y, m) => { let t = ymd(y, m + 1, 1) - DAY; while (!isBiz(t)) t -= DAY; return t; };
const firstBiz = (y, m) => { let t = ymd(y, m, 1); while (!isBiz(t)) t += DAY; return t; };
const prevMonth = (y, m, k = 1) => { const i = y * 12 + (m - 1) - k; return [Math.floor(i / 12), i % 12 + 1]; };

// Last day the contract (year y, month m) is still the front month.
export function lastDay(roll, y, m) {
  const [py, pm] = prevMonth(y, m);
  switch (roll) {
    case 'fnd': return bizBefore(lastBiz(py, pm), 1); // roll out the day before first notice (last business day of prior month)
    case 'prevMonthEnd': return lastBiz(py, pm);
    case 'monthEnd': return lastBiz(y, m);
    case 'ice': return bizBefore(firstBiz(y, m), 7); // ICE softs: FND is 7 business days before the delivery month
    case 'ng': return bizBefore(ymd(y, m, 1), 3);
    case 'cl': { // 3 business days before the 25th of the prior month (or before the business day preceding it)
      let t = ymd(py, pm, 25);
      if (!isBiz(t)) { do t -= DAY; while (!isBiz(t)); }
      return bizBefore(t, 3);
    }
    case 'brent': { const [by, bm] = prevMonth(y, m, 2); return lastBiz(by, bm); }
    case 'fx': { // 2 business days before the third Wednesday of the contract month
      let t = ymd(y, m, 1);
      while (new Date(t).getUTCDay() !== 3) t += DAY;
      return bizBefore(t + 14 * DAY, 2);
    }
    default: throw new Error('unknown roll rule ' + roll);
  }
}

const nyDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const nyDay = now => { const [y, m, d] = nyDayFmt.format(new Date(now)).split('-').map(Number); return ymd(y, m, d); };

export const contractCode = (root, y, m) => `${root}${MONTH_CODES[m - 1]}${String(y % 100).padStart(2, '0')}`;

// Front-month contract by the exchange calendar: { key, root, exch, year, month, code, until, est: true }
export function frontContract(key, now = Date.now()) {
  const s = SPECS[key];
  if (!s) return null;
  const today = nyDay(now);
  const y0 = new Date(today).getUTCFullYear(), m0 = new Date(today).getUTCMonth();
  for (let k = 0; k < 36; k++) {
    const y = y0 + Math.floor((m0 + k) / 12), m = (m0 + k) % 12 + 1;
    if (!s.cycle.includes(m)) continue;
    const until = lastDay(s.roll, y, m);
    if (until >= today) return { key, root: s.root, exch: s.exch, year: y, month: m, code: contractCode(s.root, y, m), until, est: true };
  }
  return null;
}

// Contract the feed reported ({month, year, name, exchange}) merged with the registry; falls back to the estimate.
// A feed month far from the calendar front month (a misread name) is ignored. Yahoo may roll a little
// later than the calendar, so a few months behind is still accepted.
export function resolveContract(key, fromFeed, now = Date.now()) {
  const s = SPECS[key];
  if (!s) return null;
  const cal = frontContract(key, now);
  const f = fromFeed && fromFeed.month >= 1 && fromFeed.month <= 12 && fromFeed.year > 2000 ? fromFeed : null;
  const gap = f && cal ? (f.year * 12 + f.month) - (cal.year * 12 + cal.month) : 0;
  if (!f || gap < -4 || gap > 13) return cal;
  return { key, root: s.root, exch: s.exch, year: f.year, month: f.month, code: contractCode(s.root, f.year, f.month),
    until: lastDay(s.roll, f.year, f.month), est: false, name: f.name || '' };
}

// What a chart is showing: 'future' (with contract), 'perp', 'spot' or 'index'.
export function instrumentKind(sym, source, exchange) {
  if (source === 'live') return sym.group === 'crypto' && exchange !== 'hyperliquid' ? 'spot' : 'perp';
  if (SPECS[sym.price]) return 'future';
  return sym.price === 'DXY' ? 'index' : 'spot';
}

export const monthLabel = (c, lang) => lang === 'vi'
  ? `T${c.month}/${c.year}`
  : `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][c.month - 1]} ${c.year}`;

export const dayLabel = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
