/**
 * Turning what was said into fields.
 *
 * This is the part that decides whether listening is useful. Transcription
 * gives back a sentence; an application needs "FICO 720". The gap between
 * those is spoken number forms and the cues that say which field a number
 * belongs to, and both are messier than they look:
 *
 *   "my score's like seven twenty"        -> fico 720
 *   "I owe about two hundred thousand"    -> balance 200,000
 *   "it's worth four fifty"               -> value 450,000
 *   "six and a half"                      -> rate 6.5%
 *   "I'm thirty percent service connected"-> disability 30%
 *
 * Nothing here writes to the form. Every reading comes back as a proposal
 * with the words it came from, for a human to accept — recognition is
 * unreliable enough that a wrong number written silently would be worse than
 * no listening at all.
 *
 * Pure and DOM-free.
 */

const SMALL = {
  zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES = { hundred: 100, thousand: 1000, k: 1000, grand: 1000, million: 1e6, m: 1e6 };

/** Words that carry no numeric meaning inside a spoken figure. */
const FILLER = new Set(['and', 'a', 'about', 'around', 'roughly', 'like', 'approximately', 'maybe', 'says', 'is', 'of']);

/**
 * Alternation of every number word, longest first.
 *
 * The ordering is not cosmetic. Regex alternation takes the first branch that
 * matches, so listing `nine` before `ninety` makes "ninety six thousand"
 * match as "nine" and stop — which read a $96,000 income as $9,000. Sorting
 * by length means the longest real word always wins.
 *
 * Single-letter scale and digit keys are excluded by name: `\bk\b` would
 * match a stray letter and parse as a thousand on its own. `a` is kept —
 * dropping it broke "six and a half" and "a hundred thousand", because the
 * run ended at the word before it.
 */
const EXCLUDED_WORDS = new Set(['k', 'm', 'o']);

const NUMBER_WORDS = [
  ...Object.keys(SMALL),
  ...Object.keys(TENS),
  ...Object.keys(SCALES),
  'point', 'half', 'and', 'a',
]
  .filter((word) => !EXCLUDED_WORDS.has(word))
  .sort((a, b) => b.length - a.length);

const SPAN_RE = new RegExp(
  String.raw`\d[\d,]*(?:\.\d+)?\s*(?:k|m|grand|hundred|thousand|million)?`
  + String.raw`|(?:\b(?:${NUMBER_WORDS.join('|')})\b[\s-]*){1,7}`,
  'g',
);

/**
 * Parse a spoken or written number.
 *
 * Handles digits ("720", "200,000", "6.5"), number words
 * ("two hundred thousand"), and the two-part shorthand people use for
 * three-digit figures ("seven twenty" for 720, "four fifty" for 450).
 * Returns null when there is no number.
 */
export function parseSpokenNumber(text) {
  if (text == null) return null;
  const raw = String(text).toLowerCase().trim();
  if (!raw) return null;

  // A written figure, possibly with a scale word after it: "1.2 million".
  const digits = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m|grand|hundred|thousand|million)?/);
  if (digits) {
    const base = Number(digits[1].replace(/,/g, ''));
    if (Number.isFinite(base)) {
      const scale = digits[2] ? SCALES[digits[2]] ?? 1 : 1;
      return base * scale;
    }
  }

  const words = raw
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !FILLER.has(w));
  if (!words.length) return null;

  // "six point five" / "six and a half"
  const half = words.indexOf('half');
  if (half > 0) {
    const whole = parseSpokenNumber(words.slice(0, half).join(' '));
    if (whole != null) return whole + 0.5;
  }
  const point = words.indexOf('point');
  if (point > 0) {
    const whole = parseSpokenNumber(words.slice(0, point).join(' '));
    const decimals = words.slice(point + 1).map((w) => SMALL[w]).filter((d) => d != null);
    if (whole != null && decimals.length) return Number(`${whole}.${decimals.join('')}`);
  }

  // Two-part shorthand: a single digit followed by a tens word means a
  // three-digit figure. "seven twenty" is 720, never 7 and 20.
  if (words.length === 2 && SMALL[words[0]] > 0 && SMALL[words[0]] < 10) {
    const tail = TENS[words[1]] ?? (SMALL[words[1]] >= 10 ? SMALL[words[1]] : null);
    if (tail != null) return SMALL[words[0]] * 100 + tail;
  }

  let total = 0;
  let current = 0;
  let seen = false;

  for (const word of words) {
    if (SMALL[word] != null) { current += SMALL[word]; seen = true; continue; }
    if (TENS[word] != null) { current += TENS[word]; seen = true; continue; }

    const scale = SCALES[word];
    if (scale == null) continue;
    seen = true;
    if (scale === 100) {
      current = (current || 1) * 100;
    } else {
      total += (current || 1) * scale;
      current = 0;
    }
  }

  if (!seen) return null;
  return total + current;
}

/**
 * What a field's numbers plausibly look like, and how to read an
 * under-scaled one.
 *
 * People say "four fifty" for a $450,000 house and "ninety six" for a
 * $96,000 income. `scaleTo` multiplies a figure that lands below `bare` so
 * it reaches the range the field actually lives in; `range` then rejects
 * anything still implausible rather than proposing a nonsense number.
 */
const FIELD_SHAPE = {
  fico:       { range: [300, 850] },
  rate:       { range: [0.5, 25] },
  disability: { range: [0, 100] },
  payment:    { range: [200, 100000], bare: 100, scaleTo: 100 },
  income:     { range: [5000, 10_000_000], bare: 1000, scaleTo: 1000 },
  balance:    { range: [5000, 25_000_000], bare: 1000, scaleTo: 1000 },
  value:      { range: [20000, 25_000_000], bare: 1000, scaleTo: 1000 },
  cashOut:    { range: [1000, 5_000_000], bare: 1000, scaleTo: 1000 },
};

