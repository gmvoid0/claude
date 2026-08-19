/**
 * The loan-sizing method, exactly as the floor runs it.
 *
 * The worked example throughout is the one it was given: a Jacksonville NC
 * file whose Zillow tax history shows $1,733 for 2025.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sizeLoan, sizingText, DEFAULT_SIZING } from '../extension/src/lib/sizing.js';

const item = (result, id) => result.items.find((i) => i.id === id);

test('escrows are half a year of tax plus a thousand for insurance', () => {
  // "$1,733, add $1,000 to make $2,733, divide by 2." Six months.
  const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 });

  assert.equal(item(r, 'escrow').amount, 1366.5);
  assert.deepEqual(r.escrowDetail, {
    annualPropertyTax: 1733,
    insuranceAllowance: 1000,
    annualEscrowed: 2733,
    months: 6,
  });
  assert.match(item(r, 'escrow').note, /1,733 tax \+ \$1,000 insurance, 6 of 12 months/);
});

test('the six charges add up and the total is grossed up by 3.5%', () => {
  const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 });

  assert.equal(item(r, 'title').amount, 1500);
  assert.equal(item(r, 'payoff').amount, 270900);
  assert.equal(item(r, 'cashOut').amount, 96000);
  assert.equal(item(r, 'appraisal').amount, 700);
  assert.equal(item(r, 'underwriting').amount, 2000);

  // 1,366.50 + 1,500 + 270,900 + 96,000 + 700 + 2,000
  assert.equal(r.subtotal, 372466.5);
  assert.equal(r.finalLoan, 385502.83);       // x 1.035
  assert.equal(r.finalLoanRounded, 385503);
  assert.equal(r.financedCharge, 13036.33);
  assert.equal(r.ok, true);
});

test('the multiply and the exact gross-up are both reported', () => {
  // Multiplying by 1.035 charges 3.5% of the subtotal; the fee is really
  // charged on the loan, which is the larger number. The gap is small and
  // the floor's method is the one that ships — but it is shown, not hidden.
  const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 });

  assert.equal(r.grossUpExact, 385975.65);    // subtotal / (1 - 0.035)
  assert.ok(r.grossUpExact > r.finalLoan);
  assert.ok(r.grossUpExact - r.finalLoan < 1000, 'and the gap is a rounding argument, not a bug');
});

test('a second lien is paid off too, when there is one', () => {
  const without = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 });
  const with2nd = sizeLoan({
    annualPropertyTax: 1733, payoff: 270900, cashOut: 96000, secondLien: 40000,
  });

  assert.equal(item(with2nd, 'secondLien').amount, 40000);
  assert.equal(item(without, 'secondLien'), undefined, 'and no empty line when there is not');
  assert.equal(with2nd.subtotal - without.subtotal, 40000);
});

test('a VA refinance with no cash is an IRRRL, and pays for no appraisal', () => {
  // A streamline reuses the valuation already on the loan, so charging for
  // one puts $700 on a file that never orders it — $725 once it is grossed
  // up with everything else.
  const cashOut = sizeLoan({
    annualPropertyTax: 1733, payoff: 270900, cashOut: 96000, program: 'VA',
  });
  const irrrl = sizeLoan({
    annualPropertyTax: 1733, payoff: 270900, cashOut: 0, program: 'VA',
  });

  assert.equal(cashOut.irrrl, false);
  assert.equal(item(cashOut, 'appraisal').amount, 700);

  assert.equal(irrrl.irrrl, true);
  assert.equal(item(irrrl, 'appraisal').amount, 0, 'the line stays, at nothing');
  assert.match(item(irrrl, 'appraisal').note, /waived/);
  assert.equal(irrrl.finalLoanRounded, 285418);
  assert.equal(
    sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 0 }).finalLoanRounded - 285418,
    725, '$700 grossed up',
  );
});

test('only VA turns a no-cash refinance into a streamline', () => {
  for (const program of ['FHA', 'CONV', 'USDA', null]) {
    const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 0, program });
    assert.equal(r.irrrl, false, String(program));
    assert.equal(item(r, 'appraisal').amount, 700, String(program));
  }
});

test('a missing input produces no loan amount at all', () => {
  // A final loan amount that is quietly missing the escrows is worse than no
  // figure: it goes into Easy Qualifier and prices a loan that cannot close.
  for (const gap of [
    { annualPropertyTax: null, payoff: 270900, cashOut: 96000 },
    { annualPropertyTax: 1733, payoff: null, cashOut: 96000 },
    { annualPropertyTax: 1733, payoff: 270900, cashOut: null },
  ]) {
    const r = sizeLoan(gap);
    assert.equal(r.ok, false);
    assert.equal(r.finalLoan, null);
    assert.equal(r.subtotal, null);
    assert.equal(r.missing.length, 1);
  }

  // The line is still listed, so the agent can see which one is holding it up.
  const noTax = sizeLoan({ payoff: 270900, cashOut: 96000 });
  assert.equal(item(noTax, 'escrow').missing, true);
  assert.match(item(noTax, 'escrow').note, /property tax from Zillow/);
  assert.equal(item(noTax, 'payoff').amount, 270900, 'and everything else still shows');
});

test('zero cash out is a real answer, not a missing one', () => {
  // A rate-and-term refinance takes no cash. That is a number, not a gap,
  // and it stays on the sheet at zero so nobody wonders where it went.
  const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 0 });
  assert.equal(r.ok, true);
  assert.equal(item(r, 'cashOut').amount, 0);
  assert.equal(r.subtotal, 276466.5);
  assert.equal(r.finalLoan, 286142.83);
});

test('every figure in the method is a setting', () => {
  // These are the floor's numbers, not the truth. Title work is not $1,500
  // in every state and underwriting is a lender's choice.
  const r = sizeLoan({ annualPropertyTax: 2400, payoff: 200000, cashOut: 50000 }, {
    ...DEFAULT_SIZING,
    insuranceAllowance: 1800,
    escrowMonths: 3,
    titleFees: 2200,
    appraisal: 800,
    underwriting: 1495,
    grossUp: 1.0175,
  });

  assert.equal(item(r, 'escrow').amount, 1050);       // (2400 + 1800) x 3/12
  assert.equal(item(r, 'escrow').label, 'Escrows, 3 months');
  assert.equal(item(r, 'title').amount, 2200);
  assert.equal(item(r, 'appraisal').amount, 800);
  assert.equal(item(r, 'underwriting').amount, 1495);
  assert.equal(r.subtotal, 255545);
  assert.equal(r.finalLoan, 260017.04);
});

test('a gross-up of 1 leaves the subtotal alone', () => {
  const r = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 },
    { ...DEFAULT_SIZING, grossUp: 1 });
  assert.equal(r.finalLoan, r.subtotal);
  assert.equal(r.financedCharge, 0);
  assert.equal(r.grossUpExact, null, 'and there is no second opinion to give');
});

test('the itemisation is legible when copied', () => {
  const text = sizingText(sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 }));
  assert.match(text, /Escrows, 6 months:\s+\$1,367/);
  assert.match(text, /Mortgage payoff:\s+\$270,900/);
  assert.match(text, /Subtotal:\s+\$372,467/);
  assert.match(text, /x 1\.035:\s+\$385,503/);
});
