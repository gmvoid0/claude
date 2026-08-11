/**
 * Address normalization and comparison.
 *
 * This exists for one reason: a home value pulled from a Zillow tab must
 * never be applied to the wrong lead. On a call floor an agent may have
 * several property tabs open, and silently attaching the last one's value to
 * whoever is on the line would produce a confident, wrong number — the worst
 * possible failure for this tool.
 *
 * So a value is only ever auto-applied on an exact address match. Anything
 * less is offered as a suggestion with the address shown, for a human to
 * accept.
 *
 * Pure and DOM-free.
 */

/** USPS-style suffix abbreviations, collapsed to a canonical form. */
const SUFFIXES = new Map(Object.entries({
  STREET: 'ST', STR: 'ST', ST: 'ST',
  AVENUE: 'AVE', AVEN: 'AVE', AV: 'AVE', AVE: 'AVE',
  ROAD: 'RD', RD: 'RD',
  DRIVE: 'DR', DRV: 'DR', DR: 'DR',
  LANE: 'LN', LN: 'LN',
  COURT: 'CT', CT: 'CT',
  CIRCLE: 'CIR', CIR: 'CIR',
  BOULEVARD: 'BLVD', BLVD: 'BLVD',
  PLACE: 'PL', PL: 'PL',
  TERRACE: 'TER', TERR: 'TER', TER: 'TER',
  PARKWAY: 'PKWY', PKY: 'PKWY', PKWY: 'PKWY',
  HIGHWAY: 'HWY', HWY: 'HWY',
  TRAIL: 'TRL', TRL: 'TRL',
  WAY: 'WAY',
  LOOP: 'LOOP',
  RUN: 'RUN',
  PASS: 'PASS',
  CROSSING: 'XING', XING: 'XING',
  SQUARE: 'SQ', SQ: 'SQ',
  POINT: 'PT', PT: 'PT',
  RIDGE: 'RDG', RDG: 'RDG',
  HOLLOW: 'HOLW', HOLW: 'HOLW',
}));

/** Directional prefixes/suffixes. */
const DIRECTIONS = new Map(Object.entries({
  NORTH: 'N', N: 'N',
  SOUTH: 'S', S: 'S',
  EAST: 'E', E: 'E',
  WEST: 'W', W: 'W',
  NORTHEAST: 'NE', NE: 'NE',
  NORTHWEST: 'NW', NW: 'NW',
  SOUTHEAST: 'SE', SE: 'SE',
  SOUTHWEST: 'SW', SW: 'SW',
}));

/** Secondary unit designators, which are dropped from the comparison core. */
const UNIT_MARKERS = new Set(['APT', 'UNIT', 'STE', 'SUITE', 'BLDG', 'FL', 'FLOOR', 'RM', 'ROOM', 'LOT', 'TRLR', '#']);

/** Ordinal forms: 37TH / 37 are the same street. */
function stripOrdinal(token) {
  const m = token.match(/^(\d+)(ST|ND|RD|TH)$/);
  return m ? m[1] : token;
}

/**
 * Break an address string into comparable parts.
 * Returns { number, core, zip, state, raw } — `core` is a normalized token
 * string of the street name with suffix and directionals removed.
 */
export function parseAddress(raw) {
  if (!raw) return null;

  const text = String(raw).toUpperCase();
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/);
  const zip = zipMatch ? zipMatch[1] : null;

  // Only the street portion matters; drop everything after the first comma.
  const streetPart = text.split(',')[0];

  const tokens = streetPart
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!tokens.length) return null;

  // Leading house number. Handles "189" and "189B" and "12-14".
  let number = null;
  if (/^\d+[A-Z]?(-\d+[A-Z]?)?$/.test(tokens[0])) {
    number = tokens[0].replace(/[^0-9]/g, '');
    tokens.shift();
  }

  // Drop a unit designator and whatever follows it.
  const unitIdx = tokens.findIndex((t) => UNIT_MARKERS.has(t));
  const streetTokens = unitIdx === -1 ? tokens : tokens.slice(0, unitIdx);

  // The comparison core: street name only. Directionals and the suffix are
  // removed because sources disagree about them constantly
  // ("809 SE 37TH ST" vs "809 Southeast 37th Street").
  const core = streetTokens
    .map((t) => stripOrdinal(t))
    .filter((t) => !DIRECTIONS.has(t))
    .filter((t) => !SUFFIXES.has(t))
    .filter(Boolean);

  return {
    number,
    core: core.join(' '),
    coreTokens: core,
    zip,
    raw: String(raw).trim(),
  };
}

/**
 * Compare two addresses.
 *
 * Returns { confidence, reason } where confidence is one of:
 *   'exact'  — safe to auto-apply
 *   'likely' — offer it, don't apply it
 *   'none'   — different properties, or not enough to tell
 */
export function compareAddresses(a, b) {
  const left = parseAddress(a);
  const right = parseAddress(b);

  if (!left || !right) return { confidence: 'none', reason: 'address missing' };
  if (!left.core || !right.core) return { confidence: 'none', reason: 'no street name' };

  // A ZIP mismatch is decisive — two different properties.
  if (left.zip && right.zip && left.zip !== right.zip) {
    return { confidence: 'none', reason: 'different ZIP' };
  }

  if (left.number && right.number && left.number !== right.number) {
    return { confidence: 'none', reason: 'different house number' };
  }

  const sameCore = left.core === right.core;
  const overlap = tokenOverlap(left.coreTokens, right.coreTokens);
  const bothNumbered = !!left.number && !!right.number;

  if (bothNumbered && sameCore) {
    // Matching ZIPs make it certain; absent ZIPs it is still a house number
    // plus a street name, which is enough to act on.
    return {
      confidence: 'exact',
      reason: left.zip && right.zip ? 'number, street and ZIP match' : 'number and street match',
    };
  }

  if (bothNumbered && overlap >= 0.7) {
    return { confidence: 'likely', reason: 'house number matches, street name differs slightly' };
  }

  if (!bothNumbered && sameCore && left.zip && right.zip) {
    return { confidence: 'likely', reason: 'street and ZIP match but no house number' };
  }

  return { confidence: 'none', reason: 'addresses do not match' };
}

function tokenOverlap(a, b) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / Math.max(a.length, b.length);
}

/**
 * Assemble a single-line address from separate lead fields.
 */
export function joinAddress({ street, city, state, zip } = {}) {
  const line1 = (street ?? '').trim();
  const rest = [city, state].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  const tail = [rest, (zip ?? '').trim()].filter(Boolean).join(' ');
  return [line1, tail].filter(Boolean).join(', ');
}

/**
 * A Zillow search URL for an address. Zillow resolves this to the property
 * page; it is the same URL the site produces when you type into its search
 * box, so no private endpoint is involved.
 */
export function zillowSearchUrl(address) {
  if (!address) return null;
  return `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`;
}

export function redfinSearchUrl(address) {
  if (!address) return null;
  return `https://www.redfin.com/search?query=${encodeURIComponent(address)}`;
}
