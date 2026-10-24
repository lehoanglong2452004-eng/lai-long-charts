// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Multi-chart tab: candles/line, volume, volume profile, bar countdown.
// Crypto and metal/energy perps stream live from Binance/OKX/Bybit/Hyperliquid (auto failover);
// futures/FX use Yahoo intraday published with each deploy (~15 min delay).
// Each cell names what it shows: perpetual, spot, index, or the futures contract month (js/contracts.js).
import { SYMBOLS, BY_ID, GROUPS } from './config.js';
import { t, name, lang } from './i18n.js';
import { el, loadJSON, makeChart, LW, store, fmtPrice, fmtPct, fmtInt, signClass, dayTime, decimals, colors, css } from './util.js';
import { seg, fullscreenBtn } from './ui.js';
import { liveFeed, exchangesFor, marketName, EXCHANGE_LABEL } from './exchanges.js';
import { SPECS, resolveContract, frontContract, instrumentKind, monthLabel, dayLabel } from './contracts.js';

const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800 };
const LAYOUTS = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] };
const DEFAULT_CELLS = [
  { sym: 'GOLD', tf: '1H' }, { sym: 'BTC', tf: '15m' }, { sym: 'WTI', tf: '1H' }, { sym: 'EUR', tf: '1H' },
  { sym: 'SILVER', tf: '4H' }, { sym: 'ETH', tf: '1H' }, { sym: 'CORN', tf: '1D' }, { sym: 'JPY', tf: '4H' }, { sym: 'NATGAS', tf: '1H' },
];
const POLL_MS = 120000;
const TZ_SHIFT = -new Date().getTimezoneOffset() * 60; // show intraday bars in the viewer's local time
const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

export function mount(root) {
  let layout = store.get('charts.layout', 4);
  const cfg = store.get('charts.cells', DEFAULT_CELLS).map((c, i) => ({ type: 'candle', vp: false, src: 'auto', ...DEFAULT_CELLS[i], ...c }));
  const saveCells = () => store.set('charts.cells', cfg);
  let cells = [];

  const grid = el('div', { class: 'cgrid' });
  const bar = el('div', { class: 'bar' },
    el('span', { class: 'bar-title' }, t('charts')),
    el('span', {}, el('span', { class: 'lbl' }, t('layout')),
      seg(Object.keys(LAYOUTS).map(k => ({ v: +k, label: k === '1' ? '▣' : k })), layout, v => {
        layout = v; store.set('charts.layout', v); build();
      })),
    el('span', { class: 'note', style: 'padding:0' },
      el('span', { class: 'badge live' }, t('live')), ' Binance · OKX · Bybit · Hyperliquid · ',
      el('span', { class: 'badge delayed' }, t('delayed')), ` ${t('delayedsrc')} · `,
      el('span', { class: 'badge eod' }, t('eod'))));
  const section = el('section', { class: 'content' }, bar, grid);
  bar.append(fullscreenBtn(() => section));
  root.append(section);

  // maximize one cell over the whole grid (button, double-click header, Esc to restore)
  let maxed = null;
  const setMax = node => {
    maxed = node === maxed ? null : node;
    grid.classList.toggle('maxed', !!maxed);
    cells.forEach(c => c.node.classList.toggle('max', c.node === maxed));
  };
  const onKey = e => { if (e.key === 'Escape' && maxed && !document.fullscreenElement) setMax(maxed); };
  document.addEventListener('keydown', onKey);

  function build() {
    cells.forEach(c => c.destroy());
    maxed = null;
    grid.classList.remove('maxed');
    grid.replaceChildren();
    const [cols, rows] = LAYOUTS[layout];
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    cells = [];
    for (let i = 0; i < layout; i++) {
      const c = createCell(cfg[i], () => saveCells(), setMax);
      grid.append(c.node);
      cells.push(c);
    }
  }
  build();
  return () => { document.removeEventListener('keydown', onKey); cells.forEach(c => c.destroy()); };
}

