/**
 * Program rules: LTV caps, upfront fees, and loan-type normalization.
 *
 * IMPORTANT: these are defaults that encode the commonly-used agency maximums.
 * Investor/lender overlays are frequently *tighter*. Everything here is
 * overridable from the extension's Options page — treat these values as a
 * starting point to be confirmed against your own matrix, not as gospel.
 *
 * Last reviewed against published agency guidance: see README "Rule sources".
 */

/** Canonical program identifiers. */
export const PROGRAMS = ['VA', 'FHA', 'CONV', 'USDA'];

/**
 * Raw strings seen in lead data, mapped to a canonical program.
 * Keys are compared case-insensitively against a normalized (letters-only) form.
 */
const PROGRAM_ALIASES = new Map(Object.entries({
  VA: 'VA',
  VALOAN: 'VA',
  VETERAN: 'VA',
  VETERANS: 'VA',
  VAIRRRL: 'VA',
  IRRRL: 'VA',

  FHA: 'FHA',
  FHALOAN: 'FHA',
  GOVT: 'FHA',
  GOVERNMENT: 'FHA',

  CV: 'CONV',
  CONV: 'CONV',
  CONVENTIONAL: 'CONV',
  CONF: 'CONV',
  CONFORMING: 'CONV',
  FANNIE: 'CONV',
  FREDDIE: 'CONV',
  FNMA: 'CONV',
  FHLMC: 'CONV',
  JUMBO: 'CONV',

  USDA: 'USDA',
  RD: 'USDA',
  RURAL: 'USDA',
  RHS: 'USDA',
}));

/**
 * Normalize a free-text loan type into a canonical program id.
 * Returns null when it can't be determined.
 */
export function normalizeProgram(raw) {
  if (!raw) return null;
  const key = String(raw).toUpperCase().replace(/[^A-Z]/g, '');
  if (!key) return null;
  if (PROGRAM_ALIASES.has(key)) return PROGRAM_ALIASES.get(key);

  // Fall back to substring probing, longest alias first so CONVENTIONAL wins
  // over CONV and VALOAN isn't matched by a stray "VA" inside another word.
  const aliases = [...PROGRAM_ALIASES.keys()].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (alias.length >= 3 && key.includes(alias)) return PROGRAM_ALIASES.get(alias);
  }
  if (/^VA/.test(key)) return 'VA';
  return null;
}

/** Two-letter state code from a state field that may hold a full name. */
const STATE_NAMES = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA',
  COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA',
  HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA',
  KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
  MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  NEWHAMPSHIRE: 'NH', NEWJERSEY: 'NJ', NEWMEXICO: 'NM', NEWYORK: 'NY',
  NORTHCAROLINA: 'NC', NORTHDAKOTA: 'ND', OHIO: 'OH', OKLAHOMA: 'OK',
  OREGON: 'OR', PENNSYLVANIA: 'PA', RHODEISLAND: 'RI', SOUTHCAROLINA: 'SC',
  SOUTHDAKOTA: 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
  VIRGINIA: 'VA', WASHINGTON: 'WA', WESTVIRGINIA: 'WV', WISCONSIN: 'WI',
  WYOMING: 'WY', DISTRICTOFCOLUMBIA: 'DC', PUERTORICO: 'PR',
};

const STATE_CODES = new Set(Object.values(STATE_NAMES));

/**
 * Normalize a state field to a 2-letter code, or null.
 *
 * Note the deliberate ordering: "VA" as a *state* value is Virginia, and this
 * function is only ever called on a state field, so the 2-letter check runs
 * first and Virginia wins. Loan type is normalized separately.
 */
export function normalizeState(raw) {
  if (!raw) return null;
  const s = String(raw).toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return null;
  if (s.length === 2 && STATE_CODES.has(s)) return s;
  if (STATE_NAMES[s]) return STATE_NAMES[s];
  return null;
}

/**
 * Default LTV matrix for a cash-out refinance on an owner-occupied 1-unit.
 *
 * `maxLtv`       — cap applied to the base loan amount, as a decimal.
 * `stateOverrides` — per-state caps that replace maxLtv.
 * `upfrontFeeRate` — financed upfront fee (VA funding fee / FHA UFMIP).
 * `feeInsideCap` — true when the cap applies to base loan + financed fee
 *                  (VA: total loan may not exceed 100% of value);
 *                  false when the fee is added on top of the capped base
 *                  loan (FHA: UFMIP sits above the 80% base).
 */
