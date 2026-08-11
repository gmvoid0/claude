import test from 'node:test';
import assert from 'node:assert/strict';

import { computeEquity, solveBalanceFromPayment } from '../extension/src/lib/equity.js';
import { DEFAULT_RULES, mergeRules, normalizeProgram, normalizeState, resolveProgramRules }
  from '../extension/src/lib/rules.js';

/**
 * Base scenario is the record from the agent screen this was built against:
 * VA loan, Tennessee, $270,900 balance. Value is supplied by the agent.
 */
const BASE = {
  propertyValue: 400000,
  firstLien: 270900,
  secondLien: 0,
  program: 'VA',
  state: 'TN',
  closingCosts: 0,
  financeFee: true,
};

test('VA outside Texas gets the full 100% LTV', () => {
  const r = computeEquity(BASE);

  assert.equal(r.ok, true);
  assert.equal(r.maxLtv, 1.0);
  assert.equal(r.ltvSource, 'VA base maximum');
  assert.equal(r.grossEquity, 129100);
  assert.ok(Math.abs(r.currentLtv - 0.677250) < 1e-6);

  // Funding fee is financed inside the 100% ceiling, so the base loan is
  // reduced to make room for it.
  assert.equal(r.maxBaseLoan, 391581);
  assert.equal(r.financedFee, 8418.99);
  assert.ok(r.totalLoanAmount <= 400000, 'total loan must not breach the cap');
  assert.equal(r.cashOutBeforeCosts, 120681);
  assert.equal(r.estimatedCashToBorrower, 120681);
});

test('VA in Texas is capped at 80%, not 100%', () => {
  const r = computeEquity({ ...BASE, state: 'TX' });

  assert.equal(r.maxLtv, 0.8);
  assert.equal(r.maxBaseLoan, 313264);          // floor(320,000 / 1.0215)
  assert.equal(r.estimatedCashToBorrower, 42364);

  const texasNote = r.warnings.find((w) => /Texas/i.test(w.text));
  assert.ok(texasNote, 'expected an explicit Texas warning');
  assert.match(texasNote.text, /50\(a\)\(6\)/);
});

test('the Texas cap applies to conventional too', () => {
  const tx = computeEquity({ ...BASE, program: 'CONV', state: 'TX' });
  const tn = computeEquity({ ...BASE, program: 'CONV', state: 'TN' });
  assert.equal(tx.maxLtv, 0.8);
  assert.equal(tn.maxLtv, 0.8);
  assert.equal(tx.maxBaseLoan, tn.maxBaseLoan);
});

test('FHA is capped at 80% with UFMIP stacked on top', () => {
  const r = computeEquity({ ...BASE, program: 'FHA' });

  assert.equal(r.maxLtv, 0.8);
  assert.equal(r.maxBaseLoan, 320000);
  assert.equal(r.financedFee, 5600);            // 1.75% UFMIP
  assert.equal(r.totalLoanAmount, 325600);
  // Total loan exceeding 80% of value is expected on FHA — the cap binds the
  // base loan, and UFMIP sits above it.
  assert.ok(r.resultingLtv > 0.8);
  assert.equal(r.estimatedCashToBorrower, 49100);
});

test('conventional is capped at 80% with no financed upfront fee', () => {
  const r = computeEquity({ ...BASE, program: 'CONV' });

  assert.equal(r.maxLtv, 0.8);
  assert.equal(r.maxBaseLoan, 320000);
  assert.equal(r.financedFee, 0);
  assert.equal(r.totalLoanAmount, 320000);
  assert.equal(r.estimatedCashToBorrower, 49100);
});

test('a funding-fee exempt veteran reaches the full equity position', () => {
  const r = computeEquity({ ...BASE, feeExempt: true });

  assert.equal(r.financedFee, 0);
  assert.equal(r.maxBaseLoan, 400000);
  assert.equal(r.estimatedCashToBorrower, r.grossEquity);
  assert.equal(r.estimatedCashToBorrower, 129100);
});

test('VA subsequent use charges the higher funding fee', () => {
  const first = computeEquity(BASE);
  const again = computeEquity({ ...BASE, subsequentUse: true });

  assert.equal(again.upfrontFeeRate, 0.033);
  assert.ok(again.maxBaseLoan < first.maxBaseLoan);
  assert.ok(again.estimatedCashToBorrower < first.estimatedCashToBorrower);
});

