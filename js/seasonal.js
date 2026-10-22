// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Seasonal tab: year-over-year overlays, multi-product comparison and an overview grid.
import { SYMBOLS, BY_ID, GROUPS, SERIES_COLORS } from './config.js';
import { t, name, months } from './i18n.js';
import { el, loadJSON, makeChart, LW, store, fmtPrice, fmtPct, signClass, dayTime, isoDay, colors, css, corr, decimals } from './util.js';
import { seg, symbolSidebar, loadingBox, fullscreenBtn } from './ui.js';

const NOW_YEAR = new Date().getUTCFullYear();
const BASE_YEAR = 2000; // leap year: every calendar day maps onto it

const calTime = d => Date.UTC(BASE_YEAR, +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000;
const loadPx = s => loadJSON(`data/prices/${s.price}.json`);

// Split daily closes into calendar years. pct is measured from the last close of the prior year.
function byYear(px) {
  const out = {};
  let prevYearClose = null, curYear = null, lastClose = null;
  for (let i = 0; i < px.t.length; i++) {
    const d = px.t[i], y = +d.slice(0, 4), c = px.c[i];
    if (y !== curYear) { prevYearClose = lastClose; curYear = y; }
    lastClose = c;
    if (prevYearClose === null) continue; // first (partial) year has no base
    (out[y] ||= []).push({ d, time: calTime(d), c, pct: (c / prevYearClose - 1) * 100 });
  }
  return out;
}

// Average path of the N complete years before the current year, one value per calendar day.
function averagePath(years, n) {
  const pick = Object.keys(years).map(Number).filter(y => y < NOW_YEAR).sort((a, b) => b - a).slice(0, n);
  if (pick.length < Math.min(n, 3)) return null;
  const days = [];
  for (let k = 0; k < 366; k++) days.push(Date.UTC(BASE_YEAR, 0, 1) / 1000 + k * 86400);
  const sum = new Array(366).fill(0);
  for (const y of pick) {
    const rows = years[y];
    let j = 0, v = 0;
    for (let k = 0; k < 366; k++) {
      while (j < rows.length && rows[j].time <= days[k]) { v = rows[j].pct; j++; }
      sum[k] += v;
    }
  }
  return { years: pick, data: days.map((time, k) => ({ time, value: sum[k] / pick.length })) };
}

function seasonalTimeScale(chart) {
  const m = months();
  chart.applyOptions({
    localization: { timeFormatter: ts => { const d = new Date(ts * 1000); return `${m[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`; } },
    timeScale: {
      tickMarkFormatter: (ts, type) => {
        const d = new Date(ts * 1000);
        return type === 2 ? String(d.getUTCDate()) : m[d.getUTCMonth()];
      },
    },
  });
}

const pctFmt = { type: 'custom', formatter: v => (v > 0 ? '+' : '') + v.toFixed(1) + '%', minMove: 0.01 };

function heatStyle(v, scale = 10) {
  if (v === null || v === undefined || isNaN(v)) return '';
  const a = Math.min(Math.abs(v) / scale, 1) * 0.55 + 0.05;
  const rgb = v >= 0 ? '0,193,118' : '255,67,61';
  return `background:rgba(${rgb},${a.toFixed(2)})`;
}

function legendFor(chart, items, legend) {
  const draw = param => legend.replaceChildren(...items.map(it => {
    let v = param?.seriesData?.get(it.s);
    v = v?.value;
    if (v === undefined) { const d = it.s.data(); v = d[d.length - 1]?.value; }
    return el('span', {}, el('i', { style: `background:${it.color}` }), it.label + ': ',
      el('b', { class: it.pct === false ? '' : signClass(v) }, v === undefined ? '—' : it.fmt ? it.fmt(v) : fmtPct(v)));
  }));
  chart.subscribeCrosshairMove(draw);
  draw();
}

export function mount(root) {
  const st = {
    mode: store.get('sea.mode', 'single'),
    sym: store.get('sea.sym', 'GOLD'),
    years: store.get('sea.years', [NOW_YEAR, NOW_YEAR - 1]),
    avgs: store.get('sea.avgs', [5]),
    val: store.get('sea.val', 'pct'),
    cmp: store.get('sea.cmp', ['GOLD', 'SILVER', 'WTI', 'CORN', 'BTC']),
    base: store.get('sea.base', 'YTD'),
    custom: store.get('sea.custom', `${NOW_YEAR - 1}-01-01`),
    gridGroup: store.get('sea.gridGroup', 'all'),
  };
  const save = () => Object.keys(st).forEach(k => store.set('sea.' + k, st[k]));
  let charts = [], token = 0;
  const dispose = () => { charts.forEach(c => c.remove()); charts = []; };

  function render() {
    const my = ++token;
    dispose();
    root.replaceChildren();
    const modeBar = el('div', { class: 'bar' },
      el('span', { class: 'bar-title' }, t('seasonal')),
      seg([{ v: 'single', label: t('single') }, { v: 'compare', label: t('compare') }, { v: 'grid', label: t('grid') }], st.mode,
        v => { st.mode = v; save(); render(); }));
    const body = el('div', { class: 'content' });
    const right = el('div', { class: 'content' }, modeBar, body);
    modeBar.append(fullscreenBtn(() => right));
    if (st.mode === 'single') {
      const sb = symbolSidebar({ active: st.sym, onSelect: id => { st.sym = id; save(); render(); } });
      root.append(sb.side, right);
      right.insertBefore(sb.mobile, body);
      renderSingle(body, my);
    } else if (st.mode === 'compare') {
      const sb = symbolSidebar({
        active: id => st.cmp.includes(id), onSelect: id => {
          st.cmp = st.cmp.includes(id) ? st.cmp.filter(x => x !== id) : [...st.cmp, id];
          save(); render();
        },
      });
      root.append(sb.side, right);
      right.insertBefore(sb.mobile, body);
      renderCompare(body, my);
    } else {
      root.append(right);
      renderGrid(body, my);
    }
  }

  // ---------- single product ----------
  async function renderSingle(body, my) {
    body.append(loadingBox());
    const sym = BY_ID[st.sym];
    const px = await loadPx(sym);
    if (my !== token) return;
    const years = byYear(px);
    const allYears = Object.keys(years).map(Number).sort((a, b) => b - a);
    st.years = st.years.filter(y => years[y]);
    if (!st.years.length) st.years = allYears.slice(0, 2);
    const c = colors();
    const yearColor = y => y === NOW_YEAR ? c.line : SERIES_COLORS[1 + (NOW_YEAR - y - 1) % (SERIES_COLORS.length - 1)];

    const yearChips = el('div', { class: 'chips' }, ...allYears.map(y => {
      const on = st.years.includes(y);
      const ch = el('button', { class: 'chip' + (on ? ' on' : ''), style: on ? `color:${yearColor(y)}` : '' }, String(y));
      ch.onclick = () => { st.years = on ? st.years.filter(x => x !== y) : [...st.years, y]; save(); render(); };
      return ch;
    }), el('button', { class: 'chip', onclick: () => { st.years = [NOW_YEAR]; save(); render(); } }, t('clear')));
    const avgChips = el('div', { class: 'chips' }, ...[5, 10, 15].map(n => {
      const on = st.avgs.includes(n);
      const ch = el('button', { class: 'chip' + (on ? ' on' : ''), disabled: st.val !== 'pct' }, `${t('avg')} ${n}Y`);
      ch.onclick = () => { st.avgs = on ? st.avgs.filter(x => x !== n) : [...st.avgs, n]; save(); render(); };
      return ch;
    }));
    const bar = el('div', { class: 'bar' },
      el('span', { class: 'bar-title' }, `${sym.code} · ${name(sym).toUpperCase()}`),
      el('span', {}, el('span', { class: 'lbl' }, t('mode')),
        seg([{ v: 'pct', label: t('ytd') }, { v: 'price', label: t('rawprice') }], st.val, v => { st.val = v; save(); render(); })),
      el('span', {}, el('span', { class: 'lbl' }, t('averages')), avgChips));
    const yearBar = el('div', { class: 'bar' }, el('span', { class: 'lbl' }, t('years')), yearChips);
    const legend = el('div', { class: 'legend' });
    const box = el('div', { class: 'chart-box sea-chart' });
    const tables = el('div', { class: 'sea-split' });
    body.replaceChildren(bar, yearBar, legend, box, el('div', { class: 'note' }, t('seasnote')), el('div', { class: 'sea-wrap' }, tables));

    const chart = makeChart(box);
    charts.push(chart);
    seasonalTimeScale(chart);
    const items = [];
    const dp = decimals(px.c[px.c.length - 1]);
    for (const y of [...st.years].sort()) {
      const s = chart.addSeries(LW.LineSeries, {
        color: yearColor(y), lineWidth: y === NOW_YEAR ? 3 : 1.5, priceLineVisible: false, lastValueVisible: y === NOW_YEAR,
        priceFormat: st.val === 'pct' ? pctFmt : { type: 'price', precision: dp, minMove: Math.pow(10, -dp) },
      });
      s.setData(years[y].map(r => ({ time: r.time, value: st.val === 'pct' ? r.pct : r.c })));
      items.push({ s, label: String(y), color: yearColor(y), pct: st.val === 'pct', fmt: st.val === 'pct' ? null : v => fmtPrice(v, dp) });
    }
    if (st.val === 'pct') {
      for (const n of st.avgs) {
        const avg = averagePath(years, n);
        if (!avg) continue;
        const col = { 5: css('--blue'), 10: '#2ec4b6', 15: '#c678dd' }[n];
        const s = chart.addSeries(LW.LineSeries, { color: col, lineWidth: 2, lineStyle: LW.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, priceFormat: pctFmt });
        s.setData(avg.data);
        items.push({ s, label: `${t('avg')} ${n}Y (${avg.years[avg.years.length - 1]}–${avg.years[0]})`, color: col });
      }
      const zero = items[0]?.s;
      zero?.createPriceLine({ price: 0, color: css('--muted'), lineWidth: 1, lineStyle: LW.LineStyle.Dotted, axisLabelVisible: false });
    }
    legendFor(chart, items, legend);
    chart.timeScale().fitContent();

    // stats per selected year
    const today = calTime(isoDay(Date.now() / 1000));
    const statRows = [...st.years].sort((a, b) => b - a).map(y => {
      const rows = years[y];
      const atToday = [...rows].reverse().find(r => r.time <= today);
      const pcts = rows.map(r => r.pct);
      return el('tr', {},
        el('td', { style: `color:${yearColor(y)}` }, String(y)),
        el('td', { class: signClass(atToday?.pct) }, fmtPct(atToday?.pct)),
        el('td', { class: signClass(pcts[pcts.length - 1]) }, y === NOW_YEAR ? '—' : fmtPct(pcts[pcts.length - 1])),
        el('td', { class: 'up' }, fmtPct(Math.max(...pcts))),
        el('td', { class: 'dn' }, fmtPct(Math.min(...pcts))));
    });
    const stats = el('div', { class: 'panel' }, el('div', { class: 'panel-head' }, `${t('years')} · ${sym.code}`),
      el('div', { class: 'table-scroll' }, el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {}, ...[t('year'), t('ytdnow'), t('fullyear'), t('max'), t('min')].map(h => el('th', {}, h)))),
        el('tbody', {}, statRows))));

    // quarterly + monthly return heatmaps (period-end close vs previous period-end close)
    const ends = periodEnds(px);
    const qRows = allYears.slice(0, 15).map(y => el('tr', {}, el('td', {}, String(y)),
      ...[1, 2, 3, 4].map(q => { const v = ends.q[`${y}-${q}`]; return el('td', { style: heatStyle(v, 15) }, fmtPct(v, 1)); }),
      (() => { const v = ends.y[y]; return el('td', { style: heatStyle(v, 30) }, fmtPct(v, 1)); })()));
    const quarterly = el('div', { class: 'panel' }, el('div', { class: 'panel-head' }, t('quarterly')),
      el('div', { class: 'table-scroll' }, el('table', { class: 'tbl heat' },
        el('thead', {}, el('tr', {}, el('th', {}, t('year')), ...['Q1', 'Q2', 'Q3', 'Q4', t('year')].map(h => el('th', {}, h)))),
        el('tbody', {}, qRows))));
    const m = months();
    const avgM = m.map((_, k) => {
      const vals = allYears.filter(y => y < NOW_YEAR).slice(0, 15).map(y => ends.m[`${y}-${k + 1}`]).filter(v => v !== undefined);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    });
    const winM = m.map((_, k) => {
      const vals = allYears.filter(y => y < NOW_YEAR).slice(0, 15).map(y => ends.m[`${y}-${k + 1}`]).filter(v => v !== undefined);
      return vals.length ? vals.filter(v => v > 0).length / vals.length * 100 : NaN;
    });
    const mRows = [
      el('tr', {}, el('td', { class: 'amber' }, `${t('avg')} 15Y`), ...avgM.map(v => el('td', { style: heatStyle(v, 5) }, fmtPct(v, 1)))),
      el('tr', {}, el('td', { class: 'amber' }, 'WIN %'), ...winM.map(v => el('td', {}, isNaN(v) ? '—' : v.toFixed(0) + '%'))),
      ...allYears.slice(0, 15).map(y => el('tr', {}, el('td', {}, String(y)),
        ...m.map((_, k) => { const v = ends.m[`${y}-${k + 1}`]; return el('td', { style: heatStyle(v, 8) }, fmtPct(v, 1)); }))),
    ];
    const monthly = el('div', { class: 'panel', style: 'grid-column:1/-1' }, el('div', { class: 'panel-head' }, t('monthly')),
      el('div', { class: 'table-scroll' }, el('table', { class: 'tbl heat' },
        el('thead', {}, el('tr', {}, el('th', {}, t('year')), ...m.map(h => el('th', {}, h)))),
        el('tbody', {}, mRows))));
    tables.append(stats, quarterly, monthly);
  }

  // ---------- multi-product compare ----------
  async function renderCompare(body, my) {
    body.append(loadingBox());
    const syms = st.cmp.map(id => BY_ID[id]).filter(Boolean);
    const pxs = await Promise.all(syms.map(s => loadPx(s).catch(() => null)));
    if (my !== token) return;
    const baseDate = baseFor(st.base, st.custom);

    const dateIn = el('input', { type: 'date', value: st.custom });
    dateIn.onchange = () => { st.custom = dateIn.value; st.base = 'CUSTOM'; save(); render(); };
    const bar = el('div', { class: 'bar' },
      el('span', {}, el('span', { class: 'lbl' }, t('base')),
        seg(['YTD', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'CUSTOM'].map(v => ({ v, label: v === 'CUSTOM' ? t('custom') : v })), st.base,
          v => { st.base = v; save(); render(); })),
      el('span', {}, el('span', { class: 'lbl' }, t('from')), dateIn),
      el('div', { class: 'chips' }, ...syms.map((s, k) => {
        const ch = el('button', { class: 'chip on', style: `color:${SERIES_COLORS[k % SERIES_COLORS.length]}`, title: '✕' },
          el('span', { class: 'dot', style: `background:${SERIES_COLORS[k % SERIES_COLORS.length]}` }), s.code, ' ✕');
        ch.onclick = () => { st.cmp = st.cmp.filter(x => x !== s.id); save(); render(); };
        return ch;
      })));
    const legend = el('div', { class: 'legend' });
    const box = el('div', { class: 'chart-box sea-chart' });
    const split = el('div', { class: 'sea-split' });
    body.replaceChildren(bar, legend, box, el('div', { class: 'sea-wrap' }, split));

    const chart = makeChart(box);
    charts.push(chart);
    const items = [], perf = [], rets = [];
    syms.forEach((s, k) => {
      const px = pxs[k];
      if (!px) return;
      const start = px.t.findIndex(d => d >= baseDate);
      if (start < 0) return;
      const b = start > 0 ? px.c[start - 1] : px.c[start];
      const data = [];
      const r = new Map();
      for (let i = start; i < px.t.length; i++) {
        data.push({ time: dayTime(px.t[i]), value: (px.c[i] / b - 1) * 100 });
        if (i > 0) r.set(px.t[i], Math.log(px.c[i] / px.c[i - 1]));
      }
      const color = SERIES_COLORS[k % SERIES_COLORS.length];
      const se = chart.addSeries(LW.LineSeries, { color, lineWidth: 2, priceLineVisible: false, priceFormat: pctFmt, title: s.code });
      se.setData(data);
      items.push({ s: se, label: s.code, color });
      perf.push({ s, color, last: px.c[px.c.length - 1], pct: data[data.length - 1].value });
      rets.push({ s, r });
    });
    items[0]?.s.createPriceLine({ price: 0, color: css('--muted'), lineWidth: 1, lineStyle: LW.LineStyle.Dotted, axisLabelVisible: false });
    legendFor(chart, items, legend);
    chart.timeScale().fitContent();

    perf.sort((a, b) => b.pct - a.pct);
    const maxAbs = Math.max(1, ...perf.map(p => Math.abs(p.pct)));
    const perfTbl = el('div', { class: 'panel' }, el('div', { class: 'panel-head' }, `${t('perf')} · ${t('from')} ${baseDate}`),
      el('table', { class: 'tbl' }, el('tbody', {}, perf.map(p => el('tr', {},
        el('td', {}, el('span', { class: 'swatch', style: `background:${p.color}` }), el('b', {}, p.s.code), ' ', name(p.s)),
        el('td', {}, fmtPrice(p.last)),
        el('td', { style: 'width:40%' }, el('span', {
          style: `display:inline-block;height:9px;width:${(Math.abs(p.pct) / maxAbs * 100).toFixed(1)}%;background:${p.pct >= 0 ? 'var(--up)' : 'var(--dn)'}`,
        })),
        el('td', { class: signClass(p.pct) }, fmtPct(p.pct)))))));

    const head = el('tr', {}, el('th', {}, ''), ...rets.map(x => el('th', {}, x.s.code)));
    const rows = rets.map(a => el('tr', {}, el('td', {}, el('b', { class: 'amber' }, a.s.code)), ...rets.map(b => {
      const common = [...a.r.keys()].filter(d => b.r.has(d));
      const v = a === b ? 1 : corr(common.map(d => a.r.get(d)), common.map(d => b.r.get(d)));
      return el('td', { style: heatStyle(v * 100, 100) }, isNaN(v) ? '—' : v.toFixed(2));
    })));
    const corrTbl = el('div', { class: 'panel' }, el('div', { class: 'panel-head' }, t('corr')),
      el('div', { class: 'table-scroll' }, el('table', { class: 'tbl heat' }, el('thead', {}, head), el('tbody', {}, rows))));
    split.append(perfTbl, corrTbl);
  }

  // ---------- overview grid ----------
  async function renderGrid(body, my) {
    const c = colors();
    const groupSeg = seg([{ v: 'all', label: t('all') }, ...GROUPS.map(g => ({ v: g, label: t(g) }))], st.gridGroup,
      v => { st.gridGroup = v; save(); render(); });
    const legend = el('div', { class: 'legend' },
      el('span', {}, el('i', { style: `background:${c.line}` }), `${NOW_YEAR}`),
      el('span', {}, el('i', { style: `background:${css('--muted')}` }), `${NOW_YEAR - 1}`),
      el('span', {}, el('i', { style: `background:${css('--blue')}` }), `${t('avg')} 5Y`));
    const grid = el('div', { class: 'mini-grid' });
    body.append(el('div', { class: 'bar' }, groupSeg), legend, el('div', { class: 'note' }, t('seasnote')), grid);
    const syms = SYMBOLS.filter(s => st.gridGroup === 'all' || s.group === st.gridGroup);
    await Promise.all(syms.map(async s => {
      const val = el('span', { class: 'mini-head-val' }, '…');
      const box = el('div', { class: 'chart-box mini-chart' });
      grid.append(el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, el('b', {}, s.code), el('span', { class: 'muted' }, name(s)), val), box));
      const px = await loadPx(s).catch(() => null);
      if (my !== token || !px) return;
      const years = byYear(px);
      const chart = makeChart(box, { handleScroll: false, handleScale: false, rightPriceScale: { borderColor: css('--line'), scaleMargins: { top: 0.1, bottom: 0.1 } } });
      charts.push(chart);
      seasonalTimeScale(chart);
      const avg = averagePath(years, 5);
      if (avg) {
        chart.addSeries(LW.LineSeries, { color: css('--blue'), lineWidth: 1, lineStyle: LW.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, priceFormat: pctFmt })
          .setData(avg.data);
      }
      if (years[NOW_YEAR - 1]) {
        chart.addSeries(LW.LineSeries, { color: css('--muted'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: pctFmt })
          .setData(years[NOW_YEAR - 1].map(r => ({ time: r.time, value: r.pct })));
      }
      if (years[NOW_YEAR]) {
        const cur = years[NOW_YEAR];
        chart.addSeries(LW.LineSeries, { color: c.line, lineWidth: 2, priceLineVisible: false, priceFormat: pctFmt })
          .setData(cur.map(r => ({ time: r.time, value: r.pct })));
        const v = cur[cur.length - 1].pct;
        val.textContent = fmtPct(v);
        val.className = 'mini-head-val ' + signClass(v);
      }
      chart.timeScale().fitContent();
    }));
  }

  render();
  return () => { token++; dispose(); };
}

