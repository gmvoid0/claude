/**
 * Field detection.
 *
 * Two halves, deliberately separated:
 *   - Pure scoring/selection logic (testable in Node, no DOM).
 *   - DOM harvesting (`collectCandidates`), which finds inputs and works out
 *     what each one is labelled.
 *
 * The DOM half matters most on agent screens like VICIdial, where fields are
 * frequently *relabelled* — a field named `vendor_lead_code` may be displayed
 * as "Mortgage Balance". So visible label text always outranks the `name`
 * attribute, and there is a geometric fallback for absolutely-positioned
 * layouts where the label is not a DOM ancestor or sibling of the input.
 */

import { parseMoney, parsePercent } from './money.js';
import { PANEL_HOST_ID } from './constants.js';

/* ------------------------------------------------------------------ *
 * Field definitions
 * ------------------------------------------------------------------ */

/**
 * Each pattern is { re, score }. `exclude` patterns veto a match outright,
 * which is what keeps "Mortgage Payment" from being read as a balance.
 *
 * `kind` drives parsing and plausibility checks.
 * `range` is a soft plausibility band — outside it, the candidate is
 * penalised but still offered, and the UI flags it.
 */
export const FIELDS = {
  propertyValue: {
    label: 'Home value',
    kind: 'money',
    range: [20000, 25000000],
    exclude: [
      /\bloan\b/i, /\bbalance\b/i, /\bpayoff\b/i, /\bpayment\b/i, /\brent\b/i,
      /\btax(es)?\b/i, /\binsurance\b/i, /\bper\s*mo\b/i, /\/mo\b/i, /\bdown\b/i,
    ],
    patterns: [
      { re: /^\s*(appraised|appraisal)\s*(value|amount)?\s*:?\s*$/i, score: 100 },
      { re: /^\s*(estimated|est\.?)\s*(home|property)?\s*value\s*:?\s*$/i, score: 100 },
      { re: /^\s*(home|property|subject)\s*value\s*:?\s*$/i, score: 100 },
      { re: /^\s*(market|current)\s*value\s*:?\s*$/i, score: 95 },
      // AVM brands. The trademark symbol is stripped by cleanLabel.
      { re: /^\s*zestimate\s*:?\s*$/i, score: 95 },
      { re: /^\s*redfin\s*estimate\s*:?\s*$/i, score: 95 },
      { re: /^\s*(home\s*value\s*)?estimate\s*:?\s*$/i, score: 90 },
      { re: /^\s*(avm|hvi|rvm)\s*:?\s*$/i, score: 85 },
      { re: /\b(appraised|appraisal)\s*value\b/i, score: 80 },
      { re: /\b(home|property|market|estimated)\s*value\b/i, score: 75 },
      { re: /\bzestimate\b/i, score: 75 },
      { re: /\bvalue\b/i, score: 40 },
      { re: /\b(purchase|sale|list)\s*price\b/i, score: 35 },
    ],
  },

  firstLien: {
    label: 'Mortgage balance',
    kind: 'money',
    range: [1000, 25000000],
    exclude: [/\bpayment\b/i, /\brate\b/i, /\bterm\b/i, /\bsecond\b/i, /\b2nd\b/i, /\bheloc\b/i, /\bescrow\b/i],
    patterns: [
      { re: /^\s*mortgage\s*balance\s*:?\s*$/i, score: 100 },
      { re: /^\s*(loan|principal|current)\s*balance\s*:?\s*$/i, score: 100 },
      { re: /^\s*(unpaid\s*principal\s*balance|upb)\s*:?\s*$/i, score: 100 },
      { re: /^\s*payoff\s*(amount)?\s*:?\s*$/i, score: 95 },
      { re: /^\s*(first|1st)\s*(mortgage|lien|loan)\s*(balance|amount)?\s*:?\s*$/i, score: 100 },
      { re: /\b(first|1st)\s*(mortgage|lien)\b.*\b(balance|payoff|amount)\b/i, score: 90 },
      { re: /\bmortgage\s*balance\b/i, score: 85 },
      { re: /\b(loan|principal)\s*balance\b/i, score: 80 },
      { re: /\bpayoff\b/i, score: 70 },
      { re: /\bbalance\b/i, score: 45 },
    ],
  },

  secondLien: {
    label: '2nd / HELOC',
    kind: 'money',
    range: [0, 5000000],
    exclude: [/\bpayment\b/i, /\brate\b/i],
    patterns: [
      { re: /^\s*(second|2nd)\s*(mortgage|lien|loan)\s*(balance|amount)?\s*:?\s*$/i, score: 100 },
      { re: /^\s*heloc\s*(balance)?\s*:?\s*$/i, score: 100 },
      { re: /\b(second|2nd)\s*(mortgage|lien)\b/i, score: 85 },
      { re: /\bheloc\b/i, score: 85 },
      { re: /\bhome\s*equity\s*(line|loan)\b/i, score: 80 },
      { re: /\bsubordinate\s*(lien|financing)\b/i, score: 75 },
    ],
  },

  program: {
    label: 'Loan type',
    kind: 'text',
    patterns: [
      { re: /^\s*loan\s*type\s*:?\s*$/i, score: 100 },
      { re: /^\s*loan\s*program\s*:?\s*$/i, score: 100 },
      { re: /^\s*(mortgage|product)\s*type\s*:?\s*$/i, score: 95 },
      { re: /^\s*program\s*:?\s*$/i, score: 80 },
      { re: /\bloan\s*(type|program)\b/i, score: 75 },
    ],
  },

  state: {
    label: 'State',
    kind: 'text',
    exclude: [/\bstatus\b/i, /\bestate\b/i],
    patterns: [
      { re: /^\s*state\s*:?\s*$/i, score: 100 },
      { re: /^\s*(property|subject)\s*state\s*:?\s*$/i, score: 100 },
      { re: /^\s*st\.?\s*:?\s*$/i, score: 70 },
      { re: /\bproperty\s*state\b/i, score: 80 },
    ],
  },

  fico: {
    label: 'FICO',
    kind: 'money',
    range: [300, 900],
    patterns: [
      { re: /^\s*fico\s*(score)?\s*:?\s*$/i, score: 100 },
      { re: /^\s*credit\s*score\s*:?\s*$/i, score: 100 },
      { re: /\bfico\b/i, score: 85 },
      { re: /\bcredit\s*score\b/i, score: 80 },
    ],
  },

  interestRate: {
    label: 'Rate',
    kind: 'percent',
    range: [0.0001, 0.25],
    exclude: [/\bapr\b/i],
    patterns: [
      { re: /^\s*(interest\s*)?rate\s*:?\s*$/i, score: 100 },
      { re: /^\s*(current|note)\s*rate\s*:?\s*$/i, score: 100 },
      { re: /\binterest\s*rate\b/i, score: 85 },
    ],
  },

  payment: {
    label: 'Payment',
    kind: 'money',
    range: [100, 100000],
    exclude: [/\bbalance\b/i],
    patterns: [
      { re: /^\s*mortgage\s*payment\s*:?\s*$/i, score: 100 },
      { re: /^\s*(monthly\s*)?payment\s*:?\s*$/i, score: 95 },
      { re: /^\s*p\s*&\s*i\s*:?\s*$/i, score: 90 },
      { re: /\bmortgage\s*payment\b/i, score: 85 },
    ],
  },

  street: {
    label: 'Address',
    kind: 'text',
    exclude: [/\bemail\b/i, /\bip\b/i],
    patterns: [
      { re: /^\s*address\s*1?\s*:?\s*$/i, score: 100 },
      { re: /^\s*(street|property)\s*address\s*:?\s*$/i, score: 100 },
      { re: /^\s*address\s*:?\s*$/i, score: 90 },
    ],
  },

  city: {
    label: 'City',
    kind: 'text',
    patterns: [
      { re: /^\s*city\s*:?\s*$/i, score: 100 },
      { re: /\bcity\b/i, score: 60 },
    ],
  },

  zip: {
    label: 'ZIP',
    kind: 'text',
    patterns: [
      { re: /^\s*(post\s*code|postal\s*code|zip(\s*code)?)\s*:?\s*$/i, score: 100 },
      { re: /\b(zip|postal)\b/i, score: 70 },
    ],
  },

  phone: {
    label: 'Phone',
    kind: 'text',
    exclude: [/\balt\b/i, /\bdial\s*code\b/i, /\bfax\b/i],
    patterns: [
      { re: /^\s*(phone|phone\s*number)\s*:?\s*$/i, score: 100 },
      { re: /^\s*(cell|mobile|home)\s*(phone)?\s*:?\s*$/i, score: 95 },
      { re: /\bphone\s*number\b/i, score: 80 },
    ],
  },

  lastName: {
    label: 'Last name',
    kind: 'text',
    patterns: [
      { re: /^\s*last\s*(name)?\s*:?\s*$/i, score: 100 },
      { re: /^\s*surname\s*:?\s*$/i, score: 95 },
      // Attribute spellings, which is what a mislabelled field falls back to.
      { re: /^\s*lname\s*$/i, score: 95 },
      { re: /^\s*(borrower|customer|contact)\s*last\s*(name)?\s*$/i, score: 95 },
    ],
  },

  firstName: {
    label: 'First name',
    kind: 'text',
    patterns: [
      { re: /^\s*first\s*(name)?\s*:?\s*$/i, score: 100 },
      { re: /^\s*fname\s*$/i, score: 95 },
      { re: /^\s*(borrower|customer|contact)\s*first\s*(name)?\s*$/i, score: 95 },
    ],
  },

  /**
   * A name held in one box rather than split into first and last.
   *
   * Plenty of screens do this, and where they do the application's Full name
   * field had nothing to fill from — the one field an agent should never
   * have to type, because the name is on screen the moment the call connects.
   *
   * The exclusions carry the weight here. A dialer screen is covered in
   * things ending in "name" that are not the borrower: the agent's own user
   * name, the campaign, the list, the file. Filling an application with the
   * name of a calling list would be worse than leaving it blank, so anything
   * that is not plainly a person's name on this record is refused.
   */
  fullName: {
    label: 'Name',
    kind: 'text',
    exclude: [
      /\b(first|last|middle|sur)\s*name\b/i,
      /\b(user|agent|rep|owner|manager|supervisor)\b/i,
      /\b(campaign|list|file|group|queue|status|company|business|employer|lender|bank)\b/i,
      /\bco[-\s]?borrower\b/i,
      /\b(login|account|screen|display|db|table|field)\s*name\b/i,
    ],
    patterns: [
      { re: /^\s*(full|borrower|customer|client|contact|lead|applicant)\s*name\s*:?\s*$/i, score: 100 },
      { re: /^\s*(borrower|customer|client|applicant)\s*:?\s*$/i, score: 90 },
      { re: /^\s*name\s*:?\s*$/i, score: 85 },
    ],
  },
};

