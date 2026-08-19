/**
 * Debt-to-income.
 *
 * The arithmetic is trivial and the consequences are not: an agent reads
 * these two numbers off the panel and tells a borrower whether there is a
 * loan here. So the worked figures below are checked by hand rather than
 * against whatever the code happened to produce.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDti, maxPaymentFor, DEFAULT_DTI_LIMITS } from '../extension/src/lib/dti.js';

/** $7,400 gross a month, $950 of other debt, EQ came back with $2,417.19. */
const FILE = { piti: 2417.19, monthlyIncome: 7400, monthlyDebts: 950 };

test('front-end is the payment over income, back-end adds the rest', () => {
  //  front  2,417.19 / 7,400            = 0.326647… -> 32.66%
  //  back  (2,417.19 + 950) / 7,400     = 0.455026… -> 45.50%
  const r = computeDti({ ...FILE, program: 'VA' });

  assert.equal(r.front.percent, 32.66);
  assert.equal(r.back.percent, 45.5);
  assert.equal(r.ok, true);
});

test('the ratios are judged against this floor\'s limits, per programme', () => {
  // VA 35/45 — the housing payment fits, the whole picture does not.
  const va = computeDti({ ...FILE, program: 'VA' });
  assert.equal(va.front.limit, 0.35);
  assert.equal(va.front.pass, true);
  assert.equal(va.back.limit, 0.45);
  assert.equal(va.back.pass, false);
  assert.equal(va.back.headroom, -0.5, 'half a point over');

  // FHA stretches to 47 back, so the same file clears it.
  const fha = computeDti({ ...FILE, program: 'FHA' });
  assert.equal(fha.front.limit, 0.35);
  assert.equal(fha.front.pass, true);
  assert.equal(fha.back.limit, 0.47);
  assert.equal(fha.back.pass, true);
  assert.equal(fha.back.headroom, 1.5);

  // Conventional is the tightest housing ratio of the three, and the same
  // 32.66% that clears VA and FHA fails it.
  const conv = computeDti({ ...FILE, program: 'CONV' });
  assert.equal(conv.front.limit, 0.32);
  assert.equal(conv.front.pass, false);
  assert.equal(conv.front.headroom, -0.66);
  assert.equal(conv.back.limit, 0.45);
  assert.equal(conv.back.pass, false);
});

test('the whole table, so a change to it is a decision rather than a slip', () => {
  assert.deepEqual(DEFAULT_DTI_LIMITS, {
    VA: { front: 0.35, back: 0.45 },
    FHA: { front: 0.35, back: 0.47 },
    CONV: { front: 0.32, back: 0.45 },
    USDA: { front: 0.29, back: 0.41 },
  });
});

test('the front-end ratio is shown on every programme', () => {
  // It is the cheap early answer: a borrower who cannot carry the house
  // alone will not carry it with a car note, and knowing that thirty
  // seconds into a call beats knowing it after a credit pull.
  for (const program of ['VA', 'FHA', 'CONV', 'USDA']) {
    assert.equal(computeDti({ ...FILE, program }).front.percent, 32.66, program);
  }
  assert.equal(computeDti({ ...FILE, program: 'USDA' }).front.limit, 0.29);
  assert.equal(computeDti({ ...FILE, program: 'USDA' }).front.pass, false);
});

test('a limit set to null shows the ratio and passes no judgement on it', () => {
  // The escape hatch for a programme a shop does not test a housing ratio
  // on. A red flag against a ratio nobody underwrites to would kill files
  // that would otherwise sail through.
  const r = computeDti({ ...FILE, program: 'CONV' }, {
    ...DEFAULT_DTI_LIMITS, CONV: { front: null, back: 0.45 },
  });
  assert.equal(r.front.percent, 32.66);
  assert.equal(r.front.limit, null);
  assert.equal(r.front.pass, null);
  assert.equal(r.back.pass, false, 'and the other half still judges');
});

