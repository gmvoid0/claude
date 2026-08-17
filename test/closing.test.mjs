import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateClosingCosts, closingCostText, DEFAULT_CLOSING_RULES }
  from '../extension/src/lib/closing.js';
import { computeEquity } from '../extension/src/lib/equity.js';

const VA = { program: 'VA', state: 'TN', baseLoan: 391581, totalLoan: 400000, rate: 0.065 };

const item = (estimate, id) => estimate.items.find((i) => i.id === id);

test('the estimate is itemised, not one percentage', () => {
  // A single "2% of the loan" overstates a large refinance and understates a
  // small one, because most of these charges are flat.
  const e = estimateClosingCosts(VA);

  assert.ok(e.items.length >= 8, 'every charge is named');
  assert.equal(item(e, 'origination').amount, 3915.81, '1% of the base loan on VA');
  assert.equal(item(e, 'appraisal').amount, 800);
  assert.equal(item(e, 'creditReport').amount, 75);
  assert.equal(item(e, 'titlePolicy').amount, 1566.32, '0.4% of the base loan');
  assert.ok(Math.abs(e.total - e.items.reduce((sum, i) => sum + i.amount, 0)) < 0.01);
});

test('flat charges do not scale, percentage charges do', () => {
  const small = estimateClosingCosts({ ...VA, baseLoan: 120000, totalLoan: 122580 });
  const large = estimateClosingCosts({ ...VA, baseLoan: 800000, totalLoan: 817200 });

  assert.equal(item(small, 'appraisal').amount, item(large, 'appraisal').amount);
  assert.equal(item(small, 'titleSearch').amount, item(large, 'titleSearch').amount);
  assert.ok(item(large, 'origination').amount > item(small, 'origination').amount * 6);

  // The flat charges dominate a small loan and are noise on a large one,
  // which is the whole reason a single percentage would be wrong.
  assert.ok(small.total / 120000 > large.total / 800000);
});

test('VA charges a 1% origination and no separate underwriting', () => {
  // The veteran cannot be charged both; VA's handbook allows a flat 1% OR
  // itemised lender fees, and most lenders take the 1%.
  const e = estimateClosingCosts(VA);
  assert.equal(item(e, 'underwriting'), undefined);
  assert.equal(item(e, 'origination').amount, 391581 * 0.01);
});

test('conventional and FHA charge underwriting separately', () => {
  for (const program of ['CONV', 'FHA']) {
    const e = estimateClosingCosts({ ...VA, program });
    assert.equal(item(e, 'underwriting').amount, 1095, program);
    assert.equal(item(e, 'origination').amount, 2936.86, program);   // 0.75% of the base loan
  }
});

test('the VA appraisal costs more, because VA assigns the appraiser', () => {
  const va = item(estimateClosingCosts(VA), 'appraisal').amount;
  const conv = item(estimateClosingCosts({ ...VA, program: 'CONV' }), 'appraisal').amount;
  assert.ok(va > conv);
});

test('prepaid interest follows the rate, and says when it was assumed', () => {
  const known = estimateClosingCosts({ ...VA, rate: 0.07 });
  const unknown = estimateClosingCosts({ ...VA, rate: null });

  assert.equal(item(known, 'prepaidInterest').amount, 1150.68);   // 400,000 x 7% / 365 x 15
  assert.ok(!/assumed/.test(item(known, 'prepaidInterest').note));
  assert.match(item(unknown, 'prepaidInterest').note, /assumed/);
  assert.ok(item(unknown, 'prepaidInterest').amount > 0);
});

test('escrow reserves are excluded, and their absence is stated', () => {
  // Silently leaving a cost out flatters the take-home figure, which is the
  // one direction this tool must never be wrong in.
  const e = estimateClosingCosts(VA);
  assert.equal(item(e, 'escrowReserves'), undefined);
  assert.ok(e.warnings.some((w) => /escrow/i.test(w.text) && /lower/i.test(w.text)));

  const withReserves = estimateClosingCosts(VA, { ...DEFAULT_CLOSING_RULES, escrowReserves: 2400 });
  assert.equal(item(withReserves, 'escrowReserves').amount, 2400);
  assert.ok(!withReserves.warnings.some((w) => /escrow/i.test(w.text)));
});

