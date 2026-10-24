// © 2026 Lai Long Charts. Bảo lưu mọi quyền.
// Run: node --test tests/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECS, frontContract, resolveContract, lastDay, instrumentKind, monthLabel, dayLabel, contractCode } from '../js/contracts.js';
import { SYMBOLS } from '../js/config.js';

const at = s => Date.parse(s + 'T16:00:00Z'); // noon in New York
const front = (key, day) => frontContract(key, at(day)).code;

test('front month on 24 Oct 2026 matches the CME/ICE calendars', () => {
  assert.equal(front('GOLD', '2026-10-24'), 'GCZ26');
  assert.equal(front('SILVER', '2026-10-24'), 'SIZ26');
  assert.equal(front('PLATINUM', '2026-10-24'), 'PLF27');
  assert.equal(front('COPPER', '2026-10-24'), 'HGZ26');
  assert.equal(front('WTI', '2026-10-24'), 'CLZ26');
  assert.equal(front('BRENT', '2026-10-24'), 'BZZ26');
  assert.equal(front('NATGAS', '2026-10-24'), 'NGX26');
  assert.equal(front('RBOB', '2026-10-24'), 'RBX26');
  assert.equal(front('SOYBEANS', '2026-10-24'), 'ZSX26');
  assert.equal(front('COFFEE_ARABICA', '2026-10-24'), 'KCZ26');
  assert.equal(front('EUR_FUT', '2026-10-24'), '6EZ26');
});

test('last-trade rules', () => {
  // WTI Nov 2026: the 25th of October is a Sunday, so 3 business days before Fri 23 Oct
  assert.equal(dayLabel(lastDay('cl', 2026, 11)), '20/10/2026');
  // WTI Dec 2026: 25 Nov is a Wednesday
  assert.equal(dayLabel(lastDay('cl', 2026, 12)), '20/11/2026');
  // Brent Dec 2026: last business day of October
  assert.equal(dayLabel(lastDay('brent', 2026, 12)), '30/10/2026');
  // Natural gas Nov 2026: 3 business days before 1 November
  assert.equal(dayLabel(lastDay('ng', 2026, 11)), '28/10/2026');
  // Euro FX Dec 2026: third Wednesday is 16 Dec, 2 business days before
  assert.equal(dayLabel(lastDay('fx', 2026, 12)), '14/12/2026');
  // Gold Dec 2026: first notice 30 Nov, front month until the business day before
  assert.equal(dayLabel(lastDay('fnd', 2026, 12)), '27/11/2026');
});

test('contracts roll on the right day', () => {
  assert.equal(front('BRENT', '2026-10-30'), 'BZZ26');
  assert.equal(front('BRENT', '2026-10-31'), 'BZF27');
  assert.equal(front('WTI', '2026-11-20'), 'CLZ26');
  assert.equal(front('WTI', '2026-11-21'), 'CLF27');
  assert.equal(front('GOLD', '2026-11-30'), 'GCG27');
  assert.equal(front('GOLD', '2026-12-31'), 'GCG27'); // crosses the year
});

test('feed contract wins over the estimate', () => {
  const c = resolveContract('GOLD', { month: 2, year: 2027, name: 'Gold Feb 27' }, at('2026-10-24'));
  assert.equal(c.code, 'GCG27');
  assert.equal(c.est, false);
  const e = resolveContract('GOLD', { name: 'Gold' }, at('2026-10-24'));
  assert.equal(e.code, 'GCZ26');
  assert.equal(e.est, true);
  assert.equal(resolveContract('EURUSD', null), null);
  // a misread name far from the calendar is ignored
  assert.equal(resolveContract('GOLD', { month: 12, year: 2031 }, at('2026-10-24')).est, true);
  // Yahoo still quoting the expiring month a few days after the calendar roll is kept
  assert.equal(resolveContract('GOLD', { month: 12, year: 2026 }, at('2026-12-02')).code, 'GCZ26');
});

test('instrument kinds', () => {
  const bySym = id => SYMBOLS.find(s => s.id === id);
  assert.equal(instrumentKind(bySym('GOLD'), 'live', 'binance'), 'perp');
  assert.equal(instrumentKind(bySym('BTC'), 'live', 'binance'), 'spot');
  assert.equal(instrumentKind(bySym('BTC'), 'live', 'hyperliquid'), 'perp');
  assert.equal(instrumentKind(bySym('GOLD'), 'delayed'), 'future');
  assert.equal(instrumentKind(bySym('EUR'), 'delayed'), 'spot');
  assert.equal(instrumentKind(bySym('DXY'), 'delayed'), 'index');
});

test('every futures price series has a contract spec', () => {
  for (const s of SYMBOLS) {
    if (s.group === 'fx' || s.group === 'crypto') {
      if (s.cotPrice) assert.ok(SPECS[s.cotPrice], s.cotPrice);
      continue;
    }
    assert.ok(SPECS[s.price], s.price);
  }
});

test('labels', () => {
  assert.equal(monthLabel({ month: 12, year: 2026 }, 'vi'), 'T12/2026');
  assert.equal(monthLabel({ month: 1, year: 2027 }, 'en'), 'JAN 2027');
  assert.equal(contractCode('6N', 2027, 3), '6NH27');
});
