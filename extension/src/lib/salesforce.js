/**
 * Handing an application to Salesforce.
 *
 * The target is the LO Mortgage Application form — an Experience Cloud page
 * and the App Sheet tab on a Lead both render the same component. There is no
 * API involved here: the form is filled the way a person would fill it, by
 * finding each field by its visible label and typing into it.
 *
 * Why that route rather than the REST API. The API is the better integration
 * and needs a Connected App, OAuth, and the org's custom field API names —
 * all of which need a Salesforce administrator. Filling the rendered form
 * needs none of that and works today. It is also honest about its limits:
 * anything that is not a plain input is left alone.
 *
 * Three kinds of field are deliberately never touched:
 *
 *   - Lookups (Lead, Loan Officer, Transfer Agent). Typing into one does not
 *     select a record; it has to be picked from a dropdown, and a lookup that
 *     looks filled but holds no record is worse than an empty one.
 *   - Picklists (Marital Status). Same reasoning.
 *   - Anything S.A.M never captured: SSN, DOB, employer, email. A blank is
 *     honest; a guess is not.
 *
 * Pure and DOM-free — the mapping is data, so it can be checked without an
 * org in front of it.
 */

/** Hosts where the application form lives. */
export const SALESFORCE_HOSTS = [
  /\.my\.site\.com$/i,
  /\.lightning\.force\.com$/i,
  /\.force\.com$/i,
  /\.salesforce\.com$/i,
];

export function isSalesforceHost(hostname) {
  if (!hostname) return false;
  return SALESFORCE_HOSTS.some((re) => re.test(hostname));
}

/**
 * Application key -> the labels Salesforce renders for it.
 *
 * Matched against the field's visible label, most specific first, so
 * "Borrower Income" wins over a bare "Income" and "Loan FICO" over "FICO".
 */
export const FIELD_MAP = [
  { key: 'firstName', labels: [/^\s*\*?\s*first name\s*$/i] },
  { key: 'lastName', labels: [/^\s*\*?\s*last name\s*$/i] },
  { key: 'fico', labels: [/^\s*loan fico\s*$/i, /^\s*fico\s*$/i, /\bfico\b/i] },
  { key: 'phone', labels: [/^\s*\*?\s*phone\s*$/i, /^\s*mobile\s*$/i] },
  { key: 'income', labels: [/^\s*borrower income\s*$/i, /^\s*income\s*$/i] },
  { key: 'disability', labels: [/^\s*disability\s*%\s*$/i, /\bdisability\s*%/i] },
  { key: 'street', labels: [/^\s*street\s*$/i] },
  { key: 'city', labels: [/^\s*city\s*$/i] },
  { key: 'state', labels: [/^\s*state\s*(\/\s*province)?\s*$/i] },
  { key: 'zip', labels: [/^\s*zip\s*(\/\s*postal code)?\s*$/i, /\bpostal code\b/i] },
];

/** Co-borrower equivalents, matched inside the co-borrower section. */
export const CO_FIELD_MAP = [
  { key: 'coFirstName', labels: [/^\s*\*?\s*first name\s*$/i] },
  { key: 'coLastName', labels: [/^\s*\*?\s*last name\s*$/i] },
  { key: 'coFico', labels: [/^\s*(co-?borrower\s*)?(loan\s*)?fico\s*$/i, /\bfico\b/i] },
  { key: 'coPhone', labels: [/^\s*\*?\s*phone\s*$/i, /^\s*mobile\s*$/i] },
  { key: 'coIncome', labels: [/^\s*(co-?borrower\s*)?income\s*$/i, /\bincome\b/i] },
  { key: 'coDisability', labels: [/^\s*disability\s*%\s*$/i, /\bdisability\s*%/i] },
];

/**
 * Fields the form asks for that S.A.M has no honest source for. Reported so
 * the agent is told what is still theirs to complete rather than discovering
 * it at submit.
 */
export const UNSUPPLIED = [
  'Email', 'Middle Name', 'Suffix', 'Employer', 'Length of Employment',
  'Title', 'Borrower DOB', 'SSN', 'Marital Status', 'Disability Income',
  'Other Income', 'SSI',
];

/** Fields that need a record picked, not text typed. */
export const MANUAL_ONLY = ['Lead', 'Transfer Agent', 'Loan Officer', 'Loan Officer Assistant'];

/**
 * Strip presentation so a figure lands in Salesforce as a number.
 * "$270,900" -> "270900", "6.5%" -> "6.5". Names and addresses pass through.
 */
export function plainValue(key, value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(firstName|lastName|coFirstName|coLastName|street|city|state|phone|coPhone)$/.test(key)) {
    return text;
  }
  const stripped = text.replace(/[$,%\s]/g, '');
  return /^-?\d*\.?\d+$/.test(stripped) ? stripped : text;
}

/**
 * Work out what to type where.
 *
 * Returns { entries, skipped, missing } — entries to fill, fields left to the
 * agent because they need a record picked, and fields the form wants that
 * S.A.M never captured.
 */
export function planFill(application, { includeCoBorrower = false } = {}) {
  const entries = [];

  const collect = (map, section) => {
    for (const field of map) {
      const raw = application?.[field.key]?.value;
      const value = plainValue(field.key, raw);
      if (!value) continue;
      entries.push({ key: field.key, section, labels: field.labels, value });
    }
  };

  collect(FIELD_MAP, 'borrower');
  if (includeCoBorrower) collect(CO_FIELD_MAP, 'coBorrower');

  return {
    entries,
    skipped: [...MANUAL_ONLY],
    missing: [...UNSUPPLIED],
  };
}
