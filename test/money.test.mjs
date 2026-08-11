import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMoney, parsePercent, formatMoney, formatPercent, floorDollar, round2 }
  from '../extension/src/lib/money.js';

test('parseMoney: plain and formatted US currency', () => {
  assert.equal(parseMoney('270900'), 270900);
  assert.equal(parseMoney('$1,234.56'), 1234.56);
  assert.equal(parseMoney('  $412,000  '), 412000);
  assert.equal(parseMoney('6.06'), 6.06);
  assert.equal(parseMoney('0'), 0);
  assert.equal(parseMoney(270900), 270900);
});

test('parseMoney: accounting negatives and signs', () => {
  assert.equal(parseMoney('(2,000)'), -2000);
  assert.equal(parseMoney('-$500'), -500);
  assert.equal(parseMoney('$-500'), -500);
  assert.equal(parseMoney('+750'), 750);
});

test('parseMoney: magnitude suffixes', () => {
  assert.equal(parseMoney('1.2M'), 1200000);
  assert.equal(parseMoney('$412k'), 412000);
  assert.equal(parseMoney('2B'), 2000000000);
});

test('parseMoney: separator disambiguation', () => {
  assert.equal(parseMoney('1,234'), 1234);
  assert.equal(parseMoney('1,234,567'), 1234567);
  assert.equal(parseMoney('1,234.56'), 1234.56);
  assert.equal(parseMoney('1.234.567'), 1234567);
  assert.equal(parseMoney('1,5'), 1.5);
});

test('parseMoney: rejects things that are not numbers', () => {
  for (const bad of ['', '   ', 'TN', 'n/a', 'N/A', '-', 'VA', 'U - Undefined', null, undefined, 'abc123']) {
    assert.equal(parseMoney(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('parsePercent: percent signs, whole numbers and decimals', () => {
  assert.equal(parsePercent('80%'), 0.8);
  assert.equal(parsePercent('80'), 0.8);
  assert.equal(parsePercent('0.8'), 0.8);
  assert.equal(parsePercent('2.15%'), 0.0215);
  assert.equal(parsePercent('100%'), 1);
  assert.equal(parsePercent('100'), 1);
  assert.equal(parsePercent(''), null);
  assert.equal(parsePercent('abc'), null);
});

test('formatting', () => {
  assert.equal(formatMoney(120681), '$120,681');
  assert.equal(formatMoney(1234.56, { cents: true }), '$1,234.56');
  assert.equal(formatMoney(null), '—');
  assert.equal(formatPercent(0.67725, 1), '67.7%');
  assert.equal(formatPercent(0.8, 0), '80%');
});

test('rounding helpers never exceed the source value', () => {
  assert.equal(floorDollar(391581.99), 391581);
  assert.equal(floorDollar(1000), 1000);
  assert.equal(round2(8418.9915), 8418.99);
});
