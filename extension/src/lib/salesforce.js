/**
 * Handing an application to Salesforce.
 *
 * The target is the LO Mortgage Application form — the Experience Cloud page
 * and the App Sheet tab on a Lead both render the same component. There is no
 * API involved: the form is filled the way a person fills it, by finding each
 * field by its visible label and typing into it.
 *
 * Why that route rather than the REST API. The API is the better integration
 * and needs a Connected App, OAuth, and the org's custom field API names —
 * all of which need a Salesforce administrator. Filling the rendered form
 * needs none of that and works today.
 *
 * Two kinds of field are handled quite differently:
 *
 *   - Plain inputs are typed into.
 *   - Lookups (Lead, Loan Officer, Transfer Agent) store a record id, not
 *     text. Typing a name into one and walking away leaves a field that looks
 *     complete and holds nothing, so each has to be searched and then picked.
 *     See content/lookup.js for how, and how strictly.
 *
 * Anything S.A.M never captured — SSN, DOB, employer, email — stays blank. A
 * blank is honest; a guess is not.
 *
 * Pure and DOM-free, so the mapping can be checked without an org in front
 * of it.
 */

import { splitName } from './names.js';

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
 * Matched against the visible label, most specific first, so "Borrower
 * Income" wins over a bare "Income" and "Loan FICO" over "FICO".
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
 * Lookup fields, and where their search term comes from.
 *
 *   'borrowerName'  — the borrower on screen, for the Lead
 *   'setting:<key>' — a standing default from Settings, for the people who
 *                     are the same on every application an agent sends
 */
export const LOOKUP_MAP = [
  { key: 'lead', label: 'Lead', labels: [/^\s*lead\s*$/i], source: 'borrowerName' },
  { key: 'loanOfficer', label: 'Loan Officer', labels: [/^\s*\*?\s*loan officer\s*$/i], source: 'setting:loanOfficer' },
  { key: 'transferAgent', label: 'Transfer Agent', labels: [/^\s*transfer agent\s*$/i], source: 'setting:transferAgent' },
  { key: 'loanOfficerAssistant', label: 'Loan Officer Assistant', labels: [/^\s*loan officer assistant\s*$/i], source: 'setting:loanOfficerAssistant' },
];

/** Settings keys that hold a standing lookup default. */
export const LOOKUP_SETTINGS = LOOKUP_MAP
  .filter((l) => l.source.startsWith('setting:'))
  .map((l) => ({ key: l.source.slice('setting:'.length), label: l.label }));

/**
 * Fields the form asks for that S.A.M has no honest source for. Reported so
 * the agent is told what is still theirs rather than discovering it at submit.
 */
export const UNSUPPLIED = [
  'Email', 'Middle Name', 'Suffix', 'Employer', 'Length of Employment',
  'Title', 'Borrower DOB', 'SSN', 'Marital Status', 'Disability Income',
  'Other Income', 'SSI',
];

/** Build the search term for each lookup from the record and the settings. */
export function planLookups(application, defaults = {}) {
  const borrowerName = String(application?.fullName?.value ?? '').trim();

  const entries = [];
  for (const lookup of LOOKUP_MAP) {
    let term = '';
    if (lookup.source === 'borrowerName') {
      term = borrowerName;
    } else if (lookup.source.startsWith('setting:')) {
      term = String(defaults[lookup.source.slice('setting:'.length)] ?? '').trim();
    }
    if (!term) continue;
    entries.push({ key: lookup.key, label: lookup.label, labels: lookup.labels, term });
  }
  return entries;
}

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
 * Returns { entries, lookups, missing } — plain fields to fill, lookups to
 * search and select, and fields the form wants that S.A.M never captured.
 */
export function planFill(application, {
  includeCoBorrower = false, lookupDefaults = {}, addressParts = {},
} = {}) {
  const entries = [];

  // S.A.M holds one name; the form wants two. Split here rather than making
  // an agent type the same name twice.
  // The form wants the address in four boxes; S.A.M holds it as one line for
  // the agent and keeps the parts it was assembled from. Without them these
  // four entries matched nothing and the property address never left the
  // panel — a blank that looked like a mapping problem and was a plumbing one.
  const named = { ...application };
  for (const part of ['street', 'city', 'state', 'zip']) {
    const value = String(addressParts?.[part] ?? '').trim();
    if (value) named[part] = { value };
  }

  for (const [whole, first, last] of [
    ['fullName', 'firstName', 'lastName'],
    ['coFullName', 'coFirstName', 'coLastName'],
  ]) {
    const value = application?.[whole]?.value;
    if (!value) continue;
    const parts = splitName(value);
    named[first] = { value: parts.first };
    named[last] = { value: [parts.last, parts.suffix].filter(Boolean).join(' ') };
  }

  const collect = (map, section) => {
    for (const field of map) {
      const value = plainValue(field.key, named?.[field.key]?.value);
      if (!value) continue;
      entries.push({ key: field.key, section, labels: field.labels, value });
    }
  };

  collect(FIELD_MAP, 'borrower');
  if (includeCoBorrower) collect(CO_FIELD_MAP, 'coBorrower');

  return {
    entries,
    lookups: planLookups(application, lookupDefaults),
    missing: [...UNSUPPLIED],
  };
}
