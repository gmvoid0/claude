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

/* --- the fee that is not financed --------------------------------------- */

test('an upfront fee paid at closing comes out of the cash', () => {
  // The bug this covers: switching off "finance the fee" left the fee out of
  // the calculation entirely, so the panel showed the borrower $8,600 more
  // than they would receive. Wrong in the optimistic direction, on the number
  // the agent says out loud.
  const financed = computeEquity(BASE);
  const atClosing = computeEquity({ ...BASE, financeFee: false });

  assert.equal(atClosing.maxBaseLoan, 400000, 'the loan itself reaches the full 100%');
  assert.equal(atClosing.financedFee, 0);
  assert.equal(atClosing.unfinancedFee, 8600, '2.15% of the base loan, due at closing');
  assert.equal(atClosing.estimatedCashToBorrower, 400000 - 270900 - 8600);

  assert.ok(atClosing.estimatedCashToBorrower < financed.estimatedCashToBorrower,
    'and it must not look better than financing it');
  assert.ok(atClosing.warnings.some((w) => /due at closing/i.test(w.text)));
});

test('every dollar of the loan is accounted for, on every program', () => {
  // base loan = liens + closing costs + any fee paid at closing + cash out.
  // If this ever fails, money has been invented or lost somewhere.
  for (const program of ['VA', 'FHA', 'CONV', 'USDA']) {
    for (const financeFee of [true, false]) {
      for (const closingCosts of [0, 6500]) {
        const r = computeEquity({ ...BASE, program, financeFee, closingCosts });
        const accounted = r.totalLiens + r.closingCosts + r.unfinancedFee
          + r.estimatedCashToBorrower;
        assert.ok(Math.abs(accounted - r.maxBaseLoan) < 0.01,
          `${program} financeFee=${financeFee} costs=${closingCosts}: `
          + `${accounted} vs base ${r.maxBaseLoan}`);
      }
    }
  }
});

test('a waived fee is charged neither way', () => {
  const r = computeEquity({ ...BASE, financeFee: false, feeExempt: true });
  assert.equal(r.unfinancedFee, 0);
  assert.equal(r.financedFee, 0);
  assert.equal(r.estimatedCashToBorrower, 129100);
});

test('FHA UFMIP financed on top costs the borrower no proceeds', () => {
  // It rides above the 80% base rather than being squeezed inside it, so
  // unlike VA it does not reduce what the borrower walks away with.
  const financed = computeEquity({ ...BASE, program: 'FHA' });
  assert.equal(financed.maxBaseLoan, 320000);
  assert.equal(financed.unfinancedFee, 0);
  assert.equal(financed.estimatedCashToBorrower, 320000 - 270900);

  const atClosing = computeEquity({ ...BASE, program: 'FHA', financeFee: false });
  assert.equal(atClosing.maxBaseLoan, 320000, 'the base loan is the same either way');
  assert.equal(atClosing.unfinancedFee, 5600, '1.75% of 320,000');
  assert.equal(atClosing.estimatedCashToBorrower, 320000 - 270900 - 5600);
});

test('break-even accounts for how the fee is being paid', () => {
  // Three different arrangements, three different answers, and each has to
  // actually break even — a break-even figure that is wrong sends an agent
  // back to a lead that is still dead.
  for (const input of [
    { ...BASE, financeFee: true },                    // VA, fee inside the cap
    { ...BASE, financeFee: false },                   // VA, fee at closing
    { ...BASE, program: 'FHA', financeFee: false },   // FHA, fee at closing
    { ...BASE, program: 'CONV' },                     // no fee at all
    { ...BASE, closingCosts: 6500 },
  ]) {
    const r = computeEquity(input);
    assert.ok(r.minValueToBreakEven > 0, 'a break-even value is offered');

    const at = computeEquity({ ...input, propertyValue: r.minValueToBreakEven });
    assert.ok(at.estimatedCashToBorrower >= 0,
      `${input.program} financeFee=${input.financeFee}: cash ${at.estimatedCashToBorrower} at break-even`);

    const below = computeEquity({ ...input, propertyValue: r.minValueToBreakEven - 5000 });
    assert.ok(below.estimatedCashToBorrower < 0, 'and below it the deal is dead');
  }
});

