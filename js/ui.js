// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
import { GROUPS, SYMBOLS } from './config.js';
import { t, name } from './i18n.js';
import { el } from './util.js';

// Segmented button control. options: [{v, label, disabled}]
export function seg(options, value, onChange) {
  const box = el('div', { class: 'seg' });
  for (const o of options) {
    const b = el('button', { class: o.v === value ? 'on' : '', disabled: o.disabled, title: o.title }, o.label);
    b.onclick = () => {
      box.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      onChange(o.v);
    };
    box.append(b);
  }
  return box;
}

// Symbol list grouped by sector (desktop) + a <select> fallback (mobile).
// extraTop: optional {id, label} pseudo-item shown first (e.g. COT overview).
// active may be an id or a predicate (multi-select).
export function symbolSidebar({ filter = () => true, active, onSelect, extraTop }) {
  const syms = SYMBOLS.filter(filter);
  const isOn = typeof active === 'function' ? active : id => id === active;
  const side = el('aside', { class: 'side' });
  const select = el('select', { onchange: e => onSelect(e.target.value) });
  const items = [];
  if (extraTop) {
    const top = el('div', { class: 'side-top' + (isOn(extraTop.id) ? ' active' : '') }, '▦ ' + extraTop.label);
    top.onclick = () => onSelect(extraTop.id);
    side.append(top);
    items.push([extraTop.id, top]);
    select.append(el('option', { value: extraTop.id, selected: isOn(extraTop.id) }, extraTop.label));
  }
  for (const g of GROUPS) {
    const list = syms.filter(s => s.group === g);
    if (!list.length) continue;
    side.append(el('div', { class: 'side-group' }, t(g)));
    const og = el('optgroup', { label: t(g) });
    for (const s of list) {
      const it = el('div', { class: 'side-item' + (isOn(s.id) ? ' active' : '') },
        el('span', {}, name(s)), el('span', { class: 'code' }, s.code));
      it.onclick = () => onSelect(s.id);
      side.append(it);
      items.push([s.id, it]);
      og.append(el('option', { value: s.id, selected: isOn(s.id) }, `${s.code} · ${name(s)}`));
    }
    select.append(og);
  }
  const setActive = id => {
    for (const [k, node] of items) node.classList.toggle('active', k === id);
    select.value = id;
  };
  return { side, mobile: el('div', { class: 'side-select' }, select), setActive };
}

export const loadingBox = () => el('div', { class: 'loading' }, t('loading'));

// Toggle browser fullscreen for the element returned by getTarget().
export function fullscreenBtn(getTarget) {
  const b = el('button', { class: 'tbtn fs-btn', title: t('fullscreen') }, '⛶ ' + t('fullscreen'));
  b.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else getTarget().requestFullscreen?.().catch(() => {});
  };
  return b;
}