// ---------------------------------------------------------------- one chart cell
function createCell(conf, onChange, onMax) {
  const node = el('div', { class: 'cell' });
  const head = el('div', { class: 'cell-head' });
  const chartEl = el('div', { class: 'cell-chart' });
  const ohlc = el('div', { class: 'cell-note', style: 'top:4px;bottom:auto' });
  const note = el('div', { class: 'cell-note' });
  const cd = el('div', { class: 'countdown' });
  const vpCanvas = el('canvas', { class: 'vp-canvas' });
  chartEl.append(ohlc, note, cd, vpCanvas);
  node.append(head, chartEl);

  let chart = null, price = null, vol = null, bars = [], feed = null, poll = null, timer = null, token = 0, alive = true;
  let source = 'eod', exchange = null, vpOn = conf.vp, contract = null;

  // ---------- header ----------
  const symSel = el('select', {
    onchange: e => { conf.sym = e.target.value; fixConf(); onChange(); load(); renderHead(); },
  }, ...GROUPS.map(g => el('optgroup', { label: t(g) },
    ...SYMBOLS.filter(s => s.group === g).map(s => el('option', { value: s.id, selected: s.id === conf.sym }, `${s.code} ${name(s)}`)))));
  const ctrEl = el('span', { class: 'ctr' });
  const badge = el('span', { class: 'badge eod' });
  const pxEl = el('span', { class: 'cell-px' });
  const chgEl = el('span', {});
  // data source: 'auto' (live exchanges with failover, Yahoo as last resort), one exchange, or 'yahoo'
  const liveEx = () => exchangesFor(conf.sym);
  const hasYahoo = () => BY_ID[conf.sym].group !== 'crypto';
  const useLive = () => liveEx().length > 0 && conf.src !== 'yahoo';
  function fixConf() {
    const ok = ['auto', ...liveEx(), ...(hasYahoo() ? ['yahoo'] : [])];
    if (!ok.includes(conf.src)) conf.src = 'auto';
    if (!useLive() && conf.tf === '1m') conf.tf = '5m';
  }
  fixConf();
  function srcSelect() {
    if (!liveEx().length) return null;
    const spec = SPECS[BY_ID[conf.sym].price];
    const opts = [['auto', 'AUTO'], ...liveEx().map(ex => [ex, EXCHANGE_LABEL[ex]]),
      ...(hasYahoo() ? [['yahoo', spec ? `${spec.exch} · YAHOO` : 'YAHOO']] : [])];
    return el('select', {
      class: 'src-sel', title: t('datasrc'),
      onchange: e => { conf.src = e.target.value; fixConf(); onChange(); load(); renderHead(); },
    }, ...opts.map(([v, l]) => el('option', { value: v, selected: v === conf.src }, l)));
  }

  function renderHead() {
    head.replaceChildren(symSel, srcSelect() || '',
      seg(Object.keys(TF).map(k => ({ v: k, label: k, disabled: k === '1m' && !useLive() })), conf.tf,
        v => { conf.tf = v; onChange(); load(); }),
      seg([{ v: 'candle', label: '▮▯', title: t('candles') }, { v: 'line', label: '∿', title: t('line') }], conf.type,
        v => { conf.type = v; onChange(); draw(); }),
      seg([{ v: true, label: 'VP', title: t('vp') }], vpOn ? true : null,
        () => { vpOn = !vpOn; conf.vp = vpOn; onChange(); renderHead(); drawVP(); }),
      ctrEl, badge, pxEl, chgEl,
      el('button', { class: 'tbtn max-btn', title: t('maximize'), onclick: () => onMax(node) },
        node.classList.contains('max') ? '⤡' : '⤢'));
  }
  renderHead();
  head.addEventListener('dblclick', e => { if (!e.target.closest('button, select')) onMax(node); });
  new MutationObserver(() => {
    const b = head.querySelector('.max-btn');
    if (b) b.textContent = node.classList.contains('max') ? '⤡' : '⤢';
  }).observe(node, { attributes: true, attributeFilter: ['class'] });

  // ---------- data ----------
  async function load() {
    const my = ++token;
    stopFeeds();
    contract = null; ctrEl.textContent = ''; ctrEl.title = '';
    note.textContent = t('loading');
    if (useLive()) startLive(my);
    else loadDelayed(my);
  }

  function startLive(my) {
    const tf = conf.tf;
    feed = liveFeed(conf.sym, tf, conf.src, {
      onBars: (b, ex) => {
        if (my !== token || !alive) return;
        const fresh = b.map(x => ({ ...x, time: shiftT(x.time, tf) }));
        // reconnect to the same exchange: only merge new bars, keep the user's zoom/scroll
        if (ex === exchange && source === 'live' && bars.length && price) {
          const lastT = bars[bars.length - 1].time;
          fresh.filter(x => x.time >= lastT).forEach(pushBar);
          updateHeader();
          return;
        }
        bars = fresh;
        source = 'live'; exchange = ex;
        note.textContent = '';
        draw();
      },
      onBar: b => {
        if (my !== token || !alive) return;
        pushBar({ ...b, time: shiftT(b.time, tf) });
        updateHeader();
      },
      onError: msg => {
        if (my !== token || !alive) return;
        // every exchange failed: commodities fall back to Yahoo futures data
        if (conf.src === 'auto' && hasYahoo()) { feed?.close(); feed = null; loadDelayed(my); }
        else note.textContent = t('nodata') + ' · ' + msg;
      },
    });
  }

  async function loadDelayed(my) {
    try {
      const [res, ctr] = await Promise.all([loadYahoo(BY_ID[conf.sym], conf.tf), contractFor(BY_ID[conf.sym], conf.tf)]);
      if (my !== token || !alive) return;
      contract = ctr;
      bars = res.bars;
      source = res.source; exchange = null;
      note.textContent = '';
      draw();
      poll = setInterval(() => refreshDelayed(my), POLL_MS);
    } catch (e) {
      if (my !== token) return;
      note.textContent = t('nodata') + ' · ' + e.message;
    }
  }

  async function refreshDelayed(my) {
    try {
      const [res, ctr] = await Promise.all([loadYahoo(BY_ID[conf.sym], conf.tf), contractFor(BY_ID[conf.sym], conf.tf)]);
      if (my !== token || !alive) return;
      contract = ctr;
      const lastT = bars.length ? bars[bars.length - 1].time : 0;
      const fresh = res.bars.filter(b => b.time >= lastT);
      for (const b of fresh) pushBar(b);
      updateHeader();
    } catch { /* keep old data */ }
  }

  function stopFeeds() {
    if (feed) { feed.close(); feed = null; }
    if (poll) { clearInterval(poll); poll = null; }
  }

  function pushBar(b) {
    const last = bars[bars.length - 1];
    if (last && b.time < last.time) return;
    if (last && b.time === last.time) bars[bars.length - 1] = b;
    else bars.push(b);
    if (!price) return;
    price.update(conf.type === 'candle' ? b : { time: b.time, value: b.close });
    if (vol) vol.update(volBar(b));
  }

  // ---------- drawing ----------
  const c = colors();
  const volBar = b => ({ time: b.time, value: b.volume, color: (b.close >= b.open ? c.up : c.down) + '66' });

  function draw() {
    if (chart) { chart.remove(); chart = null; vol = null; price = null; }
    if (!bars.length) return;
    const intraday = TF[conf.tf] < 86400;
    chart = makeChart(chartEl, { timeScale: { borderColor: css('--line'), timeVisible: intraday, secondsVisible: false, rightOffset: 6 } });
    const dp = decimals(bars[bars.length - 1].close);
    const pf = { type: 'price', precision: dp, minMove: Math.pow(10, -dp) };
    if (conf.type === 'candle') {
      price = chart.addSeries(LW.CandlestickSeries, {
        upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderVisible: false, priceFormat: pf,
      });
      price.setData(bars);
    } else {
      price = chart.addSeries(LW.LineSeries, { color: c.line, lineWidth: 2, priceFormat: pf });
      price.setData(bars.map(b => ({ time: b.time, value: b.close })));
    }
    const hasVol = bars.some(b => b.volume > 0);
    if (hasVol) {
      vol = chart.addSeries(LW.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(bars.map(volBar));
    }
    note.textContent = hasVol ? '' : t('novol');
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 150), to: bars.length + 5 });
    chart.timeScale().subscribeVisibleLogicalRangeChange(drawVP);
    chart.subscribeCrosshairMove(p => showOHLC(p, dp));
    showOHLC(null, dp);
    updateHeader();
    drawVP();
  }

  function showOHLC(p, dp) {
    let b = p?.seriesData?.get(price);
    if (b && b.value !== undefined) b = bars.find(x => x.time === b.time);
    if (!b) b = bars[bars.length - 1];
    if (!b) return;
    const v = p?.seriesData?.get(vol)?.value ?? b.volume;
    const cls = b.close >= b.open ? 'up' : 'dn';
    ohlc.replaceChildren('O ', el('span', { class: cls }, fmtPrice(b.open, dp)), '  H ', el('span', { class: cls }, fmtPrice(b.high, dp)),
      '  L ', el('span', { class: cls }, fmtPrice(b.low, dp)), '  C ', el('span', { class: cls }, fmtPrice(b.close, dp)),
      v ? `  V ${fmtInt(v)}` : '');
  }

  function updateHeader() {
    const last = bars[bars.length - 1];
    if (!last) return;
    // change vs ~24h ago (previous bar on daily/weekly)
    let ref;
    if (TF[conf.tf] >= 86400) ref = bars[bars.length - 2];
    else { const target = last.time - 86400; for (let i = bars.length - 1; i >= 0; i--) if (bars[i].time <= target) { ref = bars[i]; break; } }
    pxEl.textContent = fmtPrice(last.close);
    if (ref) {
      const ch = (last.close / ref.close - 1) * 100;
      chgEl.textContent = fmtPct(ch) + (TF[conf.tf] >= 86400 ? '' : ' 24H');
      chgEl.className = signClass(ch);
    }
    badge.className = 'badge ' + source;
    if (source === 'delayed' && isIntra(conf.tf)) {
      const age = Math.max(0, Math.round((Date.now() / 1000 - unshiftT(last.time, conf.tf)) / 60) - Math.round(Math.min(TF[conf.tf], 3600) / 60));
      badge.textContent = `${t('delayed')}${age > 0 && age < 600 ? ' ' + age + 'm' : ''}`;
    } else if (source === 'live') {
      badge.textContent = `${t('live')} · ${EXCHANGE_LABEL[exchange]}`;
      badge.title = marketName(conf.sym, exchange) + (BY_ID[conf.sym].group === 'crypto' ? '' : ' (perpetual)');
    } else badge.textContent = t(source);
    renderContract();
  }

  // what the chart shows: perpetual / spot / index, or the futures contract month
  function renderContract() {
    const sym = BY_ID[conf.sym], kind = instrumentKind(sym, source, exchange), lg = lang();
    if (kind === 'future' && !contract) { ctrEl.textContent = ''; ctrEl.title = ''; return; }
    if (kind !== 'future') {
      ctrEl.textContent = t(kind);
      const tips = { perp: t('perptip'), spot: t(sym.group === 'crypto' ? 'spottipc' : 'spottip'), index: t('indextip'), future: '' };
      const cal = kind === 'perp' && sym.group !== 'crypto' ? frontContract(sym.price) : null;
      ctrEl.title = tips[kind] + (cal ? `\n${t('calfront')}: ${cal.exch} ${cal.code} (${monthLabel(cal, lg)})` : '');
      return;
    }
    ctrEl.textContent = `${contract.est ? '≈ ' : ''}${contract.exch} ${monthLabel(contract, lg)}`;
    const cal = frontContract(sym.price);
    ctrEl.title = [
      `${contract.code} · ${contract.exch}${contract.name ? ' · Yahoo: ' + contract.name : ''}`,
      contract.est ? t('ctrest') : t('ctrfeed'),
      `${t('ctrroll')}: ${dayLabel(contract.until)}`,
      cal && cal.code !== contract.code ? `${t('calfront')}: ${cal.code} (${monthLabel(cal, lg)})` : '',
      contract.split ? `${t('ctrsplit')}: ${t('ctrdaily')} ${monthLabel(contract.split.daily, lg)}, ${t('ctrintra')} ${monthLabel(contract.split.intraday, lg)}` : '',
      t('ctrcont'),
    ].filter(Boolean).join('\n');
  }

  // ---------- countdown (re-positioned under the last price label every second) ----------
  function tickCountdown() {
    if (!price || !bars.length) { cd.textContent = ''; return; }
    const left = nextClose(conf.tf, source === 'live') - Date.now() / 1000;
    const last = bars[bars.length - 1];
    const y = price.priceToCoordinate(last.close);
    if (y === null || left < 0) { cd.textContent = ''; return; }
    cd.textContent = fmtDur(left);
    cd.title = t('closesin');
    cd.style.top = `${y}px`;
    cd.style.width = `${chart.priceScale('right').width()}px`;
    cd.style.background = last.close >= last.open ? c.up : c.down;
    if (vpOn) drawVP();
  }
  timer = setInterval(tickCountdown, 1000);

  // ---------- volume profile ----------
  function drawVP() {
    const ctx = vpCanvas.getContext('2d');
    const w = chartEl.clientWidth, h = chartEl.clientHeight, dpr = window.devicePixelRatio || 1;
    if (vpCanvas.width !== Math.round(w * dpr) || vpCanvas.height !== Math.round(h * dpr)) {
      vpCanvas.width = Math.round(w * dpr); vpCanvas.height = Math.round(h * dpr);
      vpCanvas.style.width = w + 'px'; vpCanvas.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!vpOn || !chart || !bars.length) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const from = Math.max(0, Math.floor(range.from)), to = Math.min(bars.length - 1, Math.ceil(range.to));
    if (to <= from) return;
    let lo = Infinity, hi = -Infinity, useVol = false;
    for (let i = from; i <= to; i++) { lo = Math.min(lo, bars[i].low); hi = Math.max(hi, bars[i].high); if (bars[i].volume > 0) useVol = true; }
    if (!(hi > lo)) return;
    const ROWS = 48, step = (hi - lo) / ROWS, prof = new Array(ROWS).fill(0);
    for (let i = from; i <= to; i++) {
      const b = bars[i], wgt = useVol ? b.volume : 1;
      const r0 = Math.min(ROWS - 1, Math.floor((b.low - lo) / step)), r1 = Math.min(ROWS - 1, Math.floor((b.high - lo) / step));
      const share = wgt / (r1 - r0 + 1);
      for (let r = r0; r <= r1; r++) prof[r] += share;
    }
    const total = prof.reduce((a, b) => a + b, 0);
    let poc = 0;
    prof.forEach((v, r) => { if (v > prof[poc]) poc = r; });
    // value area: grow around POC until 70% of volume
    let a = poc, b = poc, acc = prof[poc];
    while (acc < total * 0.7 && (a > 0 || b < ROWS - 1)) {
      const up = b < ROWS - 1 ? prof[b + 1] : -1, dn = a > 0 ? prof[a - 1] : -1;
      if (up >= dn) acc += prof[++b]; else acc += prof[--a];
    }
    const plotW = w - chart.priceScale('right').width();
    const maxW = plotW * 0.25, maxV = prof[poc] || 1;
    const amber = css('--amber'), muted = css('--muted');
    for (let r = 0; r < ROWS; r++) {
      const yTop = price.priceToCoordinate(lo + (r + 1) * step), yBot = price.priceToCoordinate(lo + r * step);
      if (yTop === null || yBot === null) continue;
      const bw = prof[r] / maxV * maxW;
      ctx.globalAlpha = r === poc ? 0.85 : r >= a && r <= b ? 0.4 : 0.18;
      ctx.fillStyle = r === poc ? amber : r >= a && r <= b ? amber : muted;
      ctx.fillRect(plotW - bw, yTop, bw, Math.max(1, yBot - yTop - 1));
    }
    const yPoc = price.priceToCoordinate(lo + (poc + 0.5) * step);
    if (yPoc !== null) {
      ctx.globalAlpha = 0.7; ctx.strokeStyle = amber; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, yPoc); ctx.lineTo(plotW, yPoc); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.fillStyle = amber; ctx.font = "10px 'Roboto Mono', monospace";
      ctx.fillText('POC', 4, yPoc - 3);
    }
    ctx.globalAlpha = 1;
  }

  load();
  return {
    node,
    destroy() { alive = false; token++; stopFeeds(); clearInterval(timer); if (chart) chart.remove(); },
  };
}