test('closing costs come out of the borrower proceeds, not the loan', () => {
  const r = computeEquity({ ...BASE, closingCosts: 6500 });

  assert.equal(r.maxBaseLoan, 391581);                 // unchanged
  assert.equal(r.cashOutBeforeCosts, 120681);
  assert.equal(r.estimatedCashToBorrower, 114181);
});

test('a second lien reduces available cash', () => {
  const r = computeEquity({ ...BASE, secondLien: 40000 });

  assert.equal(r.totalLiens, 310900);
  assert.equal(r.grossEquity, 89100);
  assert.equal(r.estimatedCashToBorrower, 391581 - 310900);
});

test('an underwater borrower gets a shortfall, not a negative headline', () => {
  const r = computeEquity({ ...BASE, propertyValue: 200000 });

  assert.ok(r.estimatedCashToBorrower < 0);
  assert.equal(r.shortfall, Math.abs(r.estimatedCashToBorrower));
  assert.ok(r.warnings.some((w) => w.level === 'error' && /underwater/i.test(w.text)));
  assert.ok(r.warnings.some((w) => /bring roughly/i.test(w.text)));
});

test('break-even value is the value at which cash out reaches zero', () => {
  const r = computeEquity(BASE);
  const atBreakEven = computeEquity({ ...BASE, propertyValue: r.minValueToBreakEven });

  assert.ok(atBreakEven.estimatedCashToBorrower >= 0);
  assert.ok(atBreakEven.estimatedCashToBorrower < 1200,
    'break-even should land within rounding distance of zero cash out');

  const justBelow = computeEquity({ ...BASE, propertyValue: r.minValueToBreakEven - 5000 });
  assert.ok(justBelow.estimatedCashToBorrower < 0);
});

test('a loan limit caps the base loan below the LTV maximum', () => {
  const r = computeEquity({ ...BASE, loanLimit: 350000 });

  assert.equal(r.maxBaseLoan, 350000);
  assert.equal(r.estimatedCashToBorrower, 79100);
  assert.ok(r.warnings.some((w) => /loan limit/i.test(w.text)));
});

test('a manual LTV override beats the program default', () => {
  const r = computeEquity({ ...BASE, ltvOverride: 0.9 });

  assert.equal(r.maxLtv, 0.9);
  assert.equal(r.ltvSource, 'manual override');
});

test('USDA is flagged as ineligible for cash-out', () => {
  const r = computeEquity({ ...BASE, program: 'USDA' });

  assert.equal(r.maxLtv, 0);
  assert.ok(r.warnings.some((w) => w.level === 'error' && /USDA/i.test(w.text)));
});

test('missing inputs are reported rather than guessed', () => {
  const noValue = computeEquity({ ...BASE, propertyValue: null });
  assert.equal(noValue.ok, false);
  assert.deepEqual(noValue.missing, ['propertyValue']);
  assert.equal(noValue.estimatedCashToBorrower, null);
  // The liens it *did* read are still reported, so the panel can show them.
  assert.equal(noValue.totalLiens, 270900);

  const nothing = computeEquity({});
  assert.equal(nothing.ok, false);
  assert.deepEqual(nothing.missing.sort(), ['firstLien', 'propertyValue']);
});

test('an unknown loan type still produces a figure, assumed conservatively', () => {
  // An agent on a live call needs a number now. Refusing to calculate because
  // the lead data has no loan type is the least useful possible response, so
  // the most restrictive common program is assumed and said out loud.
  const r = computeEquity({ ...BASE, program: null });

  assert.equal(r.ok, true, 'a figure must still be produced');
  assert.equal(r.programAssumed, true);
  assert.equal(r.program, 'CONV');
  assert.equal(r.maxLtv, 0.8);
  assert.ok(r.estimatedCashToBorrower > 0);

  const flagged = r.warnings.find((w) => /assuming Conventional/i.test(w.text));
  assert.ok(flagged, 'the assumption must be surfaced');
  assert.equal(flagged.level, 'error', 'and surfaced loudly enough to act on');
});

