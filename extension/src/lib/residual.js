/**
 * VA take-home and residual income.
 *
 * This is the one VA rule that decides files the LTV maths says are fine.
 * VA does not underwrite on debt-to-income alone — it requires a minimum
 * amount of money left in the borrower's pocket after taxes, every monthly
 * obligation, the proposed housing payment, and the cost of running the
 * house. Below that line the loan does not go, whatever the equity says.
 *
 * Source: VA Pamphlet 26-7 (Lenders Handbook), Chapter 4, Topic 9 — "Table
 * of Residual Incomes by Region". The figures below are the published
 * tables, which have not moved in a long time. They are constants here so
 * they can be checked against the handbook rather than reverse-engineered
 * out of a spreadsheet.
 *
 * The order of operations is VA's own:
 *
 *     take-home   = gross monthly income − taxes
 *     residual    = take-home − monthly debts − housing payment
 *                             − maintenance & utilities
 *
 * "Take-home" is exactly what an agent means by it: what actually lands in
 * the account each month. Residual is what is still there once the new
 * mortgage is paid.
 *
 * Pure and DOM-free.
 */

/** VA's four regions, by state. */
export const VA_REGIONS = {
  northeast: ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  midwest: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
  south: ['AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK',
    'PR', 'SC', 'TN', 'TX', 'VA', 'WV'],
  west: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY'],
};

export const REGION_LABELS = {
  northeast: 'Northeast',
  midwest: 'Midwest',
  south: 'South',
  west: 'West',
};

/**
 * Residual income required, by region and family size.
 *
 * Two tiers: loans under $80,000 and loans of $80,000 or more. A cash-out
 * refinance on a floor like this is essentially always the upper tier, but
 * both are here because getting the cheap case wrong to save a table is not
 * a trade worth making.
 */
export const RESIDUAL_TABLE = {
  under80k: {
    northeast: [390, 654, 788, 888, 921],
    midwest: [382, 641, 772, 868, 902],
    south: [382, 641, 772, 868, 902],
    west: [425, 713, 859, 967, 1004],
  },
  from80k: {
    northeast: [450, 755, 909, 1025, 1062],
    midwest: [441, 738, 889, 1003, 1039],
    south: [441, 738, 889, 1003, 1039],
    west: [491, 823, 990, 1117, 1158],
  },
};

/** Each family member beyond five adds this much, up to a family of seven. */
const PER_EXTRA_MEMBER = { under80k: 75, from80k: 80 };
const MAX_TABLE_FAMILY = 7;

/**
 * Maintenance and utilities, per square foot of living area, per month.
 * VA's own figure, and it is included in the residual calculation.
 */
export const MAINTENANCE_PER_SQFT = 0.14;

/** Withholding assumed when nobody has said otherwise. */
export const DEFAULT_TAX_RATE = 0.22;

/**
 * The DTI at which VA wants more cushion. Above it, the residual figure has
 * to clear the table by 20% rather than merely reach it.
 */
export const DTI_BENCHMARK = 0.41;
const HIGH_DTI_MULTIPLIER = 1.2;

/** Which VA region a state sits in, or null if the state is unknown. */
export function vaRegion(state) {
  const code = String(state ?? '').trim().toUpperCase();
  if (!code) return null;
  for (const [region, states] of Object.entries(VA_REGIONS)) {
    if (states.includes(code)) return region;
  }
  return null;
}

/**
 * The residual income VA requires for this borrower.
 *
 * @returns {{ required: number, region: string, regionLabel: string,
 *             tier: string, familySize: number }|null}
 */
export function residualRequirement({ state, familySize = 1, loanAmount = null } = {}) {
  const region = vaRegion(state);
  if (!region) return null;

  const tier = loanAmount != null && loanAmount < 80000 ? 'under80k' : 'from80k';
  const size = clampFamily(familySize);
  const table = RESIDUAL_TABLE[tier][region];

  // Five is the last row in the table; beyond it VA adds a flat amount per
  // member, and stops adding at seven.
  const base = table[Math.min(size, 5) - 1];
  const extra = Math.max(0, Math.min(size, MAX_TABLE_FAMILY) - 5) * PER_EXTRA_MEMBER[tier];

  return {
    required: base + extra,
    region,
    regionLabel: REGION_LABELS[region],
    tier,
    familySize: size,
    // Said plainly, because a family of nine is charged as a family of seven
    // and an agent should not have to work that out from a number.
    cappedFamily: familySize > MAX_TABLE_FAMILY,
  };
}

