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
};

export const DEFAULT_PREFS = {
  /** Panel starts collapsed to a chip rather than fully open. */
  startCollapsed: false,
  /** Poll interval for input values, ms. Set 0 to rely on events only. */
  pollMs: 400,
  /** Clear the manually typed home value when the record changes. */
  resetValueOnNewRecord: true,
  /** Closing costs assumption used when nothing is entered. */
  defaultClosingCosts: 0,
  /** Show the "look up value" links built from the scraped address. */
  showLookupLinks: true,
  /** Treat the VA funding fee as financed. */
  financeFee: true,
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

export { KEYS };