export const FIELD_KEYS = Object.keys(FIELDS);

/** Fields the calculator actually needs to produce a result. */
export const REQUIRED_FIELDS = ['propertyValue', 'firstLien', 'program'];

/* ------------------------------------------------------------------ *
 * Pure scoring
 * ------------------------------------------------------------------ */

/**
 * Score how well a label matches a field. 0 means no match.
 * Pure — this is the function the unit tests hammer.
 */
export function scoreLabel(fieldKey, labelText) {
  const field = FIELDS[fieldKey];
  if (!field || !labelText) return 0;

  const text = String(labelText).replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  // Labels are short. A paragraph that happens to contain "value" is not a label.
  if (text.length > 60) return 0;

  if (field.exclude?.some((re) => re.test(text))) return 0;

  let best = 0;
  for (const { re, score } of field.patterns) {
    if (re.test(text) && score > best) best = score;
  }
  return best;
}

/**
 * Weight applied to a label depending on how it was discovered.
 * A visible label beats an attribute; the `name` attribute is least trusted
 * because relabelled fields keep their original names.
 */
export const SOURCE_WEIGHT = {
  label: 1.0,       // <label for=...>
  cell: 0.98,       // adjacent table cell
  sibling: 0.95,    // preceding sibling text
  geometric: 0.9,   // nearest text to the left / above
  aria: 0.85,
  title: 0.8,
  placeholder: 0.7,
  name: 0.45,
};

