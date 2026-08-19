/**
 * Sizing the loan to type into Easy Qualifier.
 *
 * This is the whole product now. Not "how much equity is in the house" — the
 * one number a loan officer needs on a call is the **final loan amount**, the
 * figure that goes in EQ's Loan Amount box, and everything here exists to
 * produce it from what is already on the screen.
 *
 * The method is the floor's, written down:
 *
 *   1. Escrows      six months of taxes and insurance. Take the most recent
 *                   year's property tax off Zillow, add $1,000 for the
 *                   insurance premium, halve it.
 *   2. Title        $1,500
 *   3. Payoff       the mortgage balance, from the application
 *   4. Cash out     what the borrower is asking for, from the application
 *   5. Appraisal    $700 — except on a VA IRRRL, which has none. A
 *                   streamline reuses the existing valuation, so charging
 *                   for one puts $700 on a loan that never orders it.
 *   6. Underwriting $2,000
 *   7. Add 1-6 and multiply by 1.035.
 *
 * Two notes on that last step, because they are the kind of thing that gets
 * argued about later:
 *
 * Multiplying the subtotal by 1.035 is a gross-up: it adds a financed charge
 * of about 3.5% on top of what the borrower needs to walk away with. The
 * arithmetically exact gross-up is a division — subtotal / (1 - 0.035) — and
 * it lands about $47 higher on a $372,000 file, because 3.5% of the final
 * loan is more than 3.5% of the subtotal. The multiply is what the floor
 * uses, so the multiply is what this does. `grossUpExact` in the result
 * shows the other figure beside it, for whoever wants to see the gap.
 *
 * Every constant here is a setting. Title work is not $1,500 everywhere and
 * an underwriting fee is a lender's choice, so these are the floor's numbers
 * rather than the truth, and they are meant to be changed in one place.
 *
 * Pure and DOM-free.
 */

import { round2 } from './money.js';

export const DEFAULT_SIZING = {
  /**
   * Added to the annual property tax to stand in for the homeowner's
   * insurance premium, before the year is halved. A flat $1,000 rather than
   * a rate on the value: it is what the floor quotes, and on a call an
   * agent needs the same answer the person beside them would give.
   */
  insuranceAllowance: 1000,

  /** Months of taxes and insurance collected at closing. Six of twelve. */
  escrowMonths: 6,

  titleFees: 1500,
  appraisal: 700,
  underwriting: 2000,

  /** The financed charge on top. 1.035 is 3.5%. */
  grossUp: 1.035,
};

/**
 * @param {object} input
 * @param {number|null} input.annualPropertyTax  Most recent year, off Zillow
 * @param {number|null} input.payoff             Mortgage balance
 * @param {number|null} input.cashOut            What the borrower wants
 * @param {number|null} [input.secondLien]       Rolled into the payoff when present
 * @param {string|null} [input.program]          VA turns a no-cash refi into an IRRRL
 * @param {object} [rules]
 */
export function sizeLoan({
  annualPropertyTax = null,
  payoff = null,
  cashOut = null,
  secondLien = null,
  program = null,
} = {}, rules = DEFAULT_SIZING) {
  const r = { ...DEFAULT_SIZING, ...(rules ?? {}) };

  const tax = money(annualPropertyTax);
  const first = money(payoff);
  const second = money(secondLien) ?? 0;
  const cash = money(cashOut);

  const missing = [];
  if (tax == null) missing.push('annualPropertyTax');
  if (first == null) missing.push('payoff');
  if (cash == null) missing.push('cashOut');

  const charges = closingCharges({ annualPropertyTax, cashOut, program }, r);
  const irrrl = charges.irrrl;
  const charge = (id) => charges.items.find((i) => i.id === id);

  const items = [];
  const add = (id, label, amount, note) => {
    if (amount == null) {
      items.push({ id, label, amount: null, note, missing: true });
      return;
    }
    items.push({ id, label, amount: round2(amount), note });
  };

  // The charges in the order the method lists them, with the two lines that
  // are not charges at all — what is owed, and what is handed over — in
  // their places between.
  items.push(charge('escrow'), charge('title'));
  add('payoff', 'Mortgage payoff', first, first == null ? 'from the application' : undefined);
  if (second > 0) add('secondLien', 'Second lien payoff', second);
  add('cashOut', 'Cash to borrower', cash, cash == null ? 'from the application' : undefined);
  items.push(charge('appraisal'), charge('underwriting'));

  const complete = missing.length === 0;
  const subtotal = complete
    ? round2(items.reduce((sum, item) => sum + (item.amount ?? 0), 0))
    : null;

  const grossUp = Number.isFinite(r.grossUp) && r.grossUp > 0 ? r.grossUp : 1;
  const finalLoan = subtotal == null ? null : round2(subtotal * grossUp);

  // The same charge worked out the other way, for the argument that follows.
  const rate = grossUp - 1;
  const grossUpExact = subtotal == null || rate <= 0 || rate >= 1
    ? null
    : round2(subtotal / (1 - rate));

  return {
    ok: complete,
    missing,
    irrrl,
    // What a settlement sheet calls closing costs: everything here that is
    // a charge, with the payoff and the cash left out. The equity figures
    // take this too, so the two halves of the panel cannot drift apart.
    charges,
    items,
    subtotal,
    grossUp,
    financedCharge: subtotal == null ? null : round2(finalLoan - subtotal),
    finalLoan,
    finalLoanRounded: finalLoan == null ? null : Math.round(finalLoan),
    grossUpExact,
    escrowDetail: charges.escrowDetail,
  };
}

