/**
 * The application, restated as Easy Qualifier's own form.
 *
 * An agent with the panel on one screen and EQ on the other should be able
 * to read straight down and type. That means EQ's field names, not ours —
 * "Appraised Value", not "Home value" — and EQ's order, so the eye moves the
 * same way down both. Renaming things in the middle of a phone call is how
 * a payoff ends up in a cash-out box.
 *
 * Three kinds of row, and the difference matters more than it looks:
 *
 *   read      taken from the application or the lead screen
 *   computed  worked out here — the loan amount, and only the loan amount
 *   assumed   a standing choice this method makes, stated so it can be
 *             argued with rather than discovered later. The refinance
 *             purpose is the clearest case: it is filled in from the fact
 *             that this is a cash-out floor writing VA paper, not from
 *             anything on the record.
 *
 * A field EQ marks required that nothing can fill is still listed, empty, so
 * the gap is visible before the quote comes back wrong rather than after.
 *
 * The option lists inside EQ's dropdowns are only partly known — Loan Type
 * is confirmed, the rest are not — so anything unconfirmed is flagged rather
 * than asserted. Guessing that EQ says "Self-employed" when it might say
 * "Self Employed" would be a fill that silently does nothing.
 *
 * Pure and DOM-free.
 */

import { parseMoney } from './money.js';

/** EQ's own words for the loan types, from the live capture. */
const LOAN_TYPE = {
  VA: 'VA',
  FHA: 'FHA',
  CONV: 'Conventional',
  CONVENTIONAL: 'Conventional',
  USDA: 'USDA',
};

/**
 * @param {object} source
 * @param {object} source.application  from buildApplication()
 * @param {object} source.sizing       from sizeLoan()
 * @param {object} source.inputs       detected fields
 * @returns {Array<{key,eq,value,kind,note,required,missing,checkList}>}
 */
export function eqFields({ application = {}, sizing = null, inputs = {} } = {}) {
  const app = (key) => {
    const raw = application?.[key]?.value;
    return raw == null || String(raw).trim() === '' ? null : String(raw).trim();
  };

  const rows = [];
  const add = (key, eq, value, opts = {}) => {
    rows.push({
      key,
      eq,
      value: value ?? null,
      missing: value == null,
      kind: opts.kind ?? 'read',
      note: opts.note,
      required: !!opts.required,
      // EQ's exact wording for this dropdown is not confirmed yet.
      checkList: !!opts.checkList,
    });
  };

  const cashOut = parseMoney(app('cashOut'));
  const program = (app('loanType') ?? inputs.program?.normalized ?? '').toUpperCase();

  // --- EQ's first column, top to bottom
  add('borrowerName', 'Borrower Name', app('fullName'), { required: true });
  add('loanType', 'Loan Type', LOAN_TYPE[program] ?? null, {
    required: true,
    note: program && !LOAN_TYPE[program] ? `"${program}" is not one of EQ's types` : undefined,
  });
  add('loanPurpose', 'Loan Purpose', 'Refinance 1st mortgage', {
    kind: 'assumed', required: true, checkList: true,
  });
  add('refinancePurpose', 'Refinance Purpose', refinancePurpose(program, cashOut), {
    kind: 'assumed', checkList: true,
    note: program === 'VA' ? 'VA has its own two, and this is which' : undefined,
  });
  add('appraisedValue', 'Appraised Value', money(app('value') ?? inputs.propertyValue?.num), {
    required: true,
  });
  add('loanAmount', 'Loan Amount', money(sizing?.finalLoanRounded), {
    kind: 'computed', required: true,
    note: sizing?.finalLoan == null
      ? `waiting on ${(sizing?.missing ?? []).join(', ') || 'the application'}`
      : `escrows + fees + payoff + cash, x ${sizing.grossUp}`,
  });
  add('secondLoanAmount', 'Second Loan Amount', money(inputs.secondLien?.num));

  // --- second column
  add('occupancy', 'Occupancy', app('occupancy'), { required: true, checkList: true });
  add('propertyType', 'Property Type', app('propertyType'), { required: true, checkList: true });
  add('zip', 'ZIP Code', inputs.zip?.value ?? null, {
    required: true, note: 'sets the county and state',
  });
  add('creditScore', 'Qualifying Credit Score', app('fico'), { required: true });
  add('income', 'Borrower Income', money(app('income')));

  // The list stops here on purpose. Monthly debt, the annual taxes and
  // insurance, and the employment dropdown all sit at zero or at their
  // default in Easy Qualifier and do not move the quote, so listing them
  // put four rows of noise between the agent and the ones that do. The tax
  // bill still matters — it is the escrow line — but it belongs beside that
  // line rather than posing as a field waiting to be typed.

  return rows;
}

/** The list as text, one field per line, for the clipboard. */
export function eqFieldsText(rows) {
  if (!rows?.length) return '';
  const width = Math.max(...rows.map((r) => r.eq.length)) + 2;
  return rows
    .map((r) => `${(`${r.eq}:`).padEnd(width)}${r.value ?? '—'}`)
    .join('\n');
}

/**
 * Which refinance this is, in Easy Qualifier's words.
 *
 * VA does not use the generic pair. A VA refinance that takes cash is a
 * cash-out Type II — Type I only covers a VA-to-VA loan that does not exceed
 * the payoff, which is not what a cash-out floor writes. A VA refinance that
 * takes no cash is an IRRRL, the streamline.
 */
function refinancePurpose(program, cashOut) {
  const takesCash = cashOut != null && cashOut > 0;
  if (program === 'VA') return takesCash ? 'VA cash-out - type II' : 'VA IRRRL';
  return takesCash ? 'Cash Out' : 'Rate/Term';
}

function money(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
