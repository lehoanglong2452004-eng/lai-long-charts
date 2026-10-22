// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
import { SYMBOLS } from './config.js';
import { t, lang } from './i18n.js';
import { store, el, loadJSON, fmtPrice, fmtPct, signClass, colors } from './util.js';
import { liveFeed } from './exchanges.js';
import * as cot from './cot.js';
import * as seasonal from './seasonal.js';
import * as charts from './charts.js';

const TABS = { cot, seasonal, charts };
const view = document.getElementById('view');
let current = null, destroy = null;

function applyTheme() {
  document.documentElement.dataset.theme = store.get('theme', 'dark');
  document.getElementById('themeBtn').textContent = store.get('theme', 'dark') === 'dark' ? '☾' : '☀';
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === store.get('theme', 'dark')));
}

function applyLang() {
  document.documentElement.lang = lang();
  document.getElementById('langBtn').innerHTML = lang() === 'en' ? '<b>EN</b>|vi' : 'en|<b>VI</b>';
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
}

function route() {
  const tab = (location.hash.slice(1) || store.get('tab', 'cot'));
  const name = TABS[tab] ? tab : 'cot';
  store.set('tab', name);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
  if (destroy) destroy();
  view.replaceChildren();
  current = name;
  destroy = TABS[name].mount(view) || null;
}

// Re-render everything after a theme / language / colour change.
function rerender() {
  applyTheme();
  applyLang();
  buildTape();
  route();
}

// ---------- ticker tape ----------
// Crypto entries update live (change vs today's UTC open) through the same exchange failover as the charts.
const tapeFeeds = {};
async function buildTape() {
  const track = document.getElementById('tapeTrack');
  let idx;
  try { idx = await loadJSON('data/prices/index.json'); } catch { return; }
  track.replaceChildren();
  const items = [];
  for (const s of SYMBOLS) {
    const p = idx[s.price];
    if (!p) continue;
    const chg = (p.close / p.prev - 1) * 100;
    const px = el('span', {}, fmtPrice(p.close));
    const pc = el('span', { class: signClass(chg) }, ' ' + fmtPct(chg));
    items.push(el('span', { class: 'tape-item', 'data-sym': s.id }, el('b', {}, s.code), px, pc));
  }
  // duplicate content so the loop has no gap
  track.append(...items, ...items.map(n => n.cloneNode(true)));
  for (const s of SYMBOLS.filter(x => x.live)) {
    if (tapeFeeds[s.id]) continue;
    const show = b => {
      const chg = (b.close / b.open - 1) * 100;
      track.querySelectorAll(`[data-sym="${s.id}"]`).forEach(n => {
        n.children[1].textContent = fmtPrice(b.close);
        n.children[2].textContent = ' ' + fmtPct(chg);
        n.children[2].className = signClass(chg);
      });
    };
    tapeFeeds[s.id] = liveFeed(s.id, '1D', 'auto', {
      onBars: bars => show(bars[bars.length - 1]), onBar: show, onError: () => {},
    });
  }
}

// ---------- clock + status ----------
function tick() {
  const now = new Date();
  const ny = now.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
  const loc = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('clock').textContent = `${loc} · NY ${ny}`;
}
async function status() {
  try {
    const [p, c] = await Promise.all([loadJSON('data/prices/index.json'), loadJSON('data/cot/legacy/GOLD.json')]);
    const lastPx = Object.values(p).map(x => x.last).sort().pop();
    document.getElementById('status').textContent =
      `${t('updated')}: COT ${c.date[c.date.length - 1]} · EOD ${lastPx}`;
  } catch { /* offline */ }
}

// ---------- settings ----------
function initSettings() {
  const modal = document.getElementById('settings');
  const inputs = modal.querySelectorAll('input[data-color]');
  const fill = () => {
    const c = colors();
    inputs.forEach(i => { i.value = c[i.dataset.color] || getComputedStyle(document.documentElement).getPropertyValue('--chart-bg').trim(); });
  };
  document.getElementById('settingsBtn').onclick = () => { fill(); modal.hidden = false; };
  document.getElementById('settingsClose').onclick = () => { modal.hidden = true; };
  modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
  inputs.forEach(i => i.onchange = () => {
    store.set('colors', { ...store.get('colors', {}), [i.dataset.color]: i.value });
    rerender();
  });
  document.getElementById('colorsReset').onclick = () => { store.set('colors', {}); fill(); rerender(); };
  document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => {
    store.set('theme', b.dataset.v);
    // background colour is theme-specific, drop a custom one when switching theme
    store.set('colors', { ...store.get('colors', {}), bg: '' });
    fill(); rerender();
  });
}

document.getElementById('themeBtn').onclick = () => {
  store.set('theme', store.get('theme', 'dark') === 'dark' ? 'light' : 'dark');
  store.set('colors', { ...store.get('colors', {}), bg: '' });
  rerender();
};
document.getElementById('langBtn').onclick = () => { store.set('lang', lang() === 'en' ? 'vi' : 'en'); rerender(); status(); };
document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const tab = { 1: 'cot', 2: 'seasonal', 3: 'charts' }[e.key];
  if (tab) location.hash = tab;
});
window.addEventListener('hashchange', route);

applyTheme();
applyLang();
initSettings();
buildTape();
route();
tick(); setInterval(tick, 1000);
status();
