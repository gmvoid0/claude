/**
 * Typing into someone else's form.
 *
 * The same label-matching that reads a dialer screen runs in reverse here:
 * find the control whose visible label matches, then put a value in it.
 *
 * Setting `.value` is not enough. Salesforce's components hold their own copy
 * of the field state, and a value assigned directly leaves the component
 * unaware — the box looks filled and submits empty. So the value goes in
 * through the native property setter, which the framework's own listener sees,
 * followed by the input and change events it expects. `composed: true` matters
 * because these fields live inside shadow roots and an event that does not
 * cross the boundary never reaches the component.
 */

import { collectCandidates } from '../lib/detect.js';

/**
 * Assign a value the way a keystroke would.
 *
 * The native setter is deliberate: frameworks patch the value property on the
 * element instance to track changes, and assigning through that patch is what
 * makes the change register.
 */
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

/** Select elements are set by matching option text, then notified. */
function setSelectValue(el, value) {
  const wanted = String(value).toLowerCase();
  const option = [...el.options].find(
    (o) => o.value.toLowerCase() === wanted || o.textContent.trim().toLowerCase() === wanted,
  );
  if (!option) return false;
  el.value = option.value;
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return true;
}

/**
 * Fill a planned set of entries into the page.
 *
 * Returns { filled: [...keys], notFound: [...keys] } so the caller can report
 * what actually landed rather than claiming success.
 */
export function fillForm(entries, { root = document } = {}) {
  const filled = [];
  const notFound = [];

  let candidates = [];
  try {
    candidates = collectCandidates(root).filter((c) => c.editable && c.el);
  } catch {
    return { filled, notFound: entries.map((e) => e.key) };
  }

  const used = new Set();

  for (const entry of entries) {
    let target = null;

    // Most specific label pattern first, and never reuse a control — two
    // fields sharing a label ("First Name" on borrower and co-borrower) must
    // land in different boxes.
    for (const pattern of entry.labels) {
      target = candidates.find(
        (c) => !used.has(c.el) && pattern.test(String(c.label ?? '').trim()),
      );
      if (target) break;
    }

    if (!target) {
      notFound.push(entry.key);
      continue;
    }

    used.add(target.el);

    try {
      const el = target.el;
      el.focus?.();
      if (el.tagName?.toLowerCase() === 'select') {
        if (!setSelectValue(el, entry.value)) {
          notFound.push(entry.key);
          continue;
        }
      } else {
        setNativeValue(el, entry.value);
      }
      el.blur?.();
      filled.push(entry.key);
    } catch {
      notFound.push(entry.key);
    }
  }

  return { filled, notFound };
}
