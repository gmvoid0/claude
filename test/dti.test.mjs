/**
 * Front-end debt-to-income.
 *
 * The arithmetic is trivial and the consequences are not: an agent reads
 * this number off the panel and tells a borrower whether there is a loan
 * here. So the worked figures below are checked by hand rather than against
 * whatever the code happened to produce.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDti, maxPaymentFor, DEFAULT_DTI_LIMITS } from '../extension/src/lib/dti.js';

/** $7,400 gross a month, and Easy Qualifier came back with $2,417.19. */
const FILE = { piti: 2417.19, monthlyIncome: 7400 };

test('the ratio is the payment over gross monthly income', () => {
  //  2,417.19 / 7,400 = 0.3266472… -> 32.66%
  const r = computeDti({ ...FILE, program: 'VA' });
  assert.equal(r.front.percent, 32.66);
  assert.equal(r.ok, true);
});

test('the whole table, so a change to it is a decision rather than a slip', () => {
  assert.deepEqual(DEFAULT_DTI_LIMITS, {
    VA: 0.35, FHA: 0.35, CONV: 0.32, USDA: 0.29,
  });
});

test('the same payment passes on some programmes and fails on others', () => {
  // 32.66% clears VA and FHA at 35, and misses conventional's 32 by two
  // thirds of a point. That difference is the reason the limit is shown
  // beside the ratio rather than only the verdict.
  for (const program of ['VA', 'FHA']) {
    const r = computeDti({ ...FILE, program });
    assert.equal(r.limit, 0.35, program);
    assert.equal(r.front.pass, true, program);
    assert.equal(r.front.headroom, 2.34, program);
  }

  const conv = computeDti({ ...FILE, program: 'CONV' });
  assert.equal(conv.limit, 0.32);
  assert.equal(conv.front.pass, false);
  assert.equal(conv.front.headroom, -0.66);

  const usda = computeDti({ ...FILE, program: 'USDA' });
  assert.equal(usda.limit, 0.29);
  assert.equal(usda.front.pass, false);
});

test('a ratio that lands exactly on the limit passes', () => {
  // 35.00% against a 35% ceiling has to read as a pass, or the panel is
  // arguing with itself in front of the borrower.
  const exact = computeDti({ piti: 2590, monthlyIncome: 7400, program: 'VA' });
  assert.equal(exact.front.percent, 35);
  assert.equal(exact.front.pass, true);
  assert.equal(exact.front.headroom, 0);

  // And the comparison is made on what is displayed, not on the raw
  // quotient — 35.0002% shows as 35.00% and must not fail.
  const hair = computeDti({ piti: 2590.01, monthlyIncome: 7400, program: 'VA' });
  assert.equal(hair.front.percent, 35);
  assert.equal(hair.front.pass, true);
});

test('a failure comes with the payment that would have worked', () => {
  // A red number on its own ends the call. The next sentence is what an
  // agent actually needs: 7,400 x 32% = $2,368.
  const conv = computeDti({ ...FILE, program: 'CONV' });
  assert.equal(conv.front.pass, false);
  assert.equal(conv.maxPayment, 2368);

  assert.equal(computeDti({ ...FILE, program: 'VA' }).maxPayment, 2590);
  assert.equal(maxPaymentFor({ monthlyIncome: 7400, limit: 0.35 }), 2590);
  assert.equal(maxPaymentFor({ monthlyIncome: null, limit: 0.35 }), null);
  assert.equal(maxPaymentFor({ monthlyIncome: 7400, limit: null }), null);
});

test('a yearly income in a monthly box is caught', () => {
  // $88,800 a year typed where $7,400 a month belongs. The ratio comes out
  // twelve times too good, and it is the one direction that must not pass
  // quietly.
  const r = computeDti({ ...FILE, monthlyIncome: 88800, program: 'VA' });
  assert.equal(r.front.percent, 2.72);
  assert.equal(r.front.pass, true, 'the arithmetic still says yes');
  assert.ok(r.warnings.some((w) => /yearly figure in a monthly box/.test(w.text)),
    'which is exactly why it is flagged');
  assert.equal(r.warnings.find((w) => /yearly/.test(w.text)).level, 'warn');

  assert.deepEqual(computeDti({ ...FILE, program: 'VA' }).warnings, []);
});

test('a missing payment or income produces no ratio at all', () => {
  for (const gap of [{ piti: null }, { monthlyIncome: null }, { monthlyIncome: 0 }, { piti: 0 }]) {
    const r = computeDti({ ...FILE, ...gap, program: 'VA' });
    assert.equal(r.ok, false);
    assert.equal(r.front.percent, null);
    assert.equal(r.front.pass, null);
    assert.ok(r.missing.length >= 1);
    assert.equal(r.limit, 0.35, 'but the limit still shows, so the target is known');
  }
});

test('an unknown programme gives the ratio and passes no judgement on it', () => {
  const r = computeDti({ ...FILE, program: 'JUMBO' });
  assert.equal(r.program, null);
  assert.equal(r.front.percent, 32.66);
  assert.equal(r.front.limit, null);
  assert.equal(r.front.pass, null);
  assert.equal(r.maxPayment, null);
});

test('a limit set to null shows the ratio and judges nothing', () => {
  // The escape hatch for a programme a shop does not test a housing ratio
  // on. A red flag against a ratio nobody underwrites to would kill files
  // that would otherwise sail through.
  const r = computeDti({ ...FILE, program: 'CONV' }, { ...DEFAULT_DTI_LIMITS, CONV: null });
  assert.equal(r.front.percent, 32.66);
  assert.equal(r.front.pass, null);
});

test('the limits are settings, because a shop\'s overlays are its own', () => {
  const r = computeDti({ ...FILE, program: 'VA' }, { ...DEFAULT_DTI_LIMITS, VA: 0.31 });
  assert.equal(r.limit, 0.31);
  assert.equal(r.front.pass, false, '32.66% is over a 31% ceiling');
  assert.equal(r.maxPayment, 2294);
});