test('assuming Conventional never overstates what the borrower could take', () => {
  // The assumption has to err downward: quoting a VA borrower 80% is a missed
  // opportunity, quoting a Conventional borrower 100% is a dead file.
  const assumed = computeEquity({ ...BASE, program: null });
  for (const program of ['VA', 'FHA', 'CONV', 'USDA']) {
    const known = computeEquity({ ...BASE, program });
    assert.ok(
      assumed.estimatedCashToBorrower <= known.estimatedCashToBorrower + 1
      || program === 'USDA',
      `assumed figure must not exceed the ${program} figure`,
    );
  }
});

test('a known loan type is never overridden by the assumption', () => {
  const r = computeEquity({ ...BASE, program: 'VA' });
  assert.equal(r.programAssumed, false);
  assert.equal(r.maxLtv, 1);
  assert.ok(!r.warnings.some((w) => /assuming Conventional/i.test(w.text)));
});

test('implausible figures raise a warning instead of being silently used', () => {
  // 6.06 was a real value sitting in a "Mortgage Payment" field on the
  // source screen; if it ever lands in the balance it must be called out.
  const r = computeEquity({ ...BASE, firstLien: 6.06 });
  assert.ok(r.warnings.some((w) => w.level === 'warn' && /balance/i.test(w.text)));

  const cheap = computeEquity({ ...BASE, propertyValue: 6000 });
  assert.ok(cheap.warnings.some((w) => /too low to be a home value/i.test(w.text)));
});

test('the screening threshold drives the verdict', () => {
  const rules = { ...DEFAULT_RULES, minCashOutThreshold: 150000 };
  const under = computeEquity(BASE, rules);
  assert.equal(under.meetsThreshold, false);

  const over = computeEquity({ ...BASE, propertyValue: 600000 }, rules);
  assert.equal(over.meetsThreshold, true);
});

test('the max loan never rounds above the LTV ceiling', () => {
  // Awkward values are where truncation bugs show up.
  for (const value of [333333, 412345, 199999, 787877, 1000001]) {
    for (const program of ['VA', 'FHA', 'CONV']) {
      const r = computeEquity({ ...BASE, propertyValue: value, program });
      const ceiling = value * r.maxLtv;
      if (r.feeFinanced && program === 'VA') {
        assert.ok(r.totalLoanAmount <= ceiling + 0.01,
          `VA total ${r.totalLoanAmount} breached ${ceiling} at value ${value}`);
      }
      assert.ok(r.maxBaseLoan <= ceiling + 0.01,
        `${program} base ${r.maxBaseLoan} breached ${ceiling} at value ${value}`);
    }
  }
});

/* --- automated valuations ----------------------------------------------- */

test('an AVM value is haircut before screening, and flagged', () => {
  const rules = mergeRules({ avmHaircut: 0.05 });
  const r = computeEquity(
    { ...BASE, propertyValue: 661400, firstLien: 412500, valueIsAvm: true },
    rules,
  );

  assert.equal(r.propertyValueEntered, 661400);
  assert.equal(r.propertyValue, 628330);          // 5% below the Zestimate
  assert.equal(r.avmHaircut, 0.05);
  assert.equal(r.valueIsAvm, true);
  assert.ok(r.warnings.some((w) => /not an appraisal/i.test(w.text)));

  // Every derived figure works off the discounted value.
  assert.equal(r.grossEquity, 628330 - 412500);
});

test('a hand-entered value is never haircut', () => {
  const rules = mergeRules({ avmHaircut: 0.05 });
  const r = computeEquity(
    { ...BASE, propertyValue: 661400, firstLien: 412500, valueIsAvm: false },
    rules,
  );

  assert.equal(r.propertyValue, 661400);
  assert.equal(r.avmHaircut, 0);
  assert.ok(!r.warnings.some((w) => /not an appraisal/i.test(w.text)));
});

test('an AVM with no haircut configured is still called out', () => {
  const r = computeEquity({ ...BASE, valueIsAvm: true });

  assert.equal(r.propertyValue, 400000);          // unchanged
  assert.equal(r.avmHaircut, 0);
  assert.ok(r.warnings.some((w) => /not an appraisal/i.test(w.text)));
});