function clampFamily(n) {
  const size = Math.floor(Number(n));
  if (!Number.isFinite(size) || size < 1) return 1;
  return Math.min(size, 12);
}

/**
 * Work out take-home pay and what is left after the new loan.
 *
 * Everything is optional. The point of the panel is that it says what it can
 * with what it has rather than waiting for a complete picture — take-home
 * needs only an income, and each further figure sharpens the answer.
 *
 * @returns {{
 *   grossMonthly: number|null, tax: number|null, takeHome: number|null,
 *   maintenance: number, residual: number|null, required: number|null,
 *   requirement: object|null, meets: boolean|null, dti: number|null,
 *   highDti: boolean, shortfall: number|null, warnings: Array
 * }}
 */
export function computeTakeHome({
  grossMonthly = null,
  taxRate = DEFAULT_TAX_RATE,
  monthlyDebts = null,
  housingPayment = null,
  squareFeet = null,
  state = null,
  familySize = 1,
  loanAmount = null,
} = {}) {
  const warnings = [];

  const gross = positive(grossMonthly);
  const rate = Number.isFinite(taxRate) && taxRate >= 0 && taxRate < 1 ? taxRate : DEFAULT_TAX_RATE;

  const tax = gross == null ? null : round2(gross * rate);
  const takeHome = gross == null ? null : round2(gross - tax);

  const debts = positive(monthlyDebts) ?? 0;
  const housing = positive(housingPayment);
  const sqft = positive(squareFeet);

  // VA includes the cost of running the house, not just the note on it.
  const maintenance = sqft == null ? 0 : round2(sqft * MAINTENANCE_PER_SQFT);
  if (sqft == null && takeHome != null && housing != null) {
    warnings.push({
      level: 'info',
      text: 'Square footage not entered, so VA\'s maintenance and utilities figure '
        + `(${MAINTENANCE_PER_SQFT.toFixed(2)} per sq ft) is not included. The real residual is lower.`,
    });
  }

  const requirement = residualRequirement({ state, familySize, loanAmount });
  if (!requirement && state) {
    warnings.push({
      level: 'warn',
      text: `No VA region for "${state}", so no residual minimum is applied.`,
    });
  }

  // Residual needs the housing payment; without it there is nothing to
  // subtract and a figure would just be take-home wearing another label.
  const residual = takeHome == null || housing == null
    ? null
    : round2(takeHome - debts - housing - maintenance);

  const dti = gross == null || housing == null ? null : round4((housing + debts) / gross);
  const highDti = dti != null && dti > DTI_BENCHMARK;

  let required = requirement?.required ?? null;
  if (required != null && highDti) {
    required = round2(required * HIGH_DTI_MULTIPLIER);
    warnings.push({
      level: 'warn',
      text: `DTI is above ${Math.round(DTI_BENCHMARK * 100)}%, so VA wants residual income `
        + '20% above the table figure.',
    });
  }

  const meets = residual == null || required == null ? null : residual >= required;
  const shortfall = meets === false ? round2(required - residual) : null;

  if (requirement?.cappedFamily) {
    warnings.push({
      level: 'info',
      text: 'VA\'s table stops at a family of seven; larger households use the same figure.',
    });
  }

  return {
    grossMonthly: gross,
    taxRate: rate,
    tax,
    takeHome,
    monthlyDebts: debts,
    housingPayment: housing,
    maintenance,
    residual,
    required,
    requirement,
    meets,
    dti,
    highDti,
    shortfall,
    warnings,
  };
}

/** Annual pay to monthly, for the income an agent has already entered. */
export function monthlyFromAnnual(annual) {
  const n = positive(annual);
  return n == null ? null : round2(n / 12);
}

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}
