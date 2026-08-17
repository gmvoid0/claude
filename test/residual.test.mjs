import test from 'node:test';
import assert from 'node:assert/strict';

import {
  vaRegion, residualRequirement, computeTakeHome, monthlyFromAnnual,
  DEFAULT_TAX_RATE, DTI_BENCHMARK,
} from '../extension/src/lib/residual.js';

/* --- regions ------------------------------------------------------------ */

test('states map to the VA region their table row lives in', () => {
  assert.equal(vaRegion('TN'), 'south');
  assert.equal(vaRegion('TX'), 'south');
  assert.equal(vaRegion('tx'), 'south');
  assert.equal(vaRegion('NY'), 'northeast');
  assert.equal(vaRegion('OH'), 'midwest');
  assert.equal(vaRegion('CA'), 'west');
  assert.equal(vaRegion('DC'), 'south');
  assert.equal(vaRegion('PR'), 'south');
});

test('an unknown state is null rather than a guess', () => {
  // Picking a region for an unrecognised state would produce a pass/fail
  // verdict out of thin air, which is worse than declining to answer.
  for (const bad of ['', null, undefined, 'ZZ', 'Tennessee?']) {
    assert.equal(vaRegion(bad), null);
  }
});

/* --- the published tables ----------------------------------------------- */

test('the table figures match VA Pamphlet 26-7 for loans of $80,000 and up', () => {
  const at = (state, familySize) =>
    residualRequirement({ state, familySize, loanAmount: 300000 }).required;

  assert.equal(at('NY', 1), 450);
  assert.equal(at('NY', 4), 1025);
  assert.equal(at('OH', 2), 738);
  assert.equal(at('TN', 3), 889);
  assert.equal(at('CA', 5), 1158);
});

test('the lower tier applies under $80,000', () => {
  const at = (state, familySize) =>
    residualRequirement({ state, familySize, loanAmount: 62000 }).required;

  assert.equal(at('NY', 1), 390);
  assert.equal(at('TN', 4), 868);
  assert.equal(at('CA', 5), 1004);
});

test('families beyond five add per member, and stop at seven', () => {
  const at = (familySize) => residualRequirement({ state: 'TN', familySize, loanAmount: 300000 }).required;

  assert.equal(at(5), 1039);
  assert.equal(at(6), 1039 + 80);
  assert.equal(at(7), 1039 + 160);
  assert.equal(at(9), 1039 + 160, 'the table stops at seven');
  assert.equal(residualRequirement({ state: 'TN', familySize: 9, loanAmount: 300000 }).cappedFamily, true);
});

test('a nonsense family size falls back to one rather than throwing', () => {
  for (const bad of [0, -3, null, undefined, 'x']) {
    assert.equal(residualRequirement({ state: 'TN', familySize: bad, loanAmount: 300000 }).required, 441);
  }
});

test('no region means no requirement at all', () => {
  assert.equal(residualRequirement({ state: 'ZZ', familySize: 2, loanAmount: 300000 }), null);
});

/* --- take-home ---------------------------------------------------------- */

test('take-home appears from an income alone', () => {
  // The whole point of the section is that it says something the moment the
  // agent has one figure, rather than waiting for a full picture.
  const t = computeTakeHome({ grossMonthly: 8000 });

  assert.equal(t.tax, 8000 * DEFAULT_TAX_RATE);
  assert.equal(t.takeHome, 6240);
  assert.equal(t.residual, null, 'residual needs a housing payment');
  assert.equal(t.meets, null, 'and no verdict is offered without one');
});

test('the full calculation follows VA\'s own order of operations', () => {
  const t = computeTakeHome({
    grossMonthly: 8000,
    taxRate: 0.22,
    monthlyDebts: 650,
    housingPayment: 2100,
    squareFeet: 1800,
    state: 'TN',
    familySize: 3,
    loanAmount: 300000,
  });

  assert.equal(t.takeHome, 6240);
  assert.equal(t.maintenance, 252);                    // 1800 sq ft × $0.14
  assert.equal(t.residual, 6240 - 650 - 2100 - 252);   // 3238
  assert.equal(t.required, 889);
  assert.equal(t.meets, true);
  assert.equal(t.shortfall, null);
});

test('a borrower who falls short is told by how much', () => {
  const t = computeTakeHome({
    grossMonthly: 3200,
    monthlyDebts: 700,
    housingPayment: 1500,
    state: 'CA',
    familySize: 4,
    loanAmount: 420000,
  });

  // 3200 − 704 tax = 2496 take-home; − 700 − 1500 = 296 residual.
  assert.equal(t.takeHome, 2496);
  assert.equal(t.residual, 296);
  assert.equal(t.meets, false);
  assert.ok(t.shortfall > 0);
  assert.equal(t.shortfall, t.required - 296);
});

test('above the DTI benchmark VA wants 20% more cushion', () => {
  const t = computeTakeHome({
    grossMonthly: 5000,
    monthlyDebts: 900,
    housingPayment: 1600,   // (900 + 1600) / 5000 = 50%
    state: 'TN',
    familySize: 1,
    loanAmount: 250000,
  });

  assert.ok(t.dti > DTI_BENCHMARK);
  assert.equal(t.highDti, true);
  assert.equal(t.required, Math.round(441 * 1.2 * 100) / 100);
  assert.ok(t.warnings.some((w) => /20%/.test(w.text)));
});

test('at or below the benchmark the table figure stands', () => {
  const t = computeTakeHome({
    grossMonthly: 10000,
    monthlyDebts: 500,
    housingPayment: 3600,   // exactly 41%
    state: 'TN',
    familySize: 1,
    loanAmount: 250000,
  });

  assert.equal(t.dti, DTI_BENCHMARK);
  assert.equal(t.highDti, false);
  assert.equal(t.required, 441);
});

test('missing square footage is disclosed, not quietly ignored', () => {
  // Leaving maintenance out makes residual look better than it is, which is
  // exactly the direction this tool must never be wrong in silently.
  const t = computeTakeHome({
    grossMonthly: 8000, housingPayment: 2100, state: 'TN', familySize: 1, loanAmount: 300000,
  });

  assert.equal(t.maintenance, 0);
  assert.ok(t.warnings.some((w) => /maintenance/i.test(w.text)));
});

test('an unrecognised state produces no verdict and says why', () => {
  const t = computeTakeHome({
    grossMonthly: 8000, housingPayment: 2100, state: 'ZZ', familySize: 1, loanAmount: 300000,
  });

  assert.equal(t.required, null);
  assert.equal(t.meets, null);
  assert.ok(t.residual > 0, 'the arithmetic still runs');
  assert.ok(t.warnings.some((w) => /region/i.test(w.text)));
});

test('nothing entered produces nothing rather than zeroes', () => {
  const t = computeTakeHome({});
  assert.equal(t.takeHome, null);
  assert.equal(t.residual, null);
  assert.equal(t.meets, null);
  assert.equal(t.dti, null);
});

test('an out-of-range tax rate falls back to the default', () => {
  for (const bad of [null, undefined, -0.2, 1, 4, NaN]) {
    assert.equal(computeTakeHome({ grossMonthly: 1000, taxRate: bad }).taxRate, DEFAULT_TAX_RATE);
  }
});

test('annual pay converts to the monthly figure the section works in', () => {
  assert.equal(monthlyFromAnnual(96000), 8000);
  assert.equal(monthlyFromAnnual('96000'), 8000);
  assert.equal(monthlyFromAnnual(0), null);
  assert.equal(monthlyFromAnnual(null), null);
});