test('Texas holds chargeable fees to 2% of the loan', () => {
  // §50(a)(6)(E). The cap bites on a smaller loan, where the flat fees are a
  // larger share of it. The appraisal, the survey and the state base title
  // premium sit outside the cap, so only the rest counts toward it.
  const small = { program: 'CONV', baseLoan: 150000, totalLoan: 150000, rate: 0.065 };
  const outside = estimateClosingCosts({ ...small, state: 'TN' });
  const texas = estimateClosingCosts({ ...small, state: 'TX' });

  const cappable = (e) => ['origination', 'underwriting', 'creditReport', 'floodCert',
    'titleSearch', 'settlementFee', 'recordingFees']
    .reduce((sum, id) => sum + (item(e, id)?.amount ?? 0), 0);

  assert.ok(cappable(outside) > 3000, 'the default fees exceed the 2% cap');
  // Within a few cents: each scaled item is rounded to cents individually.
  assert.ok(cappable(texas) <= 3000.10, 'so Texas is held to it');
  assert.equal(texas.texasCapApplied, true);
  assert.ok(texas.warnings.some((w) => /Texas/.test(w.text)));
  assert.ok(texas.total < outside.total);

  // The appraisal is outside the cap and must not be scaled down with it.
  assert.equal(item(texas, 'appraisal').amount, item(outside, 'appraisal').amount);
  assert.equal(item(texas, 'titlePolicy').amount, item(outside, 'titlePolicy').amount);
});

test('a loan large enough to absorb the flat fees is left alone in Texas', () => {
  const e = estimateClosingCosts({
    program: 'CONV', state: 'TX', baseLoan: 900000, totalLoan: 900000, rate: 0.065,
  });
  assert.equal(e.texasCapApplied, false);
});

test('no loan means no estimate rather than a pile of flat fees', () => {
  for (const bad of [null, 0, -5]) {
    const e = estimateClosingCosts({ ...VA, baseLoan: bad });
    assert.equal(e.total, 0);
    assert.deepEqual(e.items, []);
  }
});

test('an unknown program falls back to conventional rather than charging nothing', () => {
  const e = estimateClosingCosts({ ...VA, program: 'SOMETHING' });
  assert.equal(item(e, 'underwriting').amount, 1095);
  assert.ok(e.total > 0);
});

test('the estimate lands in a defensible band for a cash-out refinance', () => {
  // Industry surveys put refinance closing costs around 2-3% of the loan.
  // This is a sanity rail, not a target: if a settings change ever pushes
  // the default model far outside it, that is worth knowing.
  for (const baseLoan of [150000, 300000, 500000, 900000]) {
    const e = estimateClosingCosts({ ...VA, program: 'CONV', baseLoan, totalLoan: baseLoan });
    const pct = e.total / baseLoan;
    assert.ok(pct > 0.012 && pct < 0.035,
      `${baseLoan}: ${(pct * 100).toFixed(2)}% is outside the plausible band`);
  }
});

test('the itemisation is legible when copied', () => {
  const text = closingCostText(estimateClosingCosts(VA));
  assert.match(text, /Origination:\s+\$3,916/);
  assert.match(text, /Total:\s+\$8,596/);
});

/* --- how it lands on the two figures ------------------------------------ */

test('the advertised figure is the raw one, before fee and costs', () => {
  // "Everything shows pre-fees — that's the advertised number, raw."
  const r = computeEquity({
    propertyValue: 400000, firstLien: 270900, program: 'VA', state: 'TN',
    financeFee: true, closingCosts: 8595.62,
  });

  assert.equal(r.advertisedCashOut, 129100, '100% of value less the payoff');
  assert.equal(r.cashOutBeforeCosts, 120681, 'after the fee is carved out');
  assert.equal(r.estimatedCashToBorrower, 112085.38, 'after the costs as well');
  assert.ok(r.advertisedCashOut > r.estimatedCashToBorrower);
});

test('the advertised figure respects a hard loan limit', () => {
  // A ceiling on the loan is not a charge against it, but quoting past it
  // would be quoting a loan that cannot be written.
  const r = computeEquity({
    propertyValue: 400000, firstLien: 270900, program: 'CONV', state: 'TN',
    loanLimit: 300000, closingCosts: 0,
  });
  assert.equal(r.advertisedCashOut, 29100, '300,000 limit less the payoff');
});

test('with no fee and no costs the two figures agree', () => {
  const r = computeEquity({
    propertyValue: 400000, firstLien: 270900, program: 'CONV', state: 'TN', closingCosts: 0,
  });
  assert.equal(r.advertisedCashOut, r.estimatedCashToBorrower);
});