function baseFor(base, custom) {
  const d = new Date();
  const back = { '1M': [0, 1], '3M': [0, 3], '6M': [0, 6], '1Y': [1, 0], '3Y': [3, 0], '5Y': [5, 0] }[base];
  if (base === 'YTD') return `${d.getUTCFullYear()}-01-01`;
  if (base === 'CUSTOM') return custom;
  d.setUTCFullYear(d.getUTCFullYear() - back[0]);
  d.setUTCMonth(d.getUTCMonth() - back[1]);
  return d.toISOString().slice(0, 10);
}

// Returns % change per month / quarter / year keyed "YYYY-M", "YYYY-Q", "YYYY".
function periodEnds(px) {
  const lastOf = { m: {}, q: {}, y: {} };
  for (let i = 0; i < px.t.length; i++) {
    const y = +px.t[i].slice(0, 4), mo = +px.t[i].slice(5, 7);
    lastOf.m[`${y}-${mo}`] = px.c[i];
    lastOf.q[`${y}-${Math.ceil(mo / 3)}`] = px.c[i];
    lastOf.y[y] = px.c[i];
  }
  const out = { m: {}, q: {}, y: {} };
  for (const k in lastOf.m) {
    const [y, mo] = k.split('-').map(Number);
    const prev = mo === 1 ? lastOf.m[`${y - 1}-12`] : lastOf.m[`${y}-${mo - 1}`];
    if (prev) out.m[k] = (lastOf.m[k] / prev - 1) * 100;
  }
  for (const k in lastOf.q) {
    const [y, q] = k.split('-').map(Number);
    const prev = q === 1 ? lastOf.q[`${y - 1}-4`] : lastOf.q[`${y}-${q - 1}`];
    if (prev) out.q[k] = (lastOf.q[k] / prev - 1) * 100;
  }
  for (const y in lastOf.y) if (lastOf.y[y - 1]) out.y[y] = (lastOf.y[y] / lastOf.y[y - 1] - 1) * 100;
  return out;
}