// ---------------------------------------------------------------- data sources
// Contract Yahoo is quoting per price key, confirmed by price in the fetch scripts. Near a roll Yahoo's
// intraday and daily series can follow different months (24 Oct 2026: natural gas intraday on Dec, daily
// on Nov), so each timeframe reads its own source first: intraday meta (every deploy) or the daily index.
let ctrFeed = { at: 0, p: null };
function feedContracts(key) {
  if (!ctrFeed.p || Date.now() - ctrFeed.at > POLL_MS / 2) {
    ctrFeed = { at: Date.now(), p: Promise.all([
      loadJSON('data/intraday/meta.json', true).catch(() => ({})),
      loadJSON('data/prices/index.json').catch(() => ({})),
    ]) };
  }
  return ctrFeed.p.then(([m, i]) => ({ intra: m[key]?.contract, daily: i[key]?.contract }));
}
const sameMonth = (a, b) => a.month === b.month && a.year === b.year;
async function contractFor(sym, tf) {
  if (!SPECS[sym.price]) return null;
  const f = await feedContracts(sym.price);
  const [mine, other] = isIntra(tf) ? [f.intra, f.daily] : [f.daily, f.intra];
  const c = resolveContract(sym.price, mine || other);
  if (c && mine && other && !sameMonth(mine, other)) c.split = { intraday: f.intra, daily: f.daily };
  return c;
}

