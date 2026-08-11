/**
 * Resolving the value of each field from competing sources.
 *
 * Extracted from the content script and kept pure so it can be tested
 * directly. It is worth isolating: this is where a value from one source can
 * silently override another, and the two mistakes available here — dropping
 * what the agent typed, or attaching one property's value to a different
 * borrower — both produce a confident, wrong cash-out figure rather than an
 * obvious failure.
 *
 * No DOM, no `chrome.*`.
 */

import { FIELDS } from './detect.js';
import { parseMoney } from './money.js';
import { normalizeProgram, normalizeState } from './rules.js';
import { compareAddresses, joinAddress } from './address.js';

/**
 * @typedef {Object} FieldValue
 * @property {string}  value       raw text, as shown in the panel
 * @property {?number} num         parsed amount for money fields
 * @property {string}  source      'manual' | 'bound' | 'auto' | 'external' | 'none'
 * @property {?string} sourceLabel the label the value was read from
 * @property {boolean} isAvm       came from an automated valuation
 * @property {boolean} implausible outside the sane band for the field
 * @property {?string} normalized  canonical program / state code
 */

/**
 * Merge the sources into one value per field.
 *
 * Priority: what the agent typed > a field they bound by clicking >
 * auto-detected in this frame > auto-detected in a child frame.
 *
 * A manual entry wins even when it is an empty string. That case is the agent
 * deliberately clearing a field, and falling back to detection would make it
 * refill from the page the instant they deleted the last character.
 */
export function mergeInputs({ manual = {}, detected = {}, frameFields = {}, keys } = {}) {
  const fieldKeys = keys ?? Object.keys(FIELDS);
  const out = {};

  for (const key of fieldKeys) {
    const typed = manual[key];
    const local = detected[key];
    const frame = frameFields[key];

    let raw = '';
    let source = 'none';
    let sourceLabel = null;
    let isAvm = false;

    if (typed != null) {
      raw = typed;
      source = 'manual';
    } else if (hasValue(local)) {
      raw = local.raw;
      source = local.source === 'bound' ? 'bound' : 'auto';
      sourceLabel = local.label ?? null;
      isAvm = !!local.isAvm;
    } else if (hasValue(frame)) {
      raw = frame.raw;
      source = frame.source === 'bound' ? 'bound' : 'auto';
      sourceLabel = frame.label ? `${frame.label} (frame)` : null;
      isAvm = !!frame.isAvm;
    }

    const kind = FIELDS[key]?.kind ?? 'text';
    const num = kind === 'money' ? parseMoney(raw) : null;

    out[key] = {
      value: raw ?? '',
      num,
      source,
      sourceLabel,
      isAvm,
      implausible: isImplausible(key, num),
      normalized:
        key === 'program' ? normalizeProgram(raw)
        : key === 'state' ? normalizeState(raw)
        : null,
    };
  }

  return out;
}

function hasValue(entry) {
  return entry?.raw != null && String(entry.raw).trim() !== '';
}

function isImplausible(key, num) {
  const range = FIELDS[key]?.range;
  if (!range || num == null) return false;
  return num < range[0] || num > range[1];
}

/** The lead's address on one line, for matching and for lookup links. */
export function leadAddress(inputs) {
  return joinAddress({
    street: inputs?.street?.value,
    city: inputs?.city?.value,
    state: inputs?.state?.value,
    zip: inputs?.zip?.value,
  });
}

/**
 * Decide what to do with a value read from a Zillow/Redfin tab.
 *
 * Pure: returns a decision, applies nothing.
 *
 *   { status: 'none' }                       nothing usable
 *   { status: 'expired' }                    too old to trust; drop it
 *   { status: 'applied', value, comparison } safe to fill in
 *   { status: 'offered', comparison }        show it, let a human accept
 *
 * It is only ever applied on an exact address match into an empty field.
 * On a call floor an agent may have several property tabs open, so the
 * expensive mistake is not "failed to autofill" — that costs a keystroke —
 * it is "autofilled the wrong house", which costs an appraisal and a
 * customer conversation.
 */
export function decideExternalValue({ inputs, external, now = Date.now(), ttlMs = 30 * 60 * 1000 } = {}) {
  if (!external?.value) return { status: 'none' };

  if (external.at && now - external.at > ttlMs) return { status: 'expired' };

  const address = leadAddress(inputs);
  const comparison = address
    ? compareAddresses(address, external.address)
    : { confidence: 'none', reason: 'no address on the lead' };

  const targetIsEmpty = (inputs?.propertyValue?.value ?? '') === '';

  if (comparison.confidence === 'exact' && targetIsEmpty) {
    return {
      status: 'applied',
      comparison,
      value: {
        value: String(external.value),
        num: external.value,
        source: 'external',
        sourceLabel: [external.siteLabel, external.valueLabel].filter(Boolean).join(' '),
        isAvm: true,
        implausible: false,
        normalized: null,
      },
    };
  }

  return { status: 'offered', comparison };
}
