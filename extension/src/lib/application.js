/**
 * The application form.
 *
 * A fixed set of fields, each pre-filled from whatever S.A.M already knows
 * about the record, and each editable. Pure and DOM-free so the fill rules
 * and the save threshold can be tested directly.
 *
 * The field list is deliberately closed. An application an agent completes
 * mid-call is only useful if it is short enough to finish while talking, so
 * this captures the figures that decide whether a file is worth opening and
 * nothing else.
 */

import { parseMoney, parsePercent, formatMoney, formatPercent } from './money.js';
import { joinName } from './names.js';

/**
 * `from` names where the value comes from automatically:
 *   an input key      — a field S.A.M detected or the agent typed
 *   'result.<name>'   — a figure the calculator produced
 *   'address'         — the assembled one-line address
 * A field with no `from` is only ever filled by hand.
 */
export const APPLICATION_FIELDS = [
  { key: 'fullName',   label: 'Full name',       kind: 'text',    from: 'name' },
  { key: 'rate',       label: 'Rate',            kind: 'percent', from: 'interestRate' },
  { key: 'balance',    label: 'Mortgage balance', kind: 'money',  from: 'firstLien' },
  { key: 'fico',       label: 'FICO',            kind: 'number',  from: 'fico' },
  { key: 'cashOut',    label: 'Cash-out',        kind: 'money',   hintFrom: 'result.estimatedCashToBorrower' },
  { key: 'value',      label: 'Value',           kind: 'money',   from: 'propertyValue' },
  { key: 'payment',    label: 'Monthly payment', kind: 'money',   from: 'payment' },
  { key: 'income',     label: 'Income',          kind: 'money' },
  { key: 'employment', label: 'W2 / 1099',       kind: 'choice',  options: ['W2', '1099', 'Both'] },
  { key: 'loanType',   label: 'Loan type',       kind: 'choice',  options: ['VA', 'FHA', 'CONV', 'USDA'], from: 'program' },
  { key: 'disability', label: 'Disability %',    kind: 'percent' },
  { key: 'address',    label: 'Address',         kind: 'text',    from: 'address' },
  { key: 'phone',      label: 'Number',          kind: 'text',    from: 'phone' },
];

export const APPLICATION_KEYS = APPLICATION_FIELDS.map((f) => f.key);

/**
 * The co-borrower.
 *
 * Only the fields that actually differ per person are here. Rate, balance,
 * value, payment and loan type belong to the property and the loan, not to
 * a borrower, so repeating them would invite two answers to one question.
 *
 * Every one of these is entered by hand. Nothing about a second borrower
 * appears anywhere on a lead screen, and inventing a source for them would
 * be worse than an empty field.
 */
export const CO_BORROWER_FIELDS = [
  { key: 'coFullName',   label: 'Full name',    kind: 'text' },
  { key: 'coFico',       label: 'FICO',         kind: 'number' },
  { key: 'coIncome',     label: 'Income',       kind: 'money' },
  { key: 'coEmployment', label: 'W2 / 1099',    kind: 'choice', options: ['W2', '1099', 'Both'] },
  { key: 'coDisability', label: 'Disability %', kind: 'percent' },
  { key: 'coPhone',      label: 'Number',       kind: 'text' },
];

export const CO_BORROWER_KEYS = CO_BORROWER_FIELDS.map((f) => f.key);

/** Fields that must be filled before an application is worth keeping. */
export const SAVE_THRESHOLD = 3;

/**
 * Build the form's current state.
 *
 * Anything the agent typed wins; everything else is pulled from the record.
 * Each field reports where its value came from so the UI can show what was
 * filled automatically and what a human entered.
 */
export function buildApplication({
  inputs = {}, result = null, manual = {}, address = '', coBorrower = false,
} = {}) {
  const out = {};

  const fields = coBorrower
    ? [...APPLICATION_FIELDS, ...CO_BORROWER_FIELDS]
    : APPLICATION_FIELDS;

  for (const field of fields) {
    const typed = manual[field.key];

    if (typed != null) {
      out[field.key] = { value: String(typed), source: 'manual' };
      continue;
    }

    const value = autoValue(field, inputs, result, address);
    out[field.key] = {
      value,
      source: value ? 'auto' : 'none',
      placeholder: hintFor(field, result),
      // A figure read off the page that sits outside a sane range for its
      // field. Shown, because hiding it would hide a data problem, but never
      // presented as trustworthy.
      suspect: !!(value && field.from && inputs[field.from]?.implausible),
    };
  }

  return out;
}

/**
 * Guidance shown in an empty field without filling it.
 *
 * Cash-out is the case that matters. The calculator's headline is the
 * *maximum* the equity supports, and pre-filling the application with it
 * would record a request nobody made — most borrowers take a fraction of
 * what is available. The ceiling is worth showing, so it is offered as a
 * prompt the agent can ignore rather than a value they must correct.
 */
