/**
 * Closing-cost estimation.
 *
 * The panel shows two figures: what gets quoted on the phone, and what the
 * borrower actually walks away with. The gap between them is this file, so
 * this file decides whether the second number is honest.
 *
 * Every figure is itemised rather than rolled into one percentage. A single
 * "2% of the loan" is easy to write and wrong in both directions — it
 * overstates a $700,000 refinance and understates a $150,000 one, because
 * most of these charges are flat. Itemising also means an agent can see
 * where the number came from and a manager can set the shop's real numbers
 * once, which is the only way the estimate gets genuinely accurate.
 *
 * The defaults are national mid-range figures for a cash-out refinance.
 * They are a starting point to be replaced with your own: title premiums
 * and recording fees in particular are set per state, and no default can
 * know yours. Every one of them is editable in Settings.
 *
 * One thing this model gets asked about more than anything else: why the
 * total looks smaller than the ten-to-thirty thousand a manager will quote
 * from memory. Two reasons, both now fixed. The upfront fee — VA funding
 * fee, FHA UFMIP — is a cost of closing even when it is financed, and it is
 * the largest single line on most of these files; it is computed in
 * equity.js and added back here by the caller, not lost. And escrows,
 * prepaid taxes and insurance, were left out of the first version of this
 * model on the grounds that the tax bill is not on a lead screen. That was
 * the wrong trade: a cost that always exists, silently omitted, makes every
 * quote flatter than the file. It is estimated from the property value now,
 * named on its own line, and marked as an estimate.
 *
 * Pure and DOM-free.
 */

import { round2 } from './money.js';

/**
 * Program-specific and general defaults.
 *
 * Sources for the program-specific parts:
 *   VA   — Lender's Handbook M26-7 chapter 8. The lender may charge a flat
 *          1% origination OR itemise, not both, and a list of charges
 *          (attorney, escrow, document prep) cannot be passed to the
 *          veteran at all. Modelled as the flat 1% with no separate
 *          underwriting fee, which is what most lenders do.
 *   TX   — Constitution Art. XVI §50(a)(6)(E) caps fees at 2% of the loan.
 *          The cap excludes the appraisal, the survey, the state base title
 *          premium and bona fide discount points, so only the rest counts
 *          toward it.
 */
export const DEFAULT_CLOSING_RULES = {
  /** Lender origination, as a share of the base loan. */
  originationPct: { VA: 0.01, FHA: 0.0075, CONV: 0.0075, USDA: 0.01 },

  /** Underwriting / processing, where it is charged separately. */
  underwritingFee: { VA: 0, FHA: 1095, CONV: 1095, USDA: 1095 },

  /** Appraisal. VA's are assigned by the regional loan centre and cost more. */
  appraisal: { VA: 800, FHA: 675, CONV: 650, USDA: 675 },

  creditReport: 75,
  floodCert: 20,

  /** Lender's title policy, as a share of the base loan (~$4 per $1,000). */
  titlePolicyPct: 0.004,
  titleSearch: 325,
  settlementFee: 650,
  recordingFees: 175,

  /**
   * Discount points, as a share of the loan. Zero by default because it is a
   * pricing choice rather than a cost of the file — but on a floor that buys
   * the rate down as a matter of course, one point on a $400,000 loan is
   * $4,000 and leaving it out understates the deal by that much.
   */
  discountPointsPct: 0,

  /**
   * State and local transfer, mortgage recording or intangible tax, as a
   * share of the loan.
   *
   * Zero by default because it cannot be guessed: several states charge
   * nothing on a refinance and several charge a great deal. New York's
   * mortgage recording tax runs to about 2% of the loan; Florida charges
   * documentary stamps plus an intangible tax; Virginia, Maryland, Delaware
   * and Tennessee all levy something. On a $400,000 loan the difference
   * between 0% and 2% is eight thousand dollars, so this is the first
   * setting to fill in for your state.
   */
  transferTaxPct: 0,

  /**
   * Prepaid interest: days of interest collected at closing. Fifteen is a
   * mid-month closing, which is the honest average when the date is unknown.
   */
  prepaidInterestDays: 15,
  /** Used for prepaid interest when no rate has been read or entered. */
  assumedRate: 0.065,

  /**
   * Escrow reserves.
   *
   * These were excluded in the first version of this model, on the grounds
   * that the tax bill and the closing date are not on a lead screen. That was
   * the wrong call: leaving out a cost that always exists made every quote
   * flatter than the file, which is the one direction this tool must not be
   * wrong in. A named estimate an agent can correct beats a silent zero.
   *
   * Estimated from the property value, because that is what is on screen.
   * Both rates are national averages and both are meant to be replaced with
   * your state's: effective property tax runs from roughly 0.3% in Hawaii to
   * 2.2% in New Jersey, so a single default cannot be right everywhere.
   */
  propertyTaxRate: 0.011,
  insuranceRate: 0.0035,
  escrowMonthsTaxes: 6,
  escrowMonthsInsurance: 3,

  /** A flat figure that replaces the estimate above when set. */
  escrowReserves: 0,

  /** Texas §50(a)(6) fee cap, as a share of the loan. */
  texasFeeCapPct: 0.02,
};