test('break-even is quoted in the same units as the value that was entered', () => {
  // With a haircut in play the calculation runs on the discounted value, but
  // the agent is looking at the headline AVM figure. Quoting the break-even
  // post-haircut would make a dead lead look live.
  const rules = mergeRules({ avmHaircut: 0.05 });
  const withAvm = computeEquity(
    { ...BASE, propertyValue: 500000, firstLien: 400000, valueIsAvm: true },
    rules,
  );

  // An AVM at exactly the break-even figure must produce ~zero cash out.
  const atBreakEven = computeEquity(
    { ...BASE, propertyValue: withAvm.minValueToBreakEven, firstLien: 400000, valueIsAvm: true },
    rules,
  );
  assert.ok(atBreakEven.estimatedCashToBorrower >= 0);
  assert.ok(atBreakEven.estimatedCashToBorrower < 1500);

  // And it must sit above the un-haircut break-even, not below it.
  const noHaircut = computeEquity({ ...BASE, propertyValue: 500000, firstLien: 400000 });
  assert.ok(withAvm.minValueToBreakEven > noHaircut.minValueToBreakEven);
});

/* --- balance from payment ----------------------------------------------- */

/** Standard amortising payment, used to check the solver round-trips. */
function paymentFor(balance, annualRate, months) {
  const i = annualRate / 12;
  return (balance * i) / (1 - Math.pow(1 + i, -months));
}

test('the balance solver round-trips against a known amortisation', () => {
  for (const [balance, rate, months] of [
    [270900, 0.065, 300],
    [412500, 0.0399, 348],
    [95000, 0.075, 120],
  ]) {
    const payment = paymentFor(balance, rate, months);
    const solved = solveBalanceFromPayment({ payment, annualRate: rate, remainingMonths: months });
    assert.ok(Math.abs(solved - balance) < 1,
      `expected ~${balance}, got ${solved}`);
  }
});

test('the balance solver degenerates sensibly at a zero rate', () => {
  assert.equal(solveBalanceFromPayment({ payment: 1000, annualRate: 0, remainingMonths: 120 }), 120000);
  assert.equal(solveBalanceFromPayment({ payment: 1000, annualRate: null, remainingMonths: 120 }), 120000);
});

test('the balance solver refuses incomplete or absurd inputs', () => {
  assert.equal(solveBalanceFromPayment({}), null);
  assert.equal(solveBalanceFromPayment({ payment: 1500 }), null);
  assert.equal(solveBalanceFromPayment({ payment: 0, annualRate: 0.06, remainingMonths: 300 }), null);
  assert.equal(solveBalanceFromPayment({ payment: 1500, annualRate: 0.06, remainingMonths: 0 }), null);
  assert.equal(solveBalanceFromPayment({ payment: 1500, annualRate: 0.06, remainingMonths: 900 }), null);
});

/* --- rules helpers ------------------------------------------------------ */

test('loan type strings normalise to programs', () => {
  assert.equal(normalizeProgram('VA'), 'VA');
  assert.equal(normalizeProgram('va loan'), 'VA');
  assert.equal(normalizeProgram('FHA'), 'FHA');
  assert.equal(normalizeProgram('CV'), 'CONV');
  assert.equal(normalizeProgram('Conventional'), 'CONV');
  assert.equal(normalizeProgram('CONF'), 'CONV');
  assert.equal(normalizeProgram('USDA'), 'USDA');
  assert.equal(normalizeProgram(''), null);
  assert.equal(normalizeProgram('unknown'), null);
});

test('state strings normalise to codes, and "VA" in a state field is Virginia', () => {
  assert.equal(normalizeState('TN'), 'TN');
  assert.equal(normalizeState('tx'), 'TX');
  assert.equal(normalizeState('Texas'), 'TX');
  assert.equal(normalizeState('Tennessee'), 'TN');
  assert.equal(normalizeState('VA'), 'VA');
  assert.equal(normalizeState('ZZ'), null);
  assert.equal(normalizeState(''), null);
});

test('resolveProgramRules reports which rule set the cap', () => {
  const tn = resolveProgramRules(DEFAULT_RULES, 'VA', 'TN');
  assert.equal(tn.maxLtv, 1);
  assert.equal(tn.ltvSource, 'VA base maximum');

  const tx = resolveProgramRules(DEFAULT_RULES, 'VA', 'TX');
  assert.equal(tx.maxLtv, 0.8);
  assert.match(tx.ltvSource, /TX|Texas/);
});