test('no break-even is offered when a loan limit is what binds', () => {
  // Past a hard loan limit a higher value buys no more loan, so there is no
  // value at which the deal comes back — quoting one would be a lie.
  const r = computeEquity({ ...BASE, propertyValue: 300000, firstLien: 290000, loanLimit: 250000 });

  assert.equal(r.maxBaseLoan, 250000);
  assert.ok(r.estimatedCashToBorrower < 0);
  assert.equal(r.minValueToBreakEven, null);
});

/* --- invariants, over the whole input space ------------------------------ */

/** Deterministic PRNG, so a failure is reproducible rather than a rumour. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('the things that must always hold, hold across 4,000 scenarios', () => {
  const rand = seeded(20260817);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  for (let i = 0; i < 4000; i++) {
    const input = {
      propertyValue: Math.round(60000 + rand() * 1400000),
      firstLien: Math.round(rand() * 900000),
      secondLien: rand() < 0.25 ? Math.round(rand() * 90000) : 0,
      program: pick(['VA', 'FHA', 'CONV']),
      state: pick(['TN', 'TX', 'CA', 'NY', null]),
      closingCosts: pick([0, 4500, 12000]),
      financeFee: rand() < 0.5,
      feeExempt: rand() < 0.2,
      subsequentUse: rand() < 0.2,
      valueIsAvm: rand() < 0.3,
      loanLimit: rand() < 0.15 ? Math.round(200000 + rand() * 600000) : null,
    };
    const r = computeEquity(input, mergeRules({ avmHaircut: 0.05 }));
    const where = `#${i} ${JSON.stringify(input)}`;

    // 1. The base loan never exceeds the LTV ceiling on the screening value.
    assert.ok(r.maxBaseLoan <= r.propertyValue * r.maxLtv + 0.01, `cap breached: ${where}`);

    // 2. When the fee is financed inside the cap, the *total* loan is what
    //    must fit under it — this is the whole point of the VA arithmetic.
    if (r.feeFinanced && r.upfrontFeeRate > 0 && r.program === 'VA') {
      assert.ok(r.totalLoanAmount <= r.propertyValue * r.maxLtv + 0.01,
        `total loan breached the cap: ${where}`);
    }

    // 3. Nothing is invented or lost between the loan and the borrower.
    const accounted = r.totalLiens + r.closingCosts + r.unfinancedFee + r.estimatedCashToBorrower;
    assert.ok(Math.abs(accounted - r.maxBaseLoan) < 0.011, `money went missing: ${where}`);

    // 4. Cash out can never exceed the equity when the cap is 100% or less.
    if (r.maxLtv <= 1) {
      assert.ok(r.estimatedCashToBorrower <= r.grossEquity + 0.01,
        `cash exceeded equity: ${where}`);
    }

    // 5. A quoted break-even value must actually break even.
    if (r.minValueToBreakEven != null) {
      const at = computeEquity(
        { ...input, propertyValue: r.minValueToBreakEven },
        mergeRules({ avmHaircut: 0.05 }),
      );
      assert.ok(at.estimatedCashToBorrower >= 0,
        `break-even ${r.minValueToBreakEven} still short by `
        + `${at.estimatedCashToBorrower}: ${where}`);
    }

    // 6. Figures are either usable numbers or explicitly absent. NaN reaching
    //    the panel would render as a blank or "$NaN" mid-call.
    for (const key of ['maxBaseLoan', 'financedFee', 'unfinancedFee', 'totalLoanAmount',
      'grossEquity', 'currentLtv', 'estimatedCashToBorrower', 'minValueToBreakEven']) {
      const v = r[key];
      assert.ok(v == null || Number.isFinite(v), `${key} was ${v}: ${where}`);
    }
  }
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