/**
 * Final score for a candidate against a field.
 * Combines label match, discovery source, and value plausibility.
 */
export function scoreCandidate(fieldKey, candidate) {
  // Two chances, and the second one matters more than it looks.
  //
  // Label resolution returns the *first* thing it finds, in priority order.
  // When a page hands it something that happens to be wrong — a stray cell,
  // a caption belonging to the field above — that wrong label scores zero
  // for every field and the element is lost, even with `name="first_name"`
  // sitting right there on it. That is exactly how a live VICIdial screen
  // ended up with the borrower's name detected nowhere while every other
  // field on the same form read correctly.
  //
  // So the attribute is always scored too, at its own lower weight. A
  // visible label still wins whenever it means anything; the attribute only
  // decides the cases the label got wrong.
  const labelScore = scoreLabel(fieldKey, candidate.label)
    * (SOURCE_WEIGHT[candidate.labelSource] ?? 0.5);
  const attrScore = candidate.attrLabel
    ? scoreLabel(fieldKey, candidate.attrLabel) * SOURCE_WEIGHT.name
    : 0;

  let score = Math.max(labelScore, attrScore);
  if (!score) return 0;

  const field = FIELDS[fieldKey];
  const parsed = parseValue(field.kind, candidate.raw);

  // A money/percent field whose content will not parse is probably not it —
  // but an empty field is fine (it may just be blank for this record).
  const isEmpty = candidate.raw == null || String(candidate.raw).trim() === '';
  if (!isEmpty && field.kind !== 'text' && parsed == null) {
    score *= 0.35;
  }

  // Soft plausibility band.
  if (parsed != null && field.range) {
    const [lo, hi] = field.range;
    if (parsed < lo || parsed > hi) score *= 0.6;
  }

  // Prefer a populated field over an identical empty one.
  if (isEmpty) score *= 0.9;

  return score;
}

