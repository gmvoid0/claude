/**
 * Stable-ish CSS selectors for manually bound fields.
 *
 * When auto-detection picks the wrong field the user binds one by clicking it.
 * That binding has to survive page reloads and, on a dialer, the next call —
 * so the selector prefers stable identifiers (name, id, data-*) over
 * positional paths, and falls back to nth-of-type only when it must.
 */

/** Attributes that usually identify a field across reloads. */
const STABLE_ATTRS = ['name', 'data-testid', 'data-test', 'data-field', 'data-id', 'formcontrolname'];

/** id values that look generated (react-aria-1234, :r0:, ember42) are unstable. */
const VOLATILE_ID = /(^:|^[0-9])|(\d{4,})|(^ember)|(^react-aria)|(^mui-)|(^radix-)/i;

/**
 * Build a selector for `el`, unique within its document.
 */
export function buildSelector(el) {
  if (!el || el.nodeType !== 1) return null;
  const doc = el.ownerDocument;

  // 1. A stable attribute that is already unique.
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute?.(attr);
    if (!val) continue;
    const sel = `${el.tagName.toLowerCase()}[${attr}="${cssEscapeAttr(val)}"]`;
    if (isUnique(doc, sel)) return sel;
  }

  // 2. A non-generated id.
  const id = el.getAttribute?.('id');
  if (id && !VOLATILE_ID.test(id)) {
    const sel = `#${cssEscape(id)}`;
    if (isUnique(doc, sel)) return sel;
  }

  // 3. Structural path, shortened as soon as it becomes unique.
  const parts = [];
  let node = el;
  let depth = 0;

  while (node && node.nodeType === 1 && depth < 12) {
    parts.unshift(describeNode(node));
    const candidate = parts.join(' > ');
    if (isUnique(doc, candidate)) return candidate;
    node = node.parentElement;
    depth++;
  }

  const joined = parts.join(' > ');
  return joined || null;
}

function describeNode(node) {
  const tag = node.tagName.toLowerCase();

  for (const attr of STABLE_ATTRS) {
    const val = node.getAttribute?.(attr);
    if (val) return `${tag}[${attr}="${cssEscapeAttr(val)}"]`;
  }

  const id = node.getAttribute?.('id');
  if (id && !VOLATILE_ID.test(id)) return `${tag}#${cssEscape(id)}`;

  const stableClasses = Array.from(node.classList ?? [])
    .filter((c) => c.length > 1 && c.length < 40 && !/\d{3,}/.test(c) && !/^(css|sc|jsx)-/.test(c))
    .slice(0, 2);

  let base = tag + stableClasses.map((c) => `.${cssEscape(c)}`).join('');

  const parent = node.parentElement;
  if (parent) {
    const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
    if (sameTag.length > 1) {
      base += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
  }

  return base;
}

function isUnique(doc, selector) {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/** Resolve a stored selector back to an element. */
export function resolveSelector(selector, root = document) {
  if (!selector) return null;
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * A key identifying "which page is this" for storing per-site bindings.
 * Path is included because agent screens and CRMs differ per route, but
 * query strings and fragments are stripped since they carry session ids.
 */
export function pageKey(loc = location) {
  try {
    const path = (loc.pathname || '/').replace(/\/+$/, '') || '/';
    return `${loc.origin}${path}`;
  } catch {
    return 'unknown';
  }
}

/** Origin-level key, used for the per-site enable toggle. */
export function originKey(loc = location) {
  try {
    return loc.origin;
  } catch {
    return 'unknown';
  }
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return String(value).replace(/["\\\]\[#.:>+~*^$|()=\s]/g, '\\$&');
}

function cssEscapeAttr(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}
