/**
 * Front-end debt-to-income.
 *
 * The housing payment alone against gross monthly income. PITI — principal,
 * interest, taxes, insurance, plus mortgage insurance and any HOA — over
 * what the borrower earns in a month before deductions.
 *
 * Front-end only, deliberately. It is the cheap early answer: a borrower who
 * cannot carry the house by itself will not carry it with a car note behind
 * it, so a file that fails here is finished, and one that clears it is worth
 * the next question. Back-end needs a full liability picture that nobody has
 * thirty seconds into a call, and half a picture would read as a verdict.
 *
 * The payment is typed in rather than rebuilt here. Easy Qualifier has
 * already priced the loan and handed one back; producing a worse version of
 * a figure the pricing engine has already produced would be inventing a
 * disagreement with it.
 *
 * ---
 *
 * The limits, all settings, because a shop's overlays are its own and an AUS
 * approval routinely runs past the manual figures:
 *
 *   VA    35. VA has no hard ratio of its own — it underwrites to residual
 *         income — so this is the floor's working number.
 *   FHA   35. FHA's manual housing ratio is 31, stretching to 37 with two
 *         compensating factors; 35 sits between them.
 *   CONV  32. Conventional AUS runs no front-end test at all, so this is an
 *         overlay rather than an agency rule — the tightest of the three,
 *         and deliberately so.
 *   USDA  29, the published figure. Included because the programme is on the
 *         dropdown, not because this floor writes many.
 *
 * A null limit means the ratio is shown and no verdict is passed on it.
 *
 * Pure and DOM-free.
 */

export const DEFAULT_DTI_LIMITS = {
  VA: 0.35,
  FHA: 0.35,
  CONV: 0.32,
  USDA: 0.29,
};

/**
 * Below this, the income figure is almost certainly a yearly one typed into
 * a monthly box. Nobody is buying a house on a payment that is six per cent
 * of what they earn, and the error runs twelve times in the flattering
 * direction — the one that gets a file to underwriting and back.
 */
const IMPLAUSIBLY_LOW = 0.08;

/**
 * @param {object} input
 * @param {number|null} input.piti           the payment, from Easy Qualifier
 * @param {number|null} input.monthlyIncome  gross, per month
 * @param {string|null} input.program
 * @param {object} [limits]                  programme -> ratio, or null
 */
export function computeDti({
  piti = null, monthlyIncome = null, program = null,
} = {}, limits = DEFAULT_DTI_LIMITS) {
  const table = { ...DEFAULT_DTI_LIMITS, ...(limits ?? {}) };
  const key = program && table[program] !== undefined ? program : null;
  const limit = key ? table[key] : null;

  const payment = positive(piti);
  const income = positive(monthlyIncome);

  const missing = [];
  if (payment == null) missing.push('piti');
  if (income == null) missing.push('monthlyIncome');

  const warnings = [];
  const front = ratio(payment, income, limit);

  if (front.ratio != null && front.ratio < IMPLAUSIBLY_LOW) {
    warnings.push({
      level: 'warn',
      text: 'That income looks like a yearly figure in a monthly box — at this '
        + 'payment the ratio is implausibly low. Easy Qualifier wants gross '
        + 'monthly.',
    });
  }

  return {
    ok: missing.length === 0,
    missing,
    program: key,
    limit,
    front,
    // The payment that would clear the limit, so a failure comes with the
    // next sentence of the call rather than just a red number.
    maxPayment: maxPaymentFor({ monthlyIncome: income, limit }),
    warnings,
  };
}

/**
 * The ratio, judged against its limit.
 *
 * The comparison is made on the rounded percentage rather than the raw
 * quotient, so the figure on the panel is the figure that decided. A ratio
 * shown as 35.00% against a 35% ceiling has to read as a pass, or the panel
 * is arguing with itself in front of the borrower.
 */
function ratio(payment, income, limit) {
  if (payment == null || income == null) {
    return { ratio: null, percent: null, limit: limit ?? null, pass: null, headroom: null };
  }
  const rounded = Math.round((payment / income) * 10000) / 10000;
  return {
    ratio: rounded,
    percent: Math.round(rounded * 10000) / 100,
    limit: limit ?? null,
    pass: limit == null ? null : rounded <= limit,
    headroom: limit == null ? null : Math.round((limit - rounded) * 10000) / 100,
  };
}

/** The largest payment that still fits the limit. */
export function maxPaymentFor({ monthlyIncome, limit }) {
  const income = positive(monthlyIncome);
  if (income == null || !(limit > 0)) return null;
  return Math.round(income * limit * 100) / 100;
}

function positive(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
