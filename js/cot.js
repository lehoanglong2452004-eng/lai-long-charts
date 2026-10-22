// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// COT tab: positioning of trader groups (Legacy / Disaggregated / TFF) with price, OI and COT Index.
import { SYMBOLS, BY_ID, GROUPS, COT_GROUPS } from './config.js';
import { t, name } from './i18n.js';
import { el, loadJSON, makeChart, LW, store, fmtInt, fmtSigned, fmtPrice, signClass, dayTime, decimals, colors, css } from './util.js';
import { seg, symbolSidebar, loadingBox } from './ui.js';

const OVERVIEW = '__ALL__';
const RANGES = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, MAX: 99 };

export function mount(root) {
  const st = {
    sym: store.get('cot.sym', OVERVIEW),
    report: store.get('cot.report', 'legacy'),
    view: store.get('cot.view', 'net'),
    range: store.get('cot.range', '5Y'),
    lookback: store.get('cot.lookback', 52),
    lsGroup: null,
  };
  let chart = null, token = 0;
  const save = () => ['sym', 'report', 'view', 'range', 'lookback'].forEach(k => store.set('cot.' + k, st[k]));

  const content = el('section', { class: 'content' });
  const sb = symbolSidebar({
    filter: s => s.cot,
    active: st.sym,
    extraTop: { id: OVERVIEW, label: t('overview') },
    onSelect: id => { st.sym = id; st.lsGroup = null; sb.setActive(id); save(); render(); },
  });
  root.append(sb.side, el('div', { class: 'content', style: 'overflow:auto' }, sb.mobile, content));

  function disposeChart() { if (chart) { chart.remove(); chart = null; } }

  async function render() {
    const my = ++token;
    disposeChart();
    content.replaceChildren(loadingBox());
    try {
      if (st.sym === OVERVIEW) await renderOverview(my);
      else await renderMarket(my);
    } catch (e) {
      if (my === token) content.replaceChildren(el('div', { class: 'loading' }, t('nodata') + ' · ' + e.message));
    }
  }

  // ---------- single market ----------
  async function renderMarket(my) {
    const sym = BY_ID[st.sym];
    const index = await loadJSON('data/cot/index.json');
    const avail = index[sym.cot]?.reports || [];
    if (!avail.includes(st.report)) st.report = avail[0] || 'legacy';
    const [cot, px] = await Promise.all([
      loadJSON(`data/cot/${st.report}/${sym.cot}.json`),
      loadJSON(`data/prices/${sym.cotPrice || sym.price}.json`).catch(() => null),
    ]);
    if (my !== token) return;
    const groups = COT_GROUPS[st.report];
    if (!st.lsGroup || !groups.find(g => g.k === st.lsGroup)) st.lsGroup = groups.find(g => g.spec).k;

    const n = cot.date.length;
    const times = cot.date.map(dayTime);
    const net = Object.fromEntries(groups.map(g => [g.k, cot[g.k + '_l'].map((v, i) => v - cot[g.k + '_s'][i])]));

    // toolbar
    const bar = el('div', { class: 'bar' },
      el('span', { class: 'bar-title' }, `${sym.code} · ${name(sym).toUpperCase()}`),
      el('span', { class: 'bar-sub' }, cot.market),
      seg(['legacy', 'disagg', 'tff'].map(r => ({ v: r, label: t(r), disabled: !avail.includes(r) })), st.report,
        v => { st.report = v; save(); render(); }),
      seg([{ v: 'net', label: t('net') }, { v: 'longshort', label: t('longshort') }, { v: 'index', label: t('cotindex') }], st.view,
        v => { st.view = v; save(); render(); }),
      el('span', {}, el('span', { class: 'lbl' }, t('lookback')),
        seg([26, 52, 156].map(w => ({ v: w, label: w + t('weeks') })), st.lookback, v => { st.lookback = v; save(); render(); })),
      el('span', {}, el('span', { class: 'lbl' }, t('range')),
        seg(Object.keys(RANGES).map(r => ({ v: r, label: r })), st.range, v => { st.range = v; save(); applyRange(); })),
    );
    if (st.view === 'longshort') {
      bar.append(el('span', {}, el('span', { class: 'lbl' }, t('group')),
        seg(groups.map(g => ({ v: g.k, label: g.short })), st.lsGroup, v => { st.lsGroup = v; render(); })));
    }

    const legend = el('div', { class: 'legend' });
    const chartBox = el('div', { class: 'chart-box cot-chart' });
    const tableWrap = el('div', { class: 'cot-table-wrap table-scroll' });
    content.replaceChildren(bar, legend, chartBox, tableWrap, el('div', { class: 'note' }, t('cotnote')));

    // chart: pane 0 price, pane 1 positioning, pane 2 open interest
    const c = colors();
    chart = makeChart(chartBox, { leftPriceScale: { visible: false } });
    const firstT = times[0];
    const legendItems = [];

    if (px) {
      const data = [];
      for (let i = 0; i < px.t.length; i++) {
        const tt = dayTime(px.t[i]);
        if (tt >= firstT) data.push({ time: tt, value: px.c[i] });
      }
      const dp = decimals(px.c[px.c.length - 1]);
      const s = chart.addSeries(LW.LineSeries, {
        color: c.line, lineWidth: 1.5, priceLineVisible: false,
        priceFormat: { type: 'price', precision: dp, minMove: Math.pow(10, -dp) },
      }, 0);
      s.setData(data);
      legendItems.push({ s, label: t('price'), color: c.line, fmt: v => fmtPrice(v, dp) });
    }

    const volFmt = { type: 'volume' };
    if (st.view === 'net') {
      for (const g of groups) {
        const data = net[g.k].map((v, i) => ({ time: times[i], value: v }));
        let s;
        if (g.spec) {
          s = chart.addSeries(LW.HistogramSeries, { color: g.color + '99', priceFormat: volFmt, priceLineVisible: false }, 1);
        } else {
          s = chart.addSeries(LW.LineSeries, { color: g.color, lineWidth: 1.5, priceFormat: volFmt, priceLineVisible: false }, 1);
        }
        s.setData(data);
        legendItems.push({ s, label: g[nameKey()], color: g.color, fmt: fmtSigned });
      }
    } else if (st.view === 'longshort') {
      const g = groups.find(x => x.k === st.lsGroup);
      const L = chart.addSeries(LW.HistogramSeries, { color: c.up + 'aa', priceFormat: volFmt, priceLineVisible: false }, 1);
      const S = chart.addSeries(LW.HistogramSeries, { color: c.down + 'aa', priceFormat: volFmt, priceLineVisible: false }, 1);
      const N = chart.addSeries(LW.LineSeries, { color: g.color, lineWidth: 2, priceFormat: volFmt, priceLineVisible: false }, 1);
      L.setData(cot[g.k + '_l'].map((v, i) => ({ time: times[i], value: v })));
      S.setData(cot[g.k + '_s'].map((v, i) => ({ time: times[i], value: -v })));
      N.setData(net[g.k].map((v, i) => ({ time: times[i], value: v })));
      legendItems.push({ s: L, label: `${g.short} ${t('long')}`, color: c.up, fmt: fmtInt },
        { s: S, label: `${g.short} ${t('short')}`, color: c.down, fmt: v => fmtInt(-v) },
        { s: N, label: `${g.short} ${t('netpos')}`, color: g.color, fmt: fmtSigned });
    } else {
      for (const g of groups) {
        const idx = rollingIndex(net[g.k], st.lookback);
        const s = chart.addSeries(LW.LineSeries, {
          color: g.color, lineWidth: g.spec ? 2 : 1, priceLineVisible: false,
          priceFormat: { type: 'price', precision: 0, minMove: 1 },
          autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
        }, 1);
        s.setData(idx.map((v, i) => v === null ? { time: times[i] } : { time: times[i], value: v }));
        if (g.spec) {
          for (const lvl of [80, 20]) s.createPriceLine({ price: lvl, color: css('--muted'), lineStyle: LW.LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true });
        }
        legendItems.push({ s, label: `${g.short} ${t('cotindex')}`, color: g.color, fmt: v => v.toFixed(0) });
      }
    }
    // zero line on positioning pane
    const oiSeries = chart.addSeries(LW.AreaSeries, {
      lineColor: css('--blue'), topColor: css('--blue') + '55', bottomColor: css('--blue') + '05',
      lineWidth: 1, priceFormat: volFmt, priceLineVisible: false,
    }, 2);
    oiSeries.setData(cot.oi.map((v, i) => ({ time: times[i], value: v })));
    legendItems.push({ s: oiSeries, label: t('openint'), color: css('--blue'), fmt: fmtInt });

    const panes = chart.panes();
    panes[0]?.setStretchFactor(1);
    panes[1]?.setStretchFactor(1.4);
    panes[2]?.setStretchFactor(0.5);

    // legend follows the crosshair, falls back to latest values
    const drawLegend = param => {
      legend.replaceChildren(...legendItems.map(it => {
        let v = param?.seriesData?.get(it.s);
        v = v ? (v.value ?? v.close) : lastValue(it.s);
        return el('span', {}, el('i', { style: `background:${it.color}` }), `${it.label}: `,
          el('b', {}, v === undefined || v === null ? '—' : it.fmt(v)));
      }));
    };
    chart.subscribeCrosshairMove(drawLegend);
    drawLegend();

    function applyRange() {
      const yrs = RANGES[st.range];
      const lastPx = px ? dayTime(px.t[px.t.length - 1]) : 0;
      const to = Math.max(times[n - 1], lastPx) + 86400 * 5;
      const from = Math.max(times[0], to - yrs * 365.25 * 86400);
      chart.timeScale().setVisibleRange({ from, to });
    }
    applyRange();

    // latest report table
    const i = n - 1;
    const oi = cot.oi[i];
    const head = el('tr', {}, ...[t('group'), t('long'), t('short'), t('netpos'), t('chg'), `${t('pctoi')} L`, `${t('pctoi')} S`,
      `${t('cotindex')} ${st.lookback}${t('weeks')}`].map(h => el('th', {}, h)));
    const rows = groups.map(g => {
      const nNow = net[g.k][i], nPrev = net[g.k][i - 1] ?? nNow;
      const ix = indexAt(net[g.k], i, st.lookback);
      return el('tr', {},
        el('td', {}, el('span', { class: 'swatch', style: `background:${g.color}` }), g[nameKey()]),
        el('td', {}, fmtInt(cot[g.k + '_l'][i])),
        el('td', {}, fmtInt(cot[g.k + '_s'][i])),
        el('td', { class: signClass(nNow) }, fmtSigned(nNow)),
        el('td', { class: signClass(nNow - nPrev) }, fmtSigned(nNow - nPrev)),
        el('td', {}, (cot[g.k + '_l'][i] / oi * 100).toFixed(1)),
        el('td', {}, (cot[g.k + '_s'][i] / oi * 100).toFixed(1)),
        el('td', {}, idxBar(ix)));
    });
    const oiChg = oi - (cot.oi[i - 1] ?? oi);
    rows.push(el('tr', {}, el('td', { class: 'amber' }, `${t('openint')} · ${t('reportdate')} ${cot.date[i]}`),
      el('td', {}, ''), el('td', {}, ''), el('td', {}, fmtInt(oi)), el('td', { class: signClass(oiChg) }, fmtSigned(oiChg)),
      el('td', {}, ''), el('td', {}, ''), el('td', {}, '')));
    tableWrap.replaceChildren(el('table', { class: 'tbl' }, el('thead', {}, head), el('tbody', {}, rows)));
  }

  // ---------- all markets ----------
  async function renderOverview(my) {
    const list = SYMBOLS.filter(s => s.cot);
    const data = await Promise.all(list.map(s => loadJSON(`data/cot/legacy/${s.cot}.json`).catch(() => null)));
    if (my !== token) return;
    const head = el('tr', {}, ...[t('market'), t('reportdate'), t('oi'), t('specnet'), t('chg'), t('commnet'), t('smallnet'),
      t('idx52'), t('idx156')].map(h => el('th', {}, h)));
    const body = el('tbody');
    for (const g of GROUPS) {
      const members = list.map((s, k) => [s, data[k]]).filter(([s, d]) => s.group === g && d);
      if (!members.length) continue;
      body.append(el('tr', {}, el('td', { class: 'grp', colspan: 9 }, t(g))));
      for (const [s, d] of members) {
        const i = d.date.length - 1;
        const nc = d.nc_l.map((v, j) => v - d.nc_s[j]);
        const cm = d.c_l[i] - d.c_s[i], sm = d.nr_l[i] - d.nr_s[i];
        const row = el('tr', { class: 'click' },
          el('td', {}, el('b', { class: 'amber' }, s.code.padEnd(7, ' ')), ' ', name(s)),
          el('td', { class: 'muted' }, d.date[i]),
          el('td', {}, fmtInt(d.oi[i])),
          el('td', { class: signClass(nc[i]) }, fmtSigned(nc[i])),
          el('td', { class: signClass(nc[i] - nc[i - 1]) }, fmtSigned(nc[i] - nc[i - 1])),
          el('td', { class: signClass(cm) }, fmtSigned(cm)),
          el('td', { class: signClass(sm) }, fmtSigned(sm)),
          el('td', {}, idxBar(indexAt(nc, i, 52))),
          el('td', {}, idxBar(indexAt(nc, i, 156))));
        row.onclick = () => { st.sym = s.id; sb.setActive(s.id); save(); render(); };
        body.append(row);
      }
    }
    content.replaceChildren(
      el('div', { class: 'bar' }, el('span', { class: 'bar-title' }, `COT · ${t('overview')}`),
        el('span', { class: 'bar-sub' }, 'CFTC Legacy · Futures only')),
      el('div', { class: 'table-scroll' }, el('table', { class: 'tbl' }, el('thead', {}, head), body)),
      el('div', { class: 'note' }, t('cotnote')));
  }

  render();
  return () => { token++; disposeChart(); };
}

const nameKey = () => (store.get('lang', 'en') === 'vi' ? 'vi' : 'en');

function lastValue(series) {
  const d = series.data();
  const v = d[d.length - 1];
  return v ? (v.value ?? v.close) : undefined;
}

function indexAt(arr, i, n) {
  const from = Math.max(0, i - n + 1);
  let lo = Infinity, hi = -Infinity;
  for (let j = from; j <= i; j++) { if (arr[j] < lo) lo = arr[j]; if (arr[j] > hi) hi = arr[j]; }
  return hi === lo ? 50 : (arr[i] - lo) / (hi - lo) * 100;
}

function rollingIndex(arr, n) {
  return arr.map((_, i) => (i < Math.min(n, 8) - 1 ? null : indexAt(arr, i, n)));
}

function idxBar(v) {
  const col = v >= 80 ? 'var(--up)' : v <= 20 ? 'var(--dn)' : 'var(--amber)';
  return el('span', {}, el('span', { class: 'idx-bar' }, el('i', { style: `width:${v.toFixed(0)}%;background:${col}` })),
    el('span', { style: `color:${col}` }, v.toFixed(0).padStart(3, ' ')));
}