/**
 * Cue phrases, most specific first. A cue claims the number nearest to it.
 * `negate` vetoes a match outright, which is what stops "what's your rate"
 * being read against the payment.
 */
const CUES = [
  { field: 'fico', re: /\b(credit score|fico|credit is|score is|scores? (?:are|is|around|about|like)?|my score)\b/ },
  { field: 'disability', re: /\b(service[- ]connected|disability|disabled|va rating|rated at)\b/ },
  { field: 'rate', re: /\b(interest rate|my rate|rate is|rate of|at a rate|percent interest)\b/ },
  { field: 'payment', re: /\b(monthly payment|payment is|pay (?:about |around )?(?:a month|per month|monthly)|mortgage payment|a month)\b/ },
  { field: 'income', re: /\b(income|i make|we make|i earn|salary|gross|a year|annually|per year)\b/ },
  { field: 'balance', re: /\b(i owe|we owe|owe about|balance is|balance of|payoff|left on (?:the|my) (?:loan|mortgage)|still owe)\b/ },
  { field: 'value', re: /\b(worth|appraised|value is|valued at|zestimate|market value)\b/ },
  { field: 'cashOut', re: /\b(cash out|take out|pull out|looking for|need about|want about)\b/ },
];

/** Non-numeric readings. */
const CHOICE_CUES = [
  { field: 'loanType', value: 'VA', re: /\b(v\.?a\.? loan|va mortgage|veterans? (?:affairs|loan)|it'?s a v\.?a\.?)\b/ },
  { field: 'loanType', value: 'FHA', re: /\b(f\.?h\.?a\.?)\b/ },
  { field: 'loanType', value: 'CONV', re: /\b(conventional|conforming|fannie|freddie)\b/ },
  { field: 'loanType', value: 'USDA', re: /\b(u\.?s\.?d\.?a\.?|rural development)\b/ },
  { field: 'employment', value: 'W2', re: /\b(w[- ]?2|w two|double you two)\b/ },
  { field: 'employment', value: '1099', re: /\b(1099|ten ninety[- ]?nine|self[- ]employed|independent contractor)\b/ },
];

/** How far after a cue to look for its number, in characters. */
const CUE_WINDOW = 44;

/**
 * Extract field proposals from a stretch of speech.
 *
 * Returns [{ field, value, display, evidence, confidence }], highest
 * confidence first, at most one per field.
 */
export function extractFacts(text) {
  if (!text) return [];
  const line = String(text).toLowerCase().replace(/\s+/g, ' ');
  const found = new Map();

  for (const cue of CHOICE_CUES) {
    const match = line.match(cue.re);
    if (!match) continue;
    if (found.has(cue.field)) continue;
    found.set(cue.field, {
      field: cue.field,
      value: cue.value,
      display: cue.value,
      evidence: match[0].trim(),
      confidence: 0.8,
    });
  }

  for (const cue of CUES) {
    if (found.has(cue.field)) continue;
    const match = cue.re.exec(line);
    if (!match) continue;

    // Look just after the cue, then just before it — "the balance is 200k"
    // and "200k is what I owe" are both ordinary phrasings.
    const after = line.slice(match.index + match[0].length, match.index + match[0].length + CUE_WINDOW);
    const before = line.slice(Math.max(0, match.index - CUE_WINDOW), match.index);

    const reading = firstNumberIn(after, cue.field) ?? firstNumberIn(before, cue.field);
    if (reading == null) continue;

    found.set(cue.field, {
      field: cue.field,
      value: reading.value,
      display: reading.display,
      evidence: `${match[0].trim()} … ${reading.text}`.trim(),
      confidence: reading.scaled ? 0.6 : 0.75,
    });
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** First plausible figure in a fragment, scaled into the field's range. */
function firstNumberIn(fragment, field) {
  const shape = FIELD_SHAPE[field];
  if (!shape) return null;

  // Candidate spans: a written figure, or a run of number words.
  const spans = fragment.match(SPAN_RE) ?? [];

  for (const span of spans) {
    const text = span.trim();
    if (!text) continue;

    let value = parseSpokenNumber(text);
    if (value == null) continue;

    let scaled = false;
    if (shape.scaleTo && value > 0 && value < shape.bare) {
      value *= shape.scaleTo;
      scaled = true;
    }

    const [lo, hi] = shape.range;
    if (value < lo || value > hi) continue;

    return { value, display: formatFor(field, value), text, scaled };
  }

  return null;
}

function formatFor(field, value) {
  if (field === 'rate' || field === 'disability') {
    return `${Number.isInteger(value) ? value : value.toFixed(3).replace(/0+$/, '')}%`;
  }
  if (field === 'fico') return String(Math.round(value));
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * Merge a new set of proposals into the pending list.
 *
 * A field's later reading replaces an earlier one — people correct
 * themselves, and the last thing said is what they meant. Anything already
 * accepted or dismissed stays gone.
 */
export function mergeProposals(pending, incoming, { resolved = new Set() } = {}) {
  const byField = new Map(pending.map((p) => [p.field, p]));
  for (const proposal of incoming) {
    if (resolved.has(`${proposal.field}:${proposal.value}`)) continue;
    byField.set(proposal.field, proposal);
  }
  return [...byField.values()];
}