function hintFor(field, result) {
  if (!field.hintFrom) return '';
  if (!field.hintFrom.startsWith('result.')) return '';
  const raw = result?.[field.hintFrom.slice('result.'.length)];
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return '';
  return `up to ${formatMoney(raw)}`;
}

const trim = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function autoValue(field, inputs, result, address) {
  if (!field.from) return '';

  if (field.from === 'address') return address ?? '';

  // One box for the name. Most lead screens hold it as First and Last, some
  // hold it whole, and this fills from whichever the screen actually has.
  // Salesforce splits it apart again on the way out.
  //
  // The parts win when the screen carries both, since they are unambiguous
  // about which half is the surname. A lone half loses to a combined field:
  // "ROLLINS" on an application is worse than "RANDY D ROLLINS".
  if (field.from === 'name') {
    const first = trim(inputs.firstName?.value);
    const last = trim(inputs.lastName?.value);
    const whole = trim(inputs.fullName?.value);

    // A field the agent bound by clicking it outranks anything guessed. They
    // pointed at the name on their own screen; there is nothing to weigh
    // that against.
    if (whole && inputs.fullName?.source === 'bound') return whole;

    if (first && last) return joinName({ first, last });
    if (whole) return whole;
    return joinName({ first, last });
  }

  const input = inputs[field.from];
  if (!input) return '';

  // Loan type is stored canonically so it round-trips through the dropdown.
  if (field.key === 'loanType') return input.normalized ?? '';

  const raw = String(input.value ?? '').trim();
  if (!raw) return '';

  if (field.kind === 'money') {
    const n = input.num ?? parseMoney(raw);
    return n == null ? raw : formatMoney(n);
  }
  if (field.kind === 'percent') {
    const rate = parsePercent(raw);
    return rate == null ? raw : formatPercent(rate, 3).replace(/\.?0+%$/, '%');
  }
  return raw;
}

/** Every key present on an application, co-borrower included. */
function keysOf(application) {
  return Object.keys(application ?? {});
}

/** How many fields carry a value. */
export function filledCount(application) {
  return keysOf(application).reduce(
    (n, key) => n + (String(application[key]?.value ?? '').trim() ? 1 : 0),
    0,
  );
}

/**
 * Whether this application is worth offering to save.
 *
 * The threshold exists so a record the agent merely looked at does not become
 * a saved file. Fields that arrive purely from the lead itself are not enough
 * on their own — otherwise every call would clear the bar without anyone
 * having done anything — so at least one entry has to be the agent's.
 */
export function isWorthSaving(application) {
  if (!application) return false;
  if (filledCount(application) < SAVE_THRESHOLD) return false;
  return keysOf(application).some((key) => {
    const field = application[key];
    return field?.source === 'manual' && String(field.value ?? '').trim() !== '';
  });
}

/**
 * A VA funding fee is waived for a veteran receiving compensation for a
 * service-connected disability, so a disability rating entered on the form
 * feeds straight back into the calculation.
 */
export function impliesFeeExemption(application) {
  // The exemption follows the veteran, and the veteran may be either
  // borrower, so a rating on the co-borrower counts just the same.
  return ['disability', 'coDisability'].some((key) => {
    const raw = application?.[key]?.value;
    if (raw == null || String(raw).trim() === '') return false;
    const rate = parsePercent(raw);
    return rate != null && rate >= 0.10;
  });
}

/** Flatten to plain values for storage or the clipboard. */
export function toPlain(application) {
  const out = {};
  for (const field of [...APPLICATION_FIELDS, ...CO_BORROWER_FIELDS]) {
    if (!(field.key in (application ?? {}))) continue;
    out[field.key] = String(application[field.key]?.value ?? '').trim();
  }
  return out;
}

/** A readable block for pasting into a CRM or an email. */
export function toText(application, { heading = '' } = {}) {
  const width = Math.max(...APPLICATION_FIELDS.map((f) => f.label.length)) + 2;
  const lines = heading ? [heading, ''] : [];

  for (const field of APPLICATION_FIELDS) {
    const value = String(application?.[field.key]?.value ?? '').trim();
    lines.push(`${(field.label + ':').padEnd(width)}${value || '—'}`);
  }

  const hasCoBorrower = CO_BORROWER_KEYS.some((key) => key in (application ?? {}));
  if (hasCoBorrower) {
    lines.push('', 'CO-BORROWER', '');
    for (const field of CO_BORROWER_FIELDS) {
      const value = String(application?.[field.key]?.value ?? '').trim();
      lines.push(`${(field.label + ':').padEnd(width)}${value || '—'}`);
    }
  }

  return lines.join('\n');
}