const isIntra = tf => TF[tf] < 86400;
const shiftT = (ts, tf) => isIntra(tf) ? ts + TZ_SHIFT : ts;
const unshiftT = (ts, tf) => isIntra(tf) ? ts - TZ_SHIFT : ts;

function fromCols(d, timeOf) {
  const out = [];
  for (let i = 0; i < d.t.length; i++)
    out.push({ time: timeOf(d.t[i]), open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i] });
  return out;
}

// Group bars into buckets of `sec` seconds (UTC aligned; weeks start Monday).
function aggregate(bars, sec) {
  const MON = 4 * 86400;
  const bucket = t => sec === 604800 ? Math.floor((t - MON) / sec) * sec + MON : Math.floor(t / sec) * sec;
  const out = [];
  for (const b of bars) {
    const k = bucket(b.time), last = out[out.length - 1];
    if (last && last.time === k) {
      last.high = Math.max(last.high, b.high); last.low = Math.min(last.low, b.low);
      last.close = b.close; last.volume += b.volume;
    } else out.push({ ...b, time: k });
  }
  return out;
}

async function dailyBars(sym, tf) {
  const d = await loadJSON(`data/prices/${sym.price}.json`);
  let bars = fromCols(d, dayTime);
  // extend with today's session built from hourly bars (futures/FX sessions roll at ~18:00 New York),
  // unless the hourly series is on another contract month than the daily one (mid-roll)
  const f = SPECS[sym.price] ? await feedContracts(sym.price) : {};
  if (f.intra && f.daily && !sameMonth(f.intra, f.daily)) return tf === '1W' ? aggregate(bars, TF['1W']) : bars;
  try {
    const h = await loadJSON(`data/intraday/${sym.price}_1h.json`, true);
    const lastDay = d.t[d.t.length - 1];
    const roll = sym.group === 'fx' ? 7 * 3600 : 6 * 3600;
    const extra = new Map();
    for (let i = 0; i < h.t.length; i++) {
      const day = nyDate.format(new Date((h.t[i] + roll) * 1000));
      if (day < lastDay) continue;
      const b = { open: h.o[i], high: h.h[i], low: h.l[i], close: h.c[i], volume: h.v[i] };
      const e = extra.get(day);
      if (!e) extra.set(day, { time: dayTime(day), ...b });
      else { e.high = Math.max(e.high, b.high); e.low = Math.min(e.low, b.low); e.close = b.close; e.volume += b.volume; }
    }
    if (extra.size) {
      bars = bars.filter(b => b.time < dayTime(lastDay));
      bars.push(...[...extra.values()].sort((a, b) => a.time - b.time));
    }
  } catch { /* no intraday file: plain EOD */ }
  return tf === '1W' ? aggregate(bars, TF['1W']) : bars;
}

