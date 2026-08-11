/**
 * chrome.storage wrapper.
 *
 * Everything lives in chrome.storage.local — nothing is synced to a Google
 * account and nothing leaves the browser. Lead data is never persisted; only
 * settings, per-site field bindings, and the enabled-site list are stored.
 */

const KEYS = {
  enabledSites: 'enabledSites',
  bindings: 'bindings',
  rules: 'ruleOverrides',
  prefs: 'prefs',
  panelPos: 'panelPos',
  applications: 'applications',
};

export const DEFAULT_PREFS = {
  /** Panel starts collapsed to a chip rather than fully open. */
  startCollapsed: false,
  /** The application drawer is open when the panel loads. */
  startWithApplication: true,
  /** Poll interval for input values, ms. Set 0 to rely on events only. */
  pollMs: 400,
  /** Clear the manually typed home value when the record changes. */
  resetValueOnNewRecord: true,
  /** Closing costs assumption used when nothing is entered. */
  defaultClosingCosts: 0,
  /** Show the "look up value" links built from the scraped address. */
  showLookupLinks: true,
  /**
   * Read the home value from a Zillow or Redfin tab you have open and offer
   * it to the panel. Only the value and the property address are read, only
   * on property pages, and only once you have enabled at least one site.
   */
  readValuationSites: true,
  /**
   * Open the value lookup automatically in a background tab as soon as the
   * address is known. Off by default: it opens a tab on the agent's behalf,
   * which should be a deliberate choice rather than a surprise.
   */
  autoLookup: false,
  /**
   * Standing assumptions. These live here rather than on the panel because
   * they are shop policy, not per-call decisions — they should apply to every
   * record automatically without an agent remembering to set them.
   */
  financeFee: true,          // finance the upfront fee into the loan
  feeExempt: false,          // VA funding fee exemption (service-connected disability)
  subsequentUse: false,      // VA subsequent-use funding fee tier
  valueIsAvm: false,         // treat every value as an automated estimate
  ltvOverride: '',           // blank = use the program maximum
  loanLimit: '',             // blank = no county / investor ceiling
};

async function get(key, fallback) {
  try {
    const out = await chrome.storage.local.get(key);
    return out?.[key] ?? fallback;
  } catch {
    return fallback;
  }
}

async function set(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    /* storage unavailable (e.g. restricted page) — run with defaults */
  }
}

/* --- per-site enablement ------------------------------------------------ */

export async function getEnabledSites() {
  return get(KEYS.enabledSites, {});
}

export async function isSiteEnabled(origin) {
  const sites = await getEnabledSites();
  return sites[origin] === true;
}

/**
 * True when the user has enabled the panel somewhere. Valuation-site reading
 * stays off entirely until then, so a fresh install reads nothing anywhere.
 */
export async function anySiteEnabled() {
  const sites = await getEnabledSites();
  return Object.keys(sites).length > 0;
}

export async function setSiteEnabled(origin, enabled) {
  const sites = await getEnabledSites();
  if (enabled) sites[origin] = true;
  else delete sites[origin];
  await set(KEYS.enabledSites, sites);
  return sites;
}

/* --- field bindings ----------------------------------------------------- */

/**
 * bindings = { [pageKey]: { [fieldKey]: { selector, label, boundAt } } }
 */
export async function getBindings(page) {
  const all = await get(KEYS.bindings, {});
  return page ? (all[page] ?? {}) : all;
}

export async function setBinding(page, fieldKey, binding) {
  const all = await get(KEYS.bindings, {});
  all[page] = all[page] ?? {};
  if (binding) all[page][fieldKey] = binding;
  else delete all[page][fieldKey];
  if (Object.keys(all[page]).length === 0) delete all[page];
  await set(KEYS.bindings, all);
  return all[page] ?? {};
}

export async function clearBindings(page) {
  const all = await get(KEYS.bindings, {});
  delete all[page];
  await set(KEYS.bindings, all);
}

/* --- rules -------------------------------------------------------------- */

export async function getRuleOverrides() {
  return get(KEYS.rules, null);
}

export async function setRuleOverrides(overrides) {
  await set(KEYS.rules, overrides);
}

/* --- prefs -------------------------------------------------------------- */

export async function getPrefs() {
  const stored = await get(KEYS.prefs, {});
  return { ...DEFAULT_PREFS, ...stored };
}

export async function setPrefs(patch) {
  const current = await getPrefs();
  const next = { ...current, ...patch };
  await set(KEYS.prefs, next);
  return next;
}

/* --- panel position ----------------------------------------------------- */

export async function getPanelPos() {
  return get(KEYS.panelPos, null);
}

export async function setPanelPos(pos) {
  await set(KEYS.panelPos, pos);
}

/* --- saved applications ------------------------------------------------- */

/** Newest first. Capped so storage cannot grow without bound. */
export async function getApplications() {
  return get(KEYS.applications, []);
}

export async function saveApplication(record) {
  const all = await getApplications();
  all.unshift({ ...record, savedAt: Date.now() });
  await set(KEYS.applications, all.slice(0, 200));
  return all.length;
}

export async function deleteApplication(savedAt) {
  const all = await getApplications();
  await set(KEYS.applications, all.filter((a) => a.savedAt !== savedAt));
}

export async function clearApplications() {
  await set(KEYS.applications, []);
}

export { KEYS };
