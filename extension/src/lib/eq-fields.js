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
 *   assumed   a standing figure this method uses, stated so it can be argued
 *             with. The $1,000 insurance premium is the clearest case: it is
 *             a guess, it is inside the escrow line, and an agent should see
 *             it sitting there rather than discover it later.
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
 * @param {object|null} source.tax     { amount, year, source }
 * @param {object} source.rules        the sizing constants
 * @returns {Array<{key,eq,value,kind,note,required,missing,checkList}>}
 */
export function eqFields({
  application = {}, sizing = null, inputs = {}, tax = null, rules = {},
} = {}) {
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
  add('refinancePurpose', 'Refinance Purpose',
    cashOut != null && cashOut > 0 ? 'Cash Out' : 'Rate/Term',
    { kind: 'assumed', checkList: true });
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

  // --- third column
  add('monthlyDebt', 'Monthly Debt', money(app('monthlyDebt')));
  add('annualTaxes', 'Taxes (annual)', money(tax?.amount), {
    note: taxNote(tax),
  });
  add('annualInsurance', 'Homeowners Insurance (annual)',
    money(rules.insuranceAllowance ?? 1000),
    { kind: 'assumed', note: 'the flat allowance inside the escrow line' });
  add('employment', 'Employment Options', app('employment'), { checkList: true });

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

/** Where the tax bill came from, in the words an agent would use. */
function taxNote(tax) {
  if (tax?.source === 'typed') return 'entered by hand';
  if (tax?.amount == null) return 'not read yet';
  return [tax.year, `from ${tax.source ?? 'Zillow'}`].filter(Boolean).join(', ');
}

function money(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
