/**
 * Number / currency parsing and formatting.
 *
 * Deliberately dependency-free and DOM-free so it can be unit tested in Node
 * and imported by both the content script and the popup.
 *
 * Scope note: these parsers assume US-style formatting ("1,234.56"). European
 * formatting ("1.234,56") is handled on a best-effort basis only.
 */

const SUFFIX_MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9 };

/** Characters that can show up inside a rendered currency string. */
const SPACE_RE = /[\s   ]/g;

/**
 * Parse a money-ish string into a Number.
 * Returns null when the input is not confidently a number.
 *
 *   "$1,234.56"  ->  1234.56
 *   "(2,000)"    -> -2000
 *   "1.2M"       ->  1200000
 *   "n/a"        ->  null
 */
export function parseMoney(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;

  let s = String(raw).trim();
  if (!s) return null;

  let sign = 1;

  // Accounting negatives: (1,234)
  if (/^\(.+\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }

  s = s.replace(SPACE_RE, '');

  // Strip leading/trailing currency markers and signs in either order.
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s.replace(/^(USD|\$|US\$)/i, '');
    s = s.replace(/(USD)$/i, '');
    if (s.startsWith('-')) { sign *= -1; s = s.slice(1); }
    else if (s.startsWith('+')) { s = s.slice(1); }
    if (s === before) break;
  }

  // Magnitude suffix (1.2M)
  let multiplier = 1;
  const suffix = s.match(/([kmb])$/i);
  if (suffix) {
    multiplier = SUFFIX_MULTIPLIERS[suffix[1].toLowerCase()];
    s = s.slice(0, -1);
  }

  if (!s || !/^[0-9][0-9.,]*$/.test(s)) return null;

  const normalized = stripGroupSeparators(s);
  if (normalized == null) return null;

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return sign * n * multiplier;
}

/**
 * Decide which of `.` / `,` is the decimal separator, then remove the rest.
 * Returns a plain JS-parseable numeric string, or null if it looks malformed.
 */
function stripGroupSeparators(s) {
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  let decimalSep = null;

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever appears last is the decimal separator.
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    const digitsAfter = s.length - lastComma - 1;
    const count = s.split(',').length - 1;
    // "1,234" / "1,234,567" -> grouping. "1,5" / "1,50" -> decimal.
    decimalSep = digitsAfter === 3 || count > 1 ? null : ',';
  } else if (lastDot !== -1) {
    const digitsAfter = s.length - lastDot - 1;
    const count = s.split('.').length - 1;
    // Multiple dots means grouping ("1.234.567"). A single dot is a decimal
    // point, which is the overwhelmingly common US case ("1.5", "1234.00").
    decimalSep = count > 1 && digitsAfter === 3 ? null : '.';
  }

  let intPart = s;
  let fracPart = '';

  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
    if (!/^[0-9]*$/.test(fracPart)) return null;
  }

  intPart = intPart.replace(/[.,]/g, '');
  if (!/^[0-9]*$/.test(intPart)) return null;
  if (intPart === '' && fracPart === '') return null;

  return `${intPart || '0'}${fracPart ? '.' + fracPart : ''}`;
}

/**
 * Parse a home value, expanding the shorthand an agent actually types.
 *
 * On a live call the value box gets one number typed into it per call, so the
 * keystrokes matter. "661" means $661,000 — no house is worth $661, so the
 * expansion is unambiguous. "1.2" means $1.2M for the same reason.
 *
 * Expansion is deliberately limited to those two unambiguous cases. Anything
 * from 1000 up is taken literally, because "4000" could plausibly be meant as
 * either $4,000 or $400,000 and guessing between them is exactly the kind of
 * silent wrongness this tool must not produce. An explicit k/m suffix always
 * wins over any inference.
 */
export function parseHomeValue(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const n = parseMoney(text);
  if (n == null) return null;

  // An explicit magnitude suffix was given; take it at face value.
  if (/[kmb]\s*$/i.test(text)) return n;

  if (n <= 0) return n;
  if (n < 10 && !Number.isInteger(n)) return n * 1_000_000;   // 1.2  -> 1,200,000
  if (n < 1000 && Number.isInteger(n)) return n * 1000;       // 661  -> 661,000
  return n;
}

/**
 * Parse a percentage into a decimal rate.
 *   "80%"   -> 0.8
 *   "80"    -> 0.8   (values > 1 are read as percents)
 *   "0.8"   -> 0.8
 * Returns null when unparseable.
 */
export function parsePercent(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const hadSign = s.includes('%');
  const n = parseMoney(s.replace('%', ''));
  if (n == null) return null;

  if (hadSign) return n / 100;
  // Bare number: 80 means 80%, 0.8 means 80%.
  return n > 1 ? n / 100 : n;
}

/** "$1,234" (no cents by default — mortgage figures are usually whole dollars). */
export function formatMoney(n, { cents = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/** 0.8013 -> "80.13%" */
export function formatPercent(rate, digits = 2) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Round to cents, avoiding binary float drift on .005 boundaries. */
export function round2(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Max loan amounts are conventionally truncated to whole dollars so the
 * result can never round *above* the LTV cap.
 */
export function floorDollar(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.floor(n + 1e-6);
}