// Intraday files change every deploy, so they always bypass the HTTP cache.
async function loadYahoo(sym, tf) {
  if (!isIntra(tf)) {
    const bars = await dailyBars(sym, tf);
    return { source: 'delayed', bars };
  }
  const file = TF[tf] >= 3600 ? '1h' : '5m';
  const d = await loadJSON(`data/intraday/${sym.price}_${file}.json`, true);
  const raw = fromCols(d, ts => ts);
  const bars = aggregate(raw, TF[tf]).map(b => ({ ...b, time: b.time + TZ_SHIFT }));
  return { source: 'delayed', bars };
}

// ---------------------------------------------------------------- countdown
function nyParts(ts) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ts * 1000)).reduce((o, x) => (o[x.type] = x.value, o), {});
  return p;
}
// unix time of the next 17:00 New York on an allowed weekday
function nextNY17(now, days) {
  for (let k = 0; k < 9; k++) {
    const probe = now + k * 86400;
    const p = nyParts(probe);
    const secs = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
    const target = probe - secs + 17 * 3600;
    if (target > now && days.includes(p.weekday)) return target;
  }
  return now + 86400;
}
function nextClose(tf, crypto) {
  const now = Date.now() / 1000;
  const p = TF[tf];
  if (p < 86400) return Math.ceil((now + 0.001) / p) * p;
  if (crypto) {
    if (tf === '1D') return Math.ceil((now + 0.001) / 86400) * 86400;
    const MON = 4 * 86400;
    return Math.floor((now - MON) / 604800) * 604800 + MON + 604800;
  }
  return tf === '1D' ? nextNY17(now, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) : nextNY17(now, ['Fri']);
}
function fmtDur(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  const pad = x => String(x).padStart(2, '0');
  return d ? `${d}d ${pad(h)}:${pad(m)}` : h ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
