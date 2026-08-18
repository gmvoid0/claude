/**
 * The application, as a document.
 *
 * What an agent does with a completed application is hand it to somebody —
 * a loan officer, a processor, a folder. Until now the only ways out were
 * the clipboard and the Salesforce handoff, and neither survives being
 * emailed or attached to a file.
 *
 * So Save writes a PDF: the same figures in the same order as the panel,
 * laid out to be read across a desk rather than scrolled. Nothing here is
 * derived independently — every number comes from the calculation that is
 * already on screen, so the sheet and the panel cannot disagree.
 *
 * Pure: builds a document description, which lib/document.js renders.
 */

import { APPLICATION_FIELDS, CO_BORROWER_FIELDS } from './application.js';
import { formatMoney, formatPercent, parseMoney, parsePercent } from './money.js';

/** Fields that belong to the borrower rather than the deal. */
const BORROWER_KEYS = ['fullName', 'phone', 'address', 'fico', 'income', 'employment', 'disability'];

/** Fields describing the property and the existing loan. */
const LOAN_KEYS = ['value', 'balance', 'loanType', 'rate', 'payment', 'cashOut'];

const FIELDS = Object.fromEntries(
  [...APPLICATION_FIELDS, ...CO_BORROWER_FIELDS].map((f) => [f.key, f]),
);

const LABELS = Object.fromEntries(
  Object.entries(FIELDS).map(([key, field]) => [key, field.label]),
);

/**
 * Present a figure the way the rest of the sheet presents figures.
 *
 * What the agent typed is stored exactly as they typed it, which is right on
 * screen and wrong here: a bare 96000 sitting under $270,900 reads as two
 * different kinds of number. Formatting is applied only when the text parses
 * cleanly, so anything with a note attached to it — "96000/yr", "approx 4k" —
 * is left exactly as written rather than quietly reinterpreted.
 */
function present(key, raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';

  const kind = FIELDS[key]?.kind;
  if (kind === 'money') {
    const amount = parseMoney(text);
    return amount == null ? text : formatMoney(amount);
  }
  if (kind === 'percent') {
    const rate = parsePercent(text);
    return rate == null ? text : formatPercent(rate, rate * 100 % 1 === 0 ? 0 : 2);
  }
  return text;
}

/**
 * @param {object} input
 * @param {object} input.application  the built application
 * @param {object} input.result       the equity calculation behind it
 * @param {string} input.recordLabel  who this is
 * @param {boolean} input.coBorrower  whether the second borrower is in play
 * @param {Date}   [input.now]
 */
export function buildApplicationDocument({
  application = {},
  result = null,
  recordLabel = '',
  coBorrower = false,
  now = new Date(),
} = {}) {
  const value = (key) => present(key, application?.[key]?.value);
  const blocks = [];

  // The two headline figures, in the order the panel shows them.
  if (result?.advertisedCashOut != null || result?.estimatedCashToBorrower != null) {
    const red = result?.meetsThreshold === false;
    blocks.push({
      type: 'figures',
      items: [
        {
          cap: 'Advertised',
          value: formatMoney(result?.advertisedCashOut),
          sub: 'before fees & costs',
          tone: red ? 'red' : 'blue',
        },
        {
          cap: 'Take-home',
          value: formatMoney(result?.estimatedCashToBorrower),
          sub: 'after fees & costs',
          tone: red ? 'red' : 'green',
        },
      ],
    });
  }

  blocks.push({ type: 'heading', text: 'Borrower' });
  for (const key of BORROWER_KEYS) {
    blocks.push({
      type: 'row',
      label: LABELS[key] ?? key,
      value: value(key),
      strong: key === 'fullName',
    });
  }

  if (coBorrower && CO_BORROWER_FIELDS.some((f) => value(f.key))) {
    blocks.push({ type: 'heading', text: 'Co-borrower' });
    for (const field of CO_BORROWER_FIELDS) {
      blocks.push({ type: 'row', label: field.label, value: value(field.key) });
    }
  }

  blocks.push({ type: 'heading', text: 'Property & existing loan' });
  for (const key of LOAN_KEYS) {
    const entry = application?.[key];
    blocks.push({
      type: 'row',
      label: LABELS[key] ?? key,
      value: value(key),
      // Cash-out is the borrower's request, and it is often left blank on
      // purpose. Carrying the ceiling across as a note keeps the sheet
      // honest about which is which.
      note: key === 'cashOut' && !value(key) && entry?.placeholder ? entry.placeholder : undefined,
    });
  }

  if (result?.ok) blocks.push(...calculationBlocks(result));

  const warnings = (result?.warnings ?? []).filter((w) => w.level !== 'info');
  if (warnings.length) {
    blocks.push({ type: 'heading', text: 'Flags' });
    for (const warning of warnings) {
      blocks.push({ type: 'callout', text: warning.text, tone: 'amber' });
    }
  }

  return {
    title: 'Loan application',
    subtitle: recordLabel || value('fullName') || 'Unnamed record',
    meta: `Prepared ${formatDate(now)} · S.A.M — Sales Assistance in Mortgages`,
    footer: 'Estimate only — not a quote, an offer, or a commitment to lend. '
      + 'Figures are screening estimates and the appraisal governs value.',
    blocks,
  };
}

/** The calculation, and where the gap between the two figures went. */
function calculationBlocks(result) {
  const blocks = [{ type: 'heading', text: 'Calculation' }];

  const rows = [
    ['Program', result.programLabel ?? result.program],
    ['Max LTV', result.maxLtv != null ? formatPercent(result.maxLtv, 0) : '', result.ltvSource],
    ['Current LTV', result.currentLtv != null ? formatPercent(result.currentLtv, 1) : ''],
    ['Home value', formatMoney(result.propertyValue)],
    ['Total liens', formatMoney(result.totalLiens)],
    ['Gross equity', formatMoney(result.grossEquity)],
    ['Max base loan', formatMoney(result.maxBaseLoan)],
  ];

  if (result.financedFee) {
    rows.push([result.feeLabel ?? 'Upfront fee', formatMoney(result.financedFee), 'financed into the loan']);
  }
  if (result.unfinancedFee) {
    rows.push([result.feeLabel ?? 'Upfront fee', formatMoney(result.unfinancedFee), 'due at closing']);
  }
  rows.push(['Total loan', formatMoney(result.totalLoanAmount)]);
  rows.push(['Closing costs', formatMoney(result.closingCosts), costsNote(result)]);

  for (const [label, value, note] of rows) {
    blocks.push({ type: 'row', label, value, note });
  }

  const items = result.closingEstimate?.items ?? [];
  if (items.length) {
    blocks.push({ type: 'heading', text: 'Closing costs, estimated' });
    for (const item of items) {
      blocks.push({ type: 'row', label: item.label, value: formatMoney(item.amount), note: item.note });
    }
    for (const warning of result.closingEstimate.warnings ?? []) {
      blocks.push({ type: 'note', text: warning.text });
    }
  }

  return blocks;
}

function costsNote(result) {
  if (result.closingEstimate?.typed) return 'entered by hand';
  return result.closingEstimate?.items?.length ? 'estimated, itemised below' : undefined;
}

function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A filename that sorts by date and says who it belongs to. */
export function applicationFilename({ recordLabel = '', application = {}, now = new Date() } = {}) {
  const name = String(application?.fullName?.value || recordLabel || 'application')
    .split('—')[0]
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'application';

  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `SAM-${name}-${stamp}.pdf`;
}
