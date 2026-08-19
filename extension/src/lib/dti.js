/**
 * Debt-to-income, front and back.
 *
 * Two ratios, and the difference is the whole point:
 *
 *   front-end   the housing payment alone against gross monthly income.
 *               PITI — principal, interest, taxes, insurance, plus mortgage
 *               insurance and any HOA. This is the figure Easy Qualifier
 *               hands back, so it is typed in rather than rebuilt here:
 *               guessing at a payment when the pricing engine has already
 *               produced one would be inventing a worse version of it.
 *
 *   back-end    that same housing payment plus every other monthly
 *               obligation — cards, autos, student loans, support orders.
 *
 * Front-end is always shown even where the programme does not underwrite to
 * it, because it is the cheap early answer: a borrower who cannot carry the
 * house alone will not carry the house plus a car note, and knowing that
 * thirty seconds into a call is worth more than knowing it after a pull.
 *
 * ---
 *
 * The limits, and where they come from. Every one is a setting, because a
 * shop's overlays are its own and an AUS approval routinely runs past the
 * manual figures below.
 *
 *   VA    35 / 45. VA has no hard ratio of its own — it underwrites to
 *         residual income, with 41% back-end as the guideline that triggers
 *         a closer look. 35/45 is this floor's working pair.
 *
 *   FHA   35 / 47. FHA's manual limits are 31/43, rising to 37/47 with two
 *         compensating factors; 47 is that stretched back-end, and 35 is
 *         where this floor holds the housing ratio.
 *
 *   CONV  32 / 45. Fannie Mae's standard back-end ceiling, with DU going to
 *         50 on strong reserves and credit. Conventional AUS runs no
 *         front-end test of its own, so 32 is an overlay rather than an
 *         agency rule — the tightest of the three, and deliberately so.
 *
 *   USDA  29 / 41, the published pair. Included because the programme is on
 *         the dropdown, not because this floor writes many.
 *
 * A null limit means "not tested on this programme". The ratio is still
 * shown; it just carries no verdict.
 *
 * Pure and DOM-free.
 */

export const DEFAULT_DTI_LIMITS = {
  VA: { front: 0.35, back: 0.45 },
  FHA: { front: 0.35, back: 0.47 },
  CONV: { front: 0.32, back: 0.45 },
  USDA: { front: 0.29, back: 0.41 },
};

/**
 * Below this, the income figure is almost certainly a yearly one typed into
 * a monthly box. Nobody is buying a house on a payment that is six per cent
 * of what they earn, and the error runs twelve times in the flattering
 * direction, which is the one that gets a file to underwriting and back.
 */
const IMPLAUSIBLY_LOW_FRONT = 0.08;

/**
 * @param {object} input
 * @param {number|null} input.piti           the payment, from Easy Qualifier
 * @param {number|null} input.monthlyIncome  gross, per month
 * @param {number|null} input.monthlyDebts   everything else; null is unknown,
 *                                           0 is "none", and they differ
 * @param {string|null} input.program
 * @param {object} [limits]
 */
export function computeDti({
  piti = null, monthlyIncome = null, monthlyDebts = null, program = null,
} = {}, limits = DEFAULT_DTI_LIMITS) {
  const table = { ...DEFAULT_DTI_LIMITS, ...(limits ?? {}) };
  const key = program && table[program] ? program : null;
  const limit = key ? table[key] : { front: null, back: null };

  const payment = positive(piti);
  const income = positive(monthlyIncome);
  const debts = nonNegative(monthlyDebts);

  const missing = [];
  if (payment == null) missing.push('piti');
  if (income == null) missing.push('monthlyIncome');

  const warnings = [];
  const front = ratio(payment, income, limit.front);
  const back = debts == null
    ? blank(limit.back)
    : ratio(payment == null ? null : payment + debts, income, limit.back);

  if (front.ratio != null && front.ratio < IMPLAUSIBLY_LOW_FRONT) {
    warnings.push({
      level: 'warn',
      text: 'That income looks like a yearly figure in a monthly box — at this '
        + 'payment the ratio is implausibly low. Easy Qualifier wants gross '
        + 'monthly.',
    });
  }
  if (payment != null && income != null && debts == null) {
    warnings.push({
      level: 'info',
      text: 'No monthly debts entered, so there is no back-end ratio. Enter 0 '
        + 'if there genuinely are none.',
    });
  }

  return {
    ok: missing.length === 0,
    missing,
    program: key,
    limits: limit,
    front,
    back,
    warnings,
  };
}

/**
 * One ratio, judged against its limit.
 *
 * The comparison is made on the rounded percentage rather than the raw
 * quotient, so the figure on the panel is the figure that decided. A ratio
 * shown as 45.00% against a 45% ceiling has to read as a pass, or the panel
 * is arguing with itself in front of the borrower.
 */
function ratio(numerator, income, limit) {
  if (numerator == null || income == null) return blank(limit);
  const raw = numerator / income;
  const rounded = Math.round(raw * 10000) / 10000;
  return {
    ratio: rounded,
    percent: Math.round(raw * 10000) / 100,
    limit: limit ?? null,
    pass: limit == null ? null : rounded <= limit,
    headroom: limit == null ? null : Math.round((limit - rounded) * 10000) / 100,
  };
}

const blank = (limit) => ({
  ratio: null, percent: null, limit: limit ?? null, pass: null, headroom: null,
});

/** The largest payment that still fits a limit, for "what would qualify". */
export function maxPaymentFor({ monthlyIncome, monthlyDebts = 0, limit }) {
  const income = positive(monthlyIncome);
  const debts = nonNegative(monthlyDebts) ?? 0;
  if (income == null || !(limit > 0)) return null;
  return Math.max(0, Math.round((income * limit - debts) * 100) / 100);
}

function positive(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegative(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
