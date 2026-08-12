/**
 * Filling a Salesforce lookup.
 *
 * A lookup is not a text box. It stores a record id, and the text shown is
 * only a label for whatever was picked. Typing a name into one and walking
 * away leaves a field that looks complete and holds nothing — worse than
 * leaving it empty, because nobody goes back to check a filled-looking field.
 *
 * So this does what a person does: type, wait for the result list, click the
 * matching row. And it is deliberately strict about "matching". Searching
 * "Richard" on a real org returns Richard Howell, Richard Sasko, Richard
 * Warren, Richard Brownell and Richard Mendoza. Taking the first is not
 * matching, it is guessing, and a guess here attaches an application to
 * somebody else's file.
 *
 * The rule: exactly one result must match the whole search term. Zero, or
 * more than one, and the field is left alone with the reason reported.
 */

const OPTION_SELECTOR = '[role="option"], lightning-base-combobox-item, .slds-listbox__option';
const RESULT_TIMEOUT_MS = 4000;
const POLL_MS = 120;
const SETTLE_MS = 250;

/** Every root results could render into, shadow roots included. */
function* allRoots(root = document, depth = 0) {
  yield root;
  if (depth > 6) return;
  let elements = [];
  try {
    elements = root.querySelectorAll('*');
  } catch {
    return;
  }
  for (const el of elements) {
    if (el.shadowRoot) yield* allRoots(el.shadowRoot, depth + 1);
  }
}

function visibleOptions() {
  const found = [];
  for (const root of allRoots()) {
    let nodes = [];
    try {
      nodes = root.querySelectorAll(OPTION_SELECTOR);
    } catch {
      continue;
    }
    for (const node of nodes) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || (rect.width === 0 && rect.height === 0)) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) found.push({ node, text });
    }
  }
  return found;
}

/** Case, punctuation and spacing all vary; compare on words alone. */
function normalise(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Options containing every word of the search term.
 *
 * The caller searches by the *whole* name precisely so a partial is not
 * treated as a hit — "RICHARD" alone must never resolve to Richard Howell.
 */
export function matchesFor(options, term) {
  const wanted = normalise(term);
  if (!wanted) return [];
  const words = wanted.split(' ');
  return options.filter(({ text }) => {
    const haystack = normalise(text).split(' ');
    return words.every((word) => haystack.includes(word));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Search a lookup and select the single matching record.
 *
 * Returns { key, ok, reason, matched }. Never throws, and never picks when
 * the answer is ambiguous.
 */
export async function fillLookup(input, { key, term }, { setValue, readOptions = visibleOptions } = {}) {
  if (!input || !term) return { key, ok: false, reason: 'no-field' };

  try {
    input.focus?.();
    setValue(input, term);
  } catch {
    return { key, ok: false, reason: 'no-field' };
  }

  const deadline = Date.now() + RESULT_TIMEOUT_MS;
  let options = [];

  while (Date.now() < deadline) {
    await wait(POLL_MS);
    options = readOptions();
    if (options.length) {
      // Rows can arrive one at a time; let the list settle before deciding
      // whether a match is unique.
      await wait(SETTLE_MS);
      options = readOptions();
      break;
    }
  }

  if (!options.length) return { key, ok: false, reason: 'no-results' };

  const matches = matchesFor(options, term);
  if (matches.length === 0) return { key, ok: false, reason: 'no-match' };
  if (matches.length > 1) return { key, ok: false, reason: 'ambiguous', matched: matches.length };

  try {
    matches[0].node.click();
  } catch {
    return { key, ok: false, reason: 'not-selectable' };
  }

  await wait(200);
  return { key, ok: true, matched: matches[0].text };
}
