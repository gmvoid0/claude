/**
 * Equity / LTV / cash-out calculation engine.
 *
 * Pure and DOM-free: every input arrives as a number, every output is derived.
 * This is the piece that has to be right, so it is the piece that is tested.
 *
 * ---------------------------------------------------------------------------
 * THIS IS AN ESTIMATOR, NOT AN UNDERWRITING DECISION.
 * It models the LTV cap and financed upfront fee only. It does not model
 * DTI, residual income, credit, seasoning, entitlement, county loan limits
 * (unless one is supplied), occupancy, unit count, or investor overlays.
 * ---------------------------------------------------------------------------
 */

import { round2, floorDollar } from './money.js';
import { resolveProgramRules, DEFAULT_RULES } from './rules.js';

/**
 * @typedef {Object} EquityInput
 * @property {number|null} propertyValue   Appraised / estimated value.
 * @property {number|null} firstLien       First mortgage payoff balance.
 * @property {number|null} secondLien      Second mortgage / HELOC balance.
 * @property {string|null} program         'VA' | 'FHA' | 'CONV' | 'USDA'
 * @property {string|null} state           Two-letter state code.
 * @property {number|null} ltvOverride     Manual LTV cap (decimal) if set.
 * @property {number|null} loanLimit       County / investor max loan amount.
 * @property {number}      closingCosts    Costs rolled into the transaction.
 * @property {boolean}     financeFee      Finance the upfront fee into the loan.
 * @property {boolean}     feeExempt       VA funding fee exemption (disability).
 * @property {boolean}     subsequentUse   VA subsequent-use funding fee tier.
 */

/**
 * Run the calculation.
 * Always returns a result object; check `.ok` and `.missing` before trusting
 * the derived figures.
 */