/** Parse a raw string according to a field kind. */
export function parseValue(kind, raw) {
  if (raw == null) return null;
  if (kind === 'money') return parseMoney(raw);
  if (kind === 'percent') return parsePercent(raw);
  return null;
}

/**
 * Choose the best candidate per field from a flat candidate list.
 * Returns { fieldKey: {candidate, score} }.
 *
 * A candidate element is only assigned to one field — the highest scoring —
 * so a single input cannot be read as both the balance and the payment.
 */
export function assignFields(candidates, fieldKeys = FIELD_KEYS) {
  const scored = [];
  for (const candidate of candidates) {
    for (const fieldKey of fieldKeys) {
      const score = scoreCandidate(fieldKey, candidate);
      if (score > 0) scored.push({ fieldKey, candidate, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const byField = {};
  const usedElements = new Set();

  for (const entry of scored) {
    if (byField[entry.fieldKey]) continue;
    const id = entry.candidate.uid;
    if (id != null && usedElements.has(id)) continue;
    byField[entry.fieldKey] = entry;
    if (id != null) usedElements.add(id);
  }

  return byField;
}

/* ------------------------------------------------------------------ *
 * DOM harvesting
 * ------------------------------------------------------------------ */

const INPUT_SELECTOR = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=password]), select, textarea';

/**
 * Text that is a bare figure, e.g. "$661,400" or "270,900" or "$1.2M".
 *
 * A currency marker or a thousands separator is required. An undecorated run
 * of digits is deliberately not accepted: on a listing page that pattern also
 * matches ZIP codes, years built and square footage, and a five-digit ZIP
 * sits squarely inside the plausible range for a home value.
 */
const MONEY_TEXT_RE = /^(?:\$\s*)?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$|^\$\s*\d+(?:\.\d{1,2})?[KkMm]?$/;

/** True when a run of text reads as a currency figure on its own. */
export function looksLikeFigure(text) {
  return MONEY_TEXT_RE.test(String(text ?? '').trim());
}

/**
 * Traversal caps.
 *
 * Per-root rather than one shared pool, so a text-heavy host document can
 * never starve a small injected panel. The total keeps a pathological page
 * from making each scan expensive — this runs several times a second.
 */
const TEXT_NODE_ROOT_CAP = 3000;
const TEXT_NODE_TOTAL_CAP = 9000;

/** Labels that mean the figure is an automated estimate, not an appraisal. */
const AVM_LABEL_RE = /\b(zestimate|redfin\s*estimate|avm|rvm|automated\s*valuation|estimated\s*(home\s*)?value|home\s*value\s*estimate|estimate)\b/i;

/** True when this label indicates an algorithmic valuation rather than an appraisal. */
export function isAvmLabel(label) {
  if (!label) return false;
  return AVM_LABEL_RE.test(String(label));
}

/**
 * Every root worth searching: the document plus any open shadow roots.
 *
 * Panels injected by *other* extensions — the Zillow-lookup helper this was
 * built alongside, for instance — are frequently mounted in an open shadow
 * root, which a plain querySelectorAll on the document will not see.
 * Closed shadow roots remain unreachable by design.
 *
 * Our own panel is excluded explicitly. It is mounted in an open shadow root
 * too, and it displays a "Home value" label beside a currency figure — so
 * without this the detector harvests the panel's own output and feeds it back
 * in as though it had been read off the page.
 */
function collectRoots(root, limit = 40) {
  const roots = [root];
  const queue = [root];

  while (queue.length && roots.length < limit) {
    const current = queue.shift();
    for (const el of safeQueryAll(current, '*')) {
      if (el.id === PANEL_HOST_ID) continue;
      const shadow = el.shadowRoot;
      if (shadow && !roots.includes(shadow)) {
        roots.push(shadow);
        queue.push(shadow);
        if (roots.length >= limit) break;
      }
    }
  }
  return roots;
}

/**
 * Walk a document/root and produce labelled candidates.
 * Each candidate: { uid, el, label, labelSource, raw, editable, isAvm }
 */
export function collectCandidates(root = document) {
  const candidates = [];
  let uid = 0;

  const roots = collectRoots(root);

  // Text holders are pooled across every root so a label in the light DOM can
  // still be matched to a field inside a shadow root, and vice versa —
  // getBoundingClientRect is in viewport coordinates either way.
  //
  // Shadow roots are traversed *before* the host document, and every root gets
  // its own cap rather than drawing from one shared pool. Both details matter:
  // a dialer screen carries thousands of short text nodes, while the injected
  // panel holding the home value carries a handful. Walking in document order
  // against a shared budget let the host page exhaust it and the panel was
  // never reached at all.
  const textHolders = [];
  const ordered = roots.length > 1 ? [...roots.slice(1), roots[0]] : roots;

  let used = 0;
  for (const r of ordered) {
    if (used >= TEXT_NODE_TOTAL_CAP) break;
    const share = Math.min(TEXT_NODE_ROOT_CAP, TEXT_NODE_TOTAL_CAP - used);
    const found = collectTextHolders(r, share);
    textHolders.push(...found);
    used += found.length;
  }

  const labelHolders = textHolders.filter((h) => !MONEY_TEXT_RE.test(h.text));

  /**
   * Labels grouped by the root they live in.
   *
   * Geometry alone is not enough to pair a label with a value. A panel
   * injected over a host page has that page's text sitting immediately to its
   * left, often closer than its own caption directly above — so the nearest
   * text is frequently something from an unrelated interface. Restricting the
   * search to the same root first keeps a card's caption bound to that card's
   * figure. The full set stays available as a fallback, so a label in the
   * light DOM can still describe a field inside a shadow root when there is
   * genuinely nothing nearer.
   */
  const byRoot = new Map();
  for (const holder of labelHolders) {
    if (!byRoot.has(holder.root)) byRoot.set(holder.root, []);
    byRoot.get(holder.root).push(holder);
  }
  const sameRegionAs = (el) => {
    try {
      return byRoot.get(el.getRootNode?.()) ?? null;
    } catch {
      return null;
    }
  };

  // --- form controls
  for (const r of roots) {
    for (const el of safeQueryAll(r, INPUT_SELECTOR)) {
      if (!isVisible(el)) continue;
      if (el.closest?.(`#${PANEL_HOST_ID}`)) continue;
      const { label, labelSource } = findLabel(el, sameRegionAs(el) ?? labelHolders, labelHolders);
      const attrLabel = attributeLabel(el);
      if (!label && !attrLabel) continue;
      candidates.push({
        uid: ++uid,
        el,
        label: label ?? attrLabel,
        labelSource: label ? labelSource : 'name',
        attrLabel,
        raw: readValue(el),
        editable: true,
        isAvm: isAvmLabel(label),
      });
    }
  }

  // --- read-only table rows: "Phone: 3024239504" as a label cell beside a
  //     value cell. Plenty of lead data is displayed rather than editable,
  //     and without this those fields are invisible to detection.
  let cellPairs = 0;
  for (const r of roots) {
    for (const cell of safeQueryAll(r, 'td, th')) {
      if (cellPairs > 300) break;
      if (cell.closest?.(`#${PANEL_HOST_ID}`)) continue;
      // Cells containing a control are already covered by the pass above.
      if (safeQuery(cell, INPUT_SELECTOR)) continue;

      const value = cleanLabel(cell.textContent);
      if (!value || value.length > 60) continue;

      const prev = cell.previousElementSibling;
      if (!prev || safeQuery(prev, INPUT_SELECTOR)) continue;
      const label = cleanLabel(prev.textContent);
      if (!label || label.length > 60) continue;

      cellPairs++;
      candidates.push({
        uid: ++uid,
        el: cell,
        label,
        labelSource: 'cell',
        raw: value,
        editable: false,
        isAvm: isAvmLabel(label),
      });
    }
  }

  let moneyCandidates = 0;

  for (const holder of textHolders) {
    // --- "Estimated value: $412,000" in a single text node
    const inline = holder.text.match(/^(.{2,40}?)\s*[:–—-]\s*(\$?[\d.,]+\s*[kKmM]?%?)$/);
    if (inline) {
      candidates.push({
        uid: ++uid,
        el: holder.el,
        label: inline[1],
        labelSource: 'sibling',
        raw: inline[2],
        editable: false,
        isAvm: isAvmLabel(inline[1]),
      });
      continue;
    }

    // --- a bare figure whose label sits above or beside it.
    //     This is the shape AVM cards use: "Zestimate®" then "$661,400".
    if (!MONEY_TEXT_RE.test(holder.text)) continue;
    // Each of these costs a scan over every label, so the count is capped.
    // Generous enough that a busy dialer screen cannot push a valuation card
    // past the limit before it is considered.
    if (++moneyCandidates > 250) break;
    const region = sameRegionAs(holder.el);
    const label = (region && nearestTextByPosition(holder.el, region))
      ?? nearestTextByPosition(holder.el, labelHolders);
    if (!label) continue;
    candidates.push({
      uid: ++uid,
      el: holder.el,
      label,
      labelSource: 'geometric',
      raw: holder.text,
      editable: false,
      isAvm: isAvmLabel(label),
    });
  }

  return candidates;
}

/** Current value of a form control. */
export function readValue(el) {
  if (!el) return null;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'select') {
    const opt = el.selectedOptions?.[0];
    return opt ? (opt.textContent ?? opt.value ?? '') : (el.value ?? '');
  }
  if (tag === 'input' || tag === 'textarea') return el.value ?? '';
  return (el.textContent ?? '').trim();
}

/**
 * Work out what an input is labelled, trying increasingly loose strategies.
 */
function findLabel(el, textHolders, fallbackHolders = null) {
  // 1. Explicit <label for>
  const doc = el.ownerDocument;
  if (el.id) {
    const lbl = safeQuery(doc, `label[for="${cssEscape(el.id)}"]`);
    const text = cleanLabel(lbl?.textContent);
    if (text) return { label: text, labelSource: 'label' };
  }
  const wrapping = el.closest?.('label');
  if (wrapping) {
    const text = cleanLabel(wrapping.textContent);
    if (text) return { label: text, labelSource: 'label' };
  }

  // 2. ARIA
  const ariaLabel = cleanLabel(el.getAttribute?.('aria-label'));
  if (ariaLabel) return { label: ariaLabel, labelSource: 'aria' };
  const labelledBy = el.getAttribute?.('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/)
      .map((id) => safeQuery(doc, `#${cssEscape(id)}`)?.textContent)
      .filter(Boolean)
      .join(' ');
    const text = cleanLabel(parts);
    if (text) return { label: text, labelSource: 'aria' };
  }

  // 3. Adjacent table cell
  const cell = el.closest?.('td, th');
  if (cell) {
    const prev = cell.previousElementSibling;
    const text = cleanLabel(prev?.textContent);
    if (text) return { label: text, labelSource: 'cell' };
    // Some layouts put the label in the row's first cell.
    const row = cell.closest('tr');
    const firstCell = row?.querySelector('td, th');
    if (firstCell && firstCell !== cell) {
      const rowText = cleanLabel(firstCell.textContent);
      if (rowText) return { label: rowText, labelSource: 'cell' };
    }
  }

  // 4. Preceding sibling text
  const sibling = precedingText(el);
  if (sibling) return { label: sibling, labelSource: 'sibling' };

  // 5. Geometric: nearest short text to the left, else directly above.
  //    This is what handles absolutely-positioned agent screens.
  const geo = nearestTextByPosition(el, textHolders)
    ?? (fallbackHolders && fallbackHolders !== textHolders
      ? nearestTextByPosition(el, fallbackHolders)
      : null);
  if (geo) return { label: geo, labelSource: 'geometric' };

  // 6. Attribute fallbacks
  const title = cleanLabel(el.getAttribute?.('title'));
  if (title) return { label: title, labelSource: 'title' };
  const placeholder = cleanLabel(el.getAttribute?.('placeholder'));
  if (placeholder) return { label: placeholder, labelSource: 'placeholder' };
  const name = el.getAttribute?.('name') || el.id;
  if (name) {
    const humanized = cleanLabel(String(name).replace(/[_\-.]+/g, ' '));
    if (humanized) return { label: humanized, labelSource: 'name' };
  }

  return { label: null, labelSource: null };
}

/**
 * The element's own `name` or `id`, as words.
 *
 * `first_name` becomes "first name", which is what the field patterns are
 * written against. Kept separate from the resolved label so it can be
 * scored independently rather than only as a last resort.
 */
export function attributeLabel(el) {
  const raw = el?.getAttribute?.('name') || el?.id;
  if (!raw) return null;
  return cleanLabel(String(raw).replace(/[_\-.]+/g, ' '));
}

/** Text immediately before the element, within the same parent. */
function precedingText(el) {
  let node = el.previousSibling;
  let hops = 0;
  while (node && hops < 4) {
    if (node.nodeType === 3) {
      const text = cleanLabel(node.textContent);
      if (text) return text;
    } else if (node.nodeType === 1) {
      if (node.matches?.(INPUT_SELECTOR)) return null;  // hit another field
      const text = cleanLabel(node.textContent);
      if (text) return text;
    }
    node = node.previousSibling;
    hops++;
  }
  return null;
}

/**
 * Elements whose own text is short enough to be a label, with their rects.
 *
 * This is the hot path — it runs on every poll tick — so it avoids
 * getComputedStyle entirely and settles for the cheaper "does it have client
 * rects" test. The difference is that `visibility: hidden` text is still
 * collected, which costs a few harmless extra candidates rather than a
 * style resolution per text node.
 *
 * `budget` caps the total across all roots so a heavy page cannot turn each
 * tick into hundreds of thousands of iterations.
 */
function collectTextHolders(root, budget = 4000) {
  const holders = [];
  if (budget <= 0) return holders;

  const doc = root.ownerDocument ?? root;
  const walker = doc.createTreeWalker
    ? doc.createTreeWalker(root.body ?? root, 4 /* SHOW_TEXT */)
    : null;
  if (!walker) return holders;

  let node;
  let guard = 0;
  while ((node = walker.nextNode()) && guard++ < budget * 3 && holders.length < budget) {
    const raw = node.textContent;
    // Cheap rejections before any DOM work.
    if (!raw || raw.length > 120) continue;
    const text = cleanLabel(raw);
    if (!text || text.length > 60) continue;

    const el = node.parentElement;
    if (!el) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'option' || tag === 'noscript') continue;

    const rect = rectOf(el);
    if (!rect || (rect.width === 0 && rect.height === 0)) continue;

    holders.push({ el, text, rect, root });
  }
  return holders;
}