/**
 * The charges alone — everything the file costs that is neither money owed
 * nor money handed over.
 *
 * This exists so there is one set of fee numbers in the tool rather than
 * two. The equity figures used to run a separate itemised estimator with
 * its own per-programme origination and title percentages, which meant the
 * take-home figure and the Easy Qualifier loan amount were built out of
 * different fees and quietly disagreed on the same screen.
 *
 * All flat, and none of them depends on the size of the loan — so unlike
 * the model this replaced, it needs no second pass to settle.
 */
export function closingCharges({
  annualPropertyTax = null, cashOut = null, program = null,
} = {}, rules = DEFAULT_SIZING) {
  const r = { ...DEFAULT_SIZING, ...(rules ?? {}) };
  const tax = money(annualPropertyTax);
  const cash = money(cashOut);

  const items = [];
  const warnings = [];
  const add = (id, label, amount, note) => items.push(
    amount == null
      ? { id, label, amount: null, note, missing: true }
      : { id, label, amount: round2(amount), note },
  );

  const months = Number.isFinite(r.escrowMonths) ? r.escrowMonths : 6;
  const annualEscrowed = tax == null ? null : tax + (r.insuranceAllowance ?? 0);
  add('escrow', `Escrows, ${months} months`,
    annualEscrowed == null ? null : (annualEscrowed * months) / 12,
    tax == null
      ? 'needs the property tax from Zillow'
      : `${fmt(tax)} tax + ${fmt(r.insuranceAllowance ?? 0)} insurance, ${months} of 12 months`);

  add('title', 'Title fees', r.titleFees);

  // A VA refinance that takes no cash is an IRRRL, and a streamline reuses
  // the valuation already on the loan. Explicitly zero, not merely
  // unfilled: a blank cash-out box on a fresh record is an unanswered
  // question, and reading it as "takes no cash" would waive the appraisal
  // on every file before the agent has asked. The line stays at zero with
  // its reason rather than disappearing.
  const irrrl = String(program ?? '').toUpperCase() === 'VA' && cash === 0;
  add('appraisal', 'Appraisal', irrrl ? 0 : r.appraisal,
    irrrl ? 'waived — an IRRRL reuses the existing valuation' : undefined);

  add('underwriting', 'Underwriting', r.underwriting);

  if (tax == null) {
    warnings.push({
      level: 'warn',
      text: 'No property tax read yet, so the escrow line is missing and real '
        + 'cash to the borrower will be lower than shown.',
    });
  }

  const known = items.filter((i) => i.amount != null);
  return {
    irrrl,
    items,
    warnings,
    escrowDetail: tax == null ? null : {
      annualPropertyTax: round2(tax),
      insuranceAllowance: round2(r.insuranceAllowance ?? 0),
      annualEscrowed: round2(annualEscrowed),
      months,
    },
    complete: known.length === items.length,
    total: round2(known.reduce((sum, i) => sum + i.amount, 0)),
  };
}

/**
 * Whether the sized loan is larger than the programme will actually write.
 *
 * This method sizes the loan from what the borrower needs — payoff, cash,
 * costs — and never looks at the value of the house. That is the right way
 * round for a conversation and the wrong way round for a quote: a
 * conventional file capped at 80% of a $400,000 home cannot be written at
 * $385,503 no matter how the arithmetic got there. Typing it into Easy
 * Qualifier prices a loan that does not exist.
 *
 * So the two are compared once, here, and the gap is stated rather than
 * left for the agent to notice that two parts of the same panel disagree.
 */
export function overCeiling(finalLoan, propertyValue, maxLtv) {
  const loan = Number(finalLoan);
  const value = Number(propertyValue);
  const ltv = Number(maxLtv);
  if (!(loan > 0) || !(value > 0) || !(ltv > 0)) return null;

  const ceiling = round2(value * ltv);
  if (loan <= ceiling) return null;
  return { ceiling, over: round2(loan - ceiling), maxLtv: ltv };
}

/** The itemisation as text, for the clipboard. */
export function sizingText(result) {
  if (!result?.items?.length) return '';
  const width = Math.max(...result.items.map((i) => i.label.length)) + 2;
  const lines = result.items.map(
    (item) => `  ${(item.label + ':').padEnd(width)}${item.amount == null ? '—' : fmt(item.amount)}`,
  );
  if (result.subtotal != null) {
    lines.push(`  ${'Subtotal:'.padEnd(width)}${fmt(result.subtotal)}`);
    lines.push(`  ${`x ${result.grossUp}:`.padEnd(width)}${fmt(result.finalLoan)}`);
  }
  return lines.join('\n');
}

function money(value) {
  // Number(null) is 0 and Number('') is 0, and a payoff that is missing is
  // not a payoff of nothing — that road ends with a loan amount quoted on a
  // call with the mortgage balance left out of it.
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fmt(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