export function computeEquity(input = {}, rules = DEFAULT_RULES) {
  const warnings = [];
  const missing = [];

  const enteredValue = numOrNull(input.propertyValue);

  // An automated valuation (a Zestimate, a Redfin estimate, any AVM) is not an
  // appraisal. Applying a haircut lets the screening number sit deliberately
  // below the headline figure so a lead is not qualified on a number the
  // appraiser will not support.
  const valueIsAvm = !!input.valueIsAvm;
  const haircut = clamp01(numOrNull(rules?.avmHaircut) ?? 0);
  const haircutApplied = valueIsAvm && haircut > 0 && enteredValue != null;
  const value = haircutApplied ? round2(enteredValue * (1 - haircut)) : enteredValue;

  const first = numOrNull(input.firstLien) ?? 0;
  const second = numOrNull(input.secondLien) ?? 0;
  const closingCosts = numOrNull(input.closingCosts) ?? 0;
  const loanLimit = numOrNull(input.loanLimit);
  const ltvOverride = numOrNull(input.ltvOverride);

  const state = input.state || null;

  // Lead data frequently arrives with no usable loan type — one source screen
  // carried an agent ID in that column. Refusing to calculate leaves the agent
  // with nothing while the customer is on the line, so the most restrictive
  // common program is assumed and the assumption is surfaced loudly. It is
  // the conservative direction: Conventional's 80% cap never overstates what
  // a VA borrower could take.
  const requestedProgram = input.program || null;
  const programAssumed = !requestedProgram;
  const program = requestedProgram ?? (rules?.assumedProgram ?? 'CONV');

  if (value == null || value <= 0) missing.push('propertyValue');
  if (numOrNull(input.firstLien) == null) missing.push('firstLien');

  if (programAssumed) {
    warnings.push({
      level: 'error',
      text: 'Loan type not confirmed — assuming Conventional at 80%. Ask the borrower; VA would open up materially more.',
    });
  }

  const cfg = program
    ? resolveProgramRules(rules, program, state, { subsequentUse: !!input.subsequentUse })
    : null;

  // --- LTV cap -------------------------------------------------------------
  let maxLtv = null;
  let ltvSource = null;

  if (ltvOverride != null && ltvOverride > 0) {
    maxLtv = ltvOverride;
    ltvSource = 'manual override';
  } else if (cfg) {
    maxLtv = cfg.maxLtv;
    ltvSource = cfg.ltvSource;
  }

  if (program === 'USDA' && ltvOverride == null) {
    warnings.push({
      level: 'error',
      text: 'USDA does not allow cash-out refinancing. No cash-out is available on this program.',
    });
  }

  if (state === 'TX' && program === 'VA') {
    warnings.push({
      level: 'info',
      text: 'Texas: VA cash-out on a homestead is limited to 80% LTV under Texas Constitution §50(a)(6), not the 100% national VA maximum.',
    });
  }

  if (valueIsAvm) {
    warnings.push({
      level: 'warn',
      text: haircutApplied
        ? `Value is an automated estimate, not an appraisal. Screening at ${fmtPlain(value)} after a ${pct(haircut)} haircut from ${fmtPlain(enteredValue)}. The appraisal governs.`
        : 'Value is an automated estimate, not an appraisal. AVMs routinely miss by several percent, which matters most at high LTV. The appraisal governs.',
    });
  }

  const totalLiens = round2(first + second);

  // Everything below needs a value to be meaningful.
  if (value == null || value <= 0 || maxLtv == null) {
    return {
      ok: false,
      missing,
      warnings,
      program,
      programAssumed,
      programLabel: cfg?.label ?? null,
      state,
      maxLtv,
      ltvSource,
      totalLiens,
      propertyValue: value,
      propertyValueEntered: enteredValue,
      valueIsAvm,
      avmHaircut: haircutApplied ? haircut : 0,
      grossEquity: null,
      grossEquityPct: null,
      currentLtv: null,
      maxBaseLoan: null,
      financedFee: null,
      unfinancedFee: 0,
      totalLoanAmount: null,
      resultingLtv: null,
      advertisedCashOut: null,
      cashOutBeforeCosts: null,
      estimatedCashToBorrower: null,
      shortfall: null,
      minValueToBreakEven: null,
      feeLabel: cfg?.feeLabel ?? null,
      upfrontFeeRate: cfg?.upfrontFeeRate ?? null,
      notes: cfg?.notes ?? [],
    };
  }

  // --- Position ------------------------------------------------------------
  const grossEquity = round2(value - totalLiens);
  const grossEquityPct = value > 0 ? grossEquity / value : null;
  const currentLtv = value > 0 ? totalLiens / value : null;

  // --- Max loan ------------------------------------------------------------
  const feeRate = input.feeExempt ? 0 : (cfg?.upfrontFeeRate ?? 0);
  const financeFee = input.financeFee !== false && feeRate > 0;
  const feeInsideCap = !!cfg?.feeInsideCap;

  // The cap applies to different things depending on the program:
  //   feeInsideCap  (VA): base loan + financed fee must fit under value*maxLtv
  //   !feeInsideCap (FHA): base loan fits under value*maxLtv, fee stacks above
  const ltvCapAmount = value * maxLtv;

  let maxBaseLoan;
  if (financeFee && feeInsideCap) {
    maxBaseLoan = ltvCapAmount / (1 + feeRate);
  } else {
    maxBaseLoan = ltvCapAmount;
  }

  // A county / investor loan limit caps the *base* loan amount.
  let limitApplied = false;
  if (loanLimit != null && loanLimit > 0 && loanLimit < maxBaseLoan) {
    maxBaseLoan = loanLimit;
    limitApplied = true;
  }

  maxBaseLoan = floorDollar(maxBaseLoan);

  const financedFee = financeFee ? round2(maxBaseLoan * feeRate) : 0;

  // An upfront fee that is not financed does not vanish — it is due at
  // closing, and on a cash-out it comes out of the proceeds. Leaving it out
  // overstated cash to the borrower by the whole fee: on a $400,000 VA
  // cash-out that is $8,600 promised on the phone that never arrives.
  const unfinancedFee = !financeFee && feeRate > 0 ? round2(maxBaseLoan * feeRate) : 0;

  const totalLoanAmount = round2(maxBaseLoan + financedFee);
  const resultingLtv = value > 0 ? totalLoanAmount / value : null;

  if (limitApplied) {
    warnings.push({
      level: 'info',
      text: `Base loan capped by the loan limit of ${fmtPlain(loanLimit)} rather than by LTV.`,
    });
  }

  // --- Cash out ------------------------------------------------------------
  // The financed fee raises the loan but goes to the agency, not the borrower,
  // so it never appears in cash-out. Closing costs and any fee being paid at
  // closing rather than financed both reduce net proceeds.
  const cashOutBeforeCosts = round2(maxBaseLoan - totalLiens);
  const estimatedCashToBorrower = round2(cashOutBeforeCosts - closingCosts - unfinancedFee);

  // The raw figure: the LTV ceiling against the payoff, before the upfront
  // fee is carved out of it and before any cost comes off. This is the
  // number that gets quoted on the phone, so it is shown as its own figure
  // rather than left implicit — an agent who says it should be looking at
  // it, next to what the borrower will actually receive.
  //
  // A hard loan limit still binds it. That is a ceiling on the loan, not a
  // charge against it, and quoting past it would be quoting a loan that
  // cannot be written.
  const advertisedCeiling = limitApplied ? Math.min(ltvCapAmount, loanLimit) : ltvCapAmount;
  const advertisedCashOut = round2(floorDollar(advertisedCeiling) - totalLiens);

  if (unfinancedFee > 0) {
    warnings.push({
      level: 'info',
      text: `${cfg?.feeLabel ?? 'The upfront fee'} of ${fmtPlain(unfinancedFee)} is not being financed, `
        + 'so it is due at closing and has been taken out of the cash figure.',
    });
  }

  let shortfall = null;
  if (estimatedCashToBorrower < 0) {
    shortfall = round2(Math.abs(estimatedCashToBorrower));
    warnings.push({
      level: 'error',
      text: `No cash available. At ${pct(maxLtv)} LTV the loan does not cover the payoff plus costs — the borrower would need to bring roughly ${fmtPlain(shortfall)} to close.`,
    });
  }

  // What would the property need to be worth to break even (zero cash out)?
  //
  // Worked backwards from the loan rather than forwards from the LTV, because
  // the base loan is floored to whole dollars and the fee is rounded to
  // cents. Solving in LTV terms and rounding at the end left break-even
  // figures a few cents short — the deal still dead at the value the panel
  // said would revive it, which is the one thing this figure must never do.
  //
  // Step one: the base loan that clears the payoff.
  //
  //   cash = base − liens − costs − (fee, if it is being paid at closing)
  //        = base x (1 − unfinancedRate) − liens − costs
  //
  // Step two: the value that produces that base loan. The fee only affects
  // this step when it is financed *inside* the cap, where the base loan is
  // squeezed to make room for it. Financed on top (FHA) it rides above the
  // base and costs the borrower nothing here.
  //
  // Reported in the same units as the figure that was entered. When an AVM
  // haircut is in play the calculation runs on the discounted value, so the
  // result is grossed back up — otherwise the agent would be comparing a
  // post-haircut target against the pre-haircut number on their screen and
  // would read a dead lead as a live one.
  const unfinancedRate = financeFee ? 0 : feeRate;

  let minValueToBreakEven = null;
  if (maxLtv > 0 && unfinancedRate < 1) {
    const neededBase = Math.ceil((totalLiens + closingCosts) / (1 - unfinancedRate));

    // A loan limit the payoff cannot fit under means *no* value breaks even.
    // Testing whether the limit binds at today's value is not enough: on a
    // borrower who is underwater the limit often does not bind now and does
    // bind at the value that would clear them, and the panel quoted a target
    // that leaves them six figures short.
    const limitAllows = loanLimit == null || loanLimit <= 0 || neededBase <= loanLimit;

    if (limitAllows) {
      const baseToValue = financeFee && feeInsideCap ? 1 + feeRate : 1;
      const screening = (neededBase * baseToValue) / maxLtv;
      minValueToBreakEven = Math.ceil(haircutApplied ? screening / (1 - haircut) : screening);
    }
  }

  // --- Plausibility checks -------------------------------------------------
  if (totalLiens > value) {
    warnings.push({
      level: 'error',
      text: 'Liens exceed the property value — this borrower is underwater.',
    });
  }
  if (value > 0 && value < 20000) {
    warnings.push({
      level: 'warn',
      text: `Property value of ${fmtPlain(value)} looks too low to be a home value. Check the figure.`,
    });
  }
  if (first > 0 && first < 1000) {
    warnings.push({
      level: 'warn',
      text: `Mortgage balance of ${fmtPlain(first)} looks too low to be a loan balance. Check the source field.`,
    });
  }
  if (currentLtv != null && currentLtv > 0 && currentLtv < 0.05) {
    warnings.push({
      level: 'warn',
      text: 'Current LTV is under 5% — verify the balance was read from the right field.',
    });
  }

  const threshold = numOrNull(rules?.minCashOutThreshold) ?? 0;

  return {
    ok: missing.length === 0,
    missing,
    warnings,

    program,
    programAssumed,
    programLabel: cfg?.label ?? null,
    state,

    propertyValue: value,
    propertyValueEntered: enteredValue,
    valueIsAvm,
    avmHaircut: haircutApplied ? haircut : 0,
    firstLien: first,
    secondLien: second,
    totalLiens,

    grossEquity,
    grossEquityPct,
    currentLtv,

    maxLtv,
    ltvSource,
    maxBaseLoan,
    financedFee,
    unfinancedFee,
    feeLabel: cfg?.feeLabel ?? null,
    upfrontFeeRate: feeRate,
    feeFinanced: financeFee,
    totalLoanAmount,
    resultingLtv,

    closingCosts,
    advertisedCashOut,
    cashOutBeforeCosts,
    estimatedCashToBorrower,
    shortfall,
    minValueToBreakEven,

    meetsThreshold: estimatedCashToBorrower >= threshold && estimatedCashToBorrower > 0,
    threshold,

    notes: cfg?.notes ?? [],
  };
}

/**
 * Reverse a remaining principal balance out of a monthly payment.
 *
 * The fallback for when a lead has no balance on file but the borrower can
 * quote their payment. Standard present-value-of-an-annuity inversion:
 *
 *     B = P x (1 - (1 + i)^-n) / i        i = annual rate / 12
 *
 * Two caveats that make this an estimate and not a payoff figure:
 *   - it needs the *principal and interest* portion; a PITI payment that
 *     includes escrow will overstate the balance, sometimes badly;
 *   - remaining term is rarely known exactly.
 *
 * Returns null when the inputs are insufficient.
 */
export function solveBalanceFromPayment({ payment, annualRate, remainingMonths } = {}) {
  const p = numOrNull(payment);
  const n = numOrNull(remainingMonths);
  const rate = numOrNull(annualRate);

  if (p == null || p <= 0) return null;
  if (n == null || n <= 0 || n > 600) return null;

  // A zero or missing rate degenerates to simple repayment.
  if (rate == null || rate <= 0) return round2(p * n);

  const i = rate / 12;
  const balance = (p * (1 - Math.pow(1 + i, -n))) / i;
  return Number.isFinite(balance) ? round2(balance) : null;
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n) {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(0.99, n));
}

function pct(rate) {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}

function fmtPlain(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