/** Charges that count toward the Texas 2% cap. */
const TEXAS_CAPPED = new Set([
  'origination', 'underwriting', 'creditReport', 'floodCert',
  'titleSearch', 'settlementFee', 'recordingFees',
]);
// Bona fide discount points, the appraisal, the survey, the state base title
// premium and government taxes are all outside the 2% cap.

/**
 * Estimate the closing costs on a cash-out refinance.
 *
 * @param {object} input
 * @param {string} input.program        VA | FHA | CONV | USDA
 * @param {string} input.state          Two-letter code, for the Texas cap
 * @param {number} input.baseLoan       Base loan amount
 * @param {number} input.totalLoan      Base plus any financed upfront fee
 * @param {number|null} input.propertyValue  For the escrow estimate
 * @param {number|null} input.rate      Note rate, as a decimal
 * @param {object} rules
 * @returns {{ total: number, items: Array, warnings: Array, texasCapApplied: boolean }}
 */
export function estimateClosingCosts({
  program = 'CONV',
  state = null,
  baseLoan = null,
  totalLoan = null,
  propertyValue = null,
  rate = null,
} = {}, rules = DEFAULT_CLOSING_RULES) {
  const r = { ...DEFAULT_CLOSING_RULES, ...(rules ?? {}) };
  const warnings = [];

  const base = positive(baseLoan);
  if (base == null) {
    return { total: 0, items: [], warnings, texasCapApplied: false };
  }
  const total = positive(totalLoan) ?? base;
  const key = program && r.appraisal[program] != null ? program : 'CONV';

  const items = [];
  const add = (id, label, amount, note) => {
    const value = round2(amount);
    if (value > 0) items.push({ id, label, amount: value, note });
  };

  const originationPct = pick(r.originationPct, key, 0);
  add('origination', 'Origination', base * originationPct,
    `${(originationPct * 100).toFixed(2).replace(/\.?0+$/, '')}% of the loan`);
  add('underwriting', 'Underwriting / processing', pick(r.underwritingFee, key, 0),
    key === 'VA' ? 'inside VA\'s 1% origination cap' : undefined);

  add('appraisal', 'Appraisal', pick(r.appraisal, key, 0),
    key === 'VA' ? 'VA-assigned appraiser' : undefined);
  add('creditReport', 'Credit report', r.creditReport);
  add('floodCert', 'Flood certification', r.floodCert);

  const points = r.discountPointsPct ?? 0;
  add('discountPoints', 'Discount points', base * points,
    points ? `${(points * 100).toFixed(3).replace(/\.?0+$/, '')}% of the loan` : undefined);

  add('titlePolicy', "Lender's title policy", base * (r.titlePolicyPct ?? 0),
    'varies by state — set yours in Settings');
  add('titleSearch', 'Title search / exam', r.titleSearch);
  add('settlementFee', 'Settlement / closing fee', r.settlementFee);
  add('recordingFees', 'Recording', r.recordingFees);

  const transfer = r.transferTaxPct ?? 0;
  add('transferTax', 'Transfer / mortgage tax', base * transfer,
    transfer ? `${(transfer * 100).toFixed(3).replace(/\.?0+$/, '')}% of the loan` : undefined);

  // Prepaid interest, on the loan the borrower is actually taking.
  const usedRate = positive(rate) ?? r.assumedRate;
  const days = r.prepaidInterestDays ?? 0;
  if (usedRate > 0 && days > 0) {
    add('prepaidInterest', 'Prepaid interest', (total * usedRate / 365) * days,
      `${days} days at ${(usedRate * 100).toFixed(3).replace(/\.?0+$/, '')}%`
        + (positive(rate) == null ? ', rate assumed' : ''));
  }

  // Escrows: a flat figure if one is configured, otherwise estimated from the
  // property value. Named separately so an agent who knows the real tax bill
  // can see exactly which line to argue with.
  const flatEscrow = positive(r.escrowReserves);
  const value = positive(propertyValue);

  if (flatEscrow) {
    add('escrowReserves', 'Escrow reserves', flatEscrow, 'flat figure from Settings');
  } else if (value) {
    const taxMonths = r.escrowMonthsTaxes ?? 0;
    const insMonths = r.escrowMonthsInsurance ?? 0;

    add('taxReserve', 'Property tax reserve', (value * (r.propertyTaxRate ?? 0) / 12) * taxMonths,
      `${taxMonths} months at ${(((r.propertyTaxRate ?? 0) * 100)).toFixed(2)}% of value a year`);
    add('insuranceReserve', 'Insurance reserve', (value * (r.insuranceRate ?? 0) / 12) * insMonths,
      `${insMonths} months at ${(((r.insuranceRate ?? 0) * 100)).toFixed(2)}% of value a year`);

    warnings.push({
      level: 'info',
      text: 'Escrow reserves are estimated from the property value, not from the '
        + 'actual tax bill or insurance premium. Set your state\'s rates in '
        + 'Settings, or enter the real figures once you have them.',
    });
  } else {
    warnings.push({
      level: 'warn',
      text: 'No property value, so escrow reserves are not included. Real cash '
        + 'to the borrower will be lower than shown.',
    });
  }

  if (!(r.transferTaxPct > 0)) {
    warnings.push({
      level: 'info',
      text: 'No state transfer or mortgage tax is set. Several states charge one '
        + 'on a refinance — New York\'s runs to about 2% of the loan — so check '
        + 'yours and set it in Settings.',
    });
  }

  let texasCapApplied = false;
  if (state === 'TX' && r.texasFeeCapPct > 0) {
    const cappable = items.filter((item) => TEXAS_CAPPED.has(item.id));
    const cappableTotal = cappable.reduce((sum, item) => sum + item.amount, 0);
    const cap = round2(base * r.texasFeeCapPct);

    if (cappableTotal > cap) {
      texasCapApplied = true;
      // Scale the capped items down proportionally: which fee gets cut is a
      // lender's decision, and the total is what moves the figure.
      const factor = cap / cappableTotal;
      for (const item of items) {
        if (!TEXAS_CAPPED.has(item.id)) continue;
        item.amount = round2(item.amount * factor);
        item.note = 'reduced by the Texas 2% fee cap';
      }
      warnings.push({
        level: 'info',
        text: `Texas §50(a)(6) caps fees at ${(r.texasFeeCapPct * 100).toFixed(0)}% of the loan, `
          + `so chargeable fees are held to ${fmt(cap)}.`,
      });
    }
  }

  return {
    total: round2(items.reduce((sum, item) => sum + item.amount, 0)),
    items,
    warnings,
    texasCapApplied,
  };
}

/** One line per charge, for the copied summary. */
export function closingCostText(estimate) {
  if (!estimate?.items?.length) return '';
  const width = Math.max(...estimate.items.map((i) => i.label.length)) + 2;
  const lines = estimate.items.map(
    (item) => `  ${(item.label + ':').padEnd(width)}${fmt(item.amount)}`,
  );
  lines.push(`  ${'Total:'.padEnd(width)}${fmt(estimate.total)}`);
  return lines.join('\n');
}

function pick(table, key, fallback) {
  const value = table?.[key];
  return Number.isFinite(value) ? value : fallback;
}

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmt(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