/**
 * Find the label text sitting immediately to the left of (or above) an input.
 */
function nearestTextByPosition(el, holders) {
  if (!holders?.length) return null;
  const r = rectOf(el);
  if (!r || (r.width === 0 && r.height === 0)) return null;

  let best = null;
  let bestCost = Infinity;

  for (const holder of holders) {
    if (holder.el === el) continue;
    if (holder.el.contains?.(el) || el.contains?.(holder.el)) continue;
    const hr = holder.rect;
    if (!hr || (hr.width === 0 && hr.height === 0)) continue;

    const verticalOverlap = Math.min(r.bottom, hr.bottom) - Math.max(r.top, hr.top);

    let cost = Infinity;
    if (verticalOverlap > Math.min(r.height, hr.height) * 0.4 && hr.right <= r.left + 4) {
      // Same line, to the left.
      cost = r.left - hr.right;
    } else if (hr.bottom <= r.top + 4 && Math.abs(hr.left - r.left) < 90) {
      // Stacked directly above.
      cost = (r.top - hr.bottom) + 40;   // penalty so left-of wins ties
    }

    if (cost < bestCost && cost <= 240) {
      bestCost = cost;
      best = holder.text;
    }
  }

  return best;
}

function rectOf(el) {
  try {
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

function isVisible(el) {
  try {
    if (!el.getClientRects) return true;
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style) return true;
    return style.visibility !== 'hidden' && style.display !== 'none';
  } catch {
    return true;
  }
}

/** Trim, collapse whitespace, drop trailing punctuation used on labels. */
export function cleanLabel(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:*]+$/, '')
    // Trademark marks would otherwise defeat an anchored pattern: an AVM
    // card renders "Zestimate®", not "Zestimate".
    .replace(/[®™©℠]/g, '')
    .trim();
  return cleaned || null;
}

function safeQueryAll(root, selector) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function safeQuery(root, selector) {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return String(value).replace(/["\\\]\[#.:>+~*^$|()=\s]/g, '\\$&');
}