export const DEFAULT_RULES = {
  version: 3,
  purpose: 'cashout',
  programs: {
    VA: {
      label: 'VA cash-out',
      maxLtv: 1.0,
      stateOverrides: { TX: 0.8 },
      upfrontFeeRate: 0.0215,        // funding fee, first use, cash-out
      upfrontFeeRateSubsequent: 0.033,
      feeInsideCap: true,
      feeLabel: 'VA funding fee',
      notes: [
        'VA cash-out is capped at 100% of the reasonable value; the funding fee may be financed within that cap.',
        'Funding fee is waived for veterans receiving (or eligible for) VA compensation for a service-connected disability.',
      ],
    },
    FHA: {
      label: 'FHA cash-out',
      maxLtv: 0.8,
      stateOverrides: {},
      upfrontFeeRate: 0.0175,        // UFMIP
      upfrontFeeRateSubsequent: 0.0175,
      feeInsideCap: false,
      feeLabel: 'FHA UFMIP',
      notes: [
        'FHA cash-out has been capped at 80% LTV since 1 Sept 2019.',
        'UFMIP of 1.75% is normally financed on top of the 80% base loan amount.',
      ],
    },
    CONV: {
      label: 'Conventional cash-out',
      maxLtv: 0.8,
      stateOverrides: {},
      upfrontFeeRate: 0,
      upfrontFeeRateSubsequent: 0,
      feeInsideCap: false,
      feeLabel: 'Upfront fee',
      notes: [
        '80% LTV applies to a 1-unit primary residence. Second homes, investment properties and 2-4 units are lower.',
        'Risk-based price adjustments affect rate, not the loan amount, so they are not modelled here.',
      ],
    },
    USDA: {
      label: 'USDA',
      maxLtv: 0,
      stateOverrides: {},
      upfrontFeeRate: 0.01,
      upfrontFeeRateSubsequent: 0.01,
      feeInsideCap: false,
      feeLabel: 'USDA guarantee fee',
      notes: ['USDA does not permit cash-out refinancing.'],
    },
  },

  /** Texas Section 50(a)(6) applies to homestead cash-out regardless of program. */
  texasHomesteadCap: 0.8,

  /** Estimated closing costs when not entered manually. */
  defaultClosingCosts: 0,

  /**
   * Discount applied to an automated valuation (Zestimate, Redfin estimate,
   * any AVM) before it is used for screening, as a decimal. 0 uses the AVM
   * at face value; 0.05 screens at 95% of it. Only applied when the value was
   * identified as an AVM — a figure typed in by hand is used as given.
   */
  avmHaircut: 0,

  /** A lead is flagged as worth pursuing at or above this cash-out figure. */
  minCashOutThreshold: 10000,
};

/**
 * Resolve the effective program configuration for a program + state.
 * Returns { program, label, maxLtv, ltvSource, upfrontFeeRate, feeInsideCap, ... }
 */
export function resolveProgramRules(rules, program, state, { subsequentUse = false } = {}) {
  const cfg = rules?.programs?.[program];
  if (!cfg) return null;

  let maxLtv = cfg.maxLtv;
  let ltvSource = `${program} base maximum`;

  const override = state && cfg.stateOverrides ? cfg.stateOverrides[state] : undefined;
  if (typeof override === 'number' && override < maxLtv) {
    maxLtv = override;
    ltvSource = `${state} state cap`;
  }

  if (state === 'TX' && typeof rules.texasHomesteadCap === 'number' && rules.texasHomesteadCap < maxLtv) {
    maxLtv = rules.texasHomesteadCap;
    ltvSource = 'Texas 50(a)(6) homestead cap';
  }

  const upfrontFeeRate = subsequentUse
    ? (cfg.upfrontFeeRateSubsequent ?? cfg.upfrontFeeRate ?? 0)
    : (cfg.upfrontFeeRate ?? 0);

  return {
    program,
    label: cfg.label ?? program,
    maxLtv,
    ltvSource,
    upfrontFeeRate,
    feeInsideCap: !!cfg.feeInsideCap,
    feeLabel: cfg.feeLabel ?? 'Upfront fee',
    notes: cfg.notes ?? [],
  };
}

/** Deep-merge stored overrides on top of DEFAULT_RULES. */
export function mergeRules(overrides) {
  if (!overrides || typeof overrides !== 'object') return structuredCloneish(DEFAULT_RULES);
  const base = structuredCloneish(DEFAULT_RULES);
  for (const [key, val] of Object.entries(overrides)) {
    if (key === 'programs' && val && typeof val === 'object') {
      for (const [p, pv] of Object.entries(val)) {
        base.programs[p] = { ...(base.programs[p] ?? {}), ...pv };
      }
    } else {
      base[key] = val;
    }
  }
  return base;
}

function structuredCloneish(obj) {
  return JSON.parse(JSON.stringify(obj));
}
