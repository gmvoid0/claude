/**
 * Splitting and joining people's names.
 *
 * S.A.M shows one "Full name" box because that is how an agent thinks and
 * says it. Salesforce wants First Name and Last Name in separate fields, and
 * its Lead lookup is searched by the whole name. So the split has to happen
 * somewhere, and doing it once here beats doing it badly in three places.
 *
 * The rule is that the last word is the surname and everything before it is
 * the given name. That is what the source screens already do — a dialer
 * holding First "RANDY D" and Last "ROLLINS" round-trips through this
 * unchanged — and it beats guessing at middle names, which nothing
 * downstream asks for.
 *
 * Pure and DOM-free.
 */

/** Suffixes that belong with the surname rather than being treated as one. */
const SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'MD', 'PHD', 'DDS', 'ESQ']);

/** Particles that are part of the surname when they precede it. */
const PARTICLES = new Set(['VAN', 'VON', 'DE', 'DEL', 'DELA', 'DI', 'DA', 'LA', 'LE', 'MC', 'MAC', 'ST']);

/**
 * Split a full name into { first, last, suffix }.
 *
 * "Last, First" is handled too, because plenty of systems export names that
 * way and reading one backwards would put a surname on the application as
 * the given name.
 */
export function splitName(full) {
  const text = String(full ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { first: '', last: '', suffix: '' };

  if (text.includes(',')) {
    const [surname, given = ''] = text.split(',', 2).map((part) => part.trim());
    const { words, suffix } = peelSuffix(surname.split(' '));
    return { first: given, last: words.join(' '), suffix };
  }

  const all = text.split(' ');
  if (all.length === 1) return { first: all[0], last: '', suffix: '' };

  const { words, suffix } = peelSuffix(all);
  if (words.length === 1) return { first: words[0], last: '', suffix };

  // Pull a particle into the surname: "RANDY VAN DYKE".
  let cut = words.length - 1;
  while (cut > 1 && PARTICLES.has(words[cut - 1].toUpperCase().replace(/\./g, ''))) cut--;

  return {
    first: words.slice(0, cut).join(' '),
    last: words.slice(cut).join(' '),
    suffix,
  };
}

function peelSuffix(input) {
  const words = [...input];
  let suffix = '';
  if (words.length > 1) {
    const tail = words[words.length - 1].toUpperCase().replace(/\./g, '');
    if (SUFFIXES.has(tail)) suffix = words.pop();
  }
  return { words, suffix };
}

/** Reassemble a display name from separate parts. */
export function joinName({ first = '', last = '', suffix = '' } = {}) {
  return [first, last, suffix]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