test('a ratio that lands exactly on the limit passes', () => {
  // 45.00% against a 45% ceiling has to read as a pass, or the panel is
  // arguing with itself in front of the borrower.
  const exact = computeDti({
    piti: 3330, monthlyIncome: 10000, monthlyDebts: 1170, program: 'CONV',
  });
  assert.equal(exact.back.percent, 45);
  assert.equal(exact.back.pass, true);
  assert.equal(exact.back.headroom, 0);

  // And the comparison is made on what is displayed, not on the raw
  // quotient — 45.0004% shows as 45.00% and must not fail.
  const hair = computeDti({
    piti: 3330.04, monthlyIncome: 10000, monthlyDebts: 1170, program: 'CONV',
  });
  assert.equal(hair.back.percent, 45);
  assert.equal(hair.back.pass, true);
});

test('no debts entered is not the same as no debts', () => {
  // Treating "unknown" as zero flatters the back-end ratio, which is the
  // direction that gets a file to underwriting and back.
  const unknown = computeDti({ piti: 2417.19, monthlyIncome: 7400, program: 'VA' });
  assert.equal(unknown.front.percent, 32.66, 'the housing ratio still works');
  assert.equal(unknown.back.percent, null);
  assert.equal(unknown.back.pass, null);
  assert.ok(unknown.warnings.some((w) => /Enter 0 if there genuinely are none/.test(w.text)));

  const none = computeDti({ ...FILE, monthlyDebts: 0, program: 'VA' });
  assert.equal(none.back.percent, 32.66, 'and zero means the two agree');
  assert.equal(none.back.pass, true);
  assert.equal(none.front.percent, none.back.percent);
  assert.ok(!none.warnings.some((w) => /back-end/.test(w.text)));
});

test('a yearly income in a monthly box is caught', () => {
  // $88,800 a year typed where $7,400 a month belongs. The ratio comes out
  // twelve times too good, and it is the one direction that must not pass
  // quietly.
  const r = computeDti({ ...FILE, monthlyIncome: 88800, program: 'VA' });
  assert.equal(r.front.percent, 2.72);
  assert.ok(r.warnings.some((w) => /yearly figure in a monthly box/.test(w.text)));
  assert.equal(r.warnings.find((w) => /yearly/.test(w.text)).level, 'warn');

  assert.ok(!computeDti({ ...FILE, program: 'VA' })
    .warnings.some((w) => /yearly/.test(w.text)), 'and a sane one is not flagged');
});

test('a missing payment or income produces no ratio at all', () => {
  for (const gap of [{ piti: null }, { monthlyIncome: null }, { monthlyIncome: 0 }]) {
    const r = computeDti({ ...FILE, ...gap, program: 'VA' });
    assert.equal(r.ok, false);
    assert.equal(r.front.percent, null);
    assert.equal(r.back.percent, null);
    assert.ok(r.missing.length >= 1);
  }
});

test('an unknown programme still gives the ratios, with nothing to judge them by', () => {
  const r = computeDti({ ...FILE, program: 'JUMBO' });
  assert.equal(r.program, null);
  assert.equal(r.front.percent, 32.66);
  assert.equal(r.back.percent, 45.5);
  assert.equal(r.back.pass, null);
});

test('the limits are settings, because a shop\'s overlays are its own', () => {
  const r = computeDti({ ...FILE, program: 'VA' }, {
    ...DEFAULT_DTI_LIMITS,
    VA: { front: 0.31, back: 0.41 },
  });
  assert.equal(r.front.limit, 0.31);
  assert.equal(r.front.pass, false, '32.66% is over a 31% ceiling');
  assert.equal(r.back.limit, 0.41);
  assert.equal(r.back.pass, false);
});

test('the largest payment that still fits, for the conversation after a fail', () => {
  //  7,400 x 45%  = 3,330 of room, less 950 of debt = 2,380 of payment.
  assert.equal(maxPaymentFor({ monthlyIncome: 7400, monthlyDebts: 950, limit: 0.45 }), 2380);
  //  Front-end has no other debt in it.
  assert.equal(maxPaymentFor({ monthlyIncome: 7400, monthlyDebts: 0, limit: 0.35 }), 2590);
  // Debt alone past the limit is no room rather than a negative payment.
  assert.equal(maxPaymentFor({ monthlyIncome: 3000, monthlyDebts: 2000, limit: 0.45 }), 0);
  assert.equal(maxPaymentFor({ monthlyIncome: null, limit: 0.45 }), null);
});
