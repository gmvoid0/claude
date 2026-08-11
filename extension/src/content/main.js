/**
 * Content-script orchestrator.
 *
 * Responsibilities:
 *   - decide whether this site is enabled at all
 *   - repeatedly harvest field values from the page
 *   - notice when the *record* changes (next call on a dialer) and reset
 *     anything the agent typed for the previous one
 *   - compute and render
 *
 * On why it polls: dialers and CRMs repopulate a form by assigning to
 * `input.value` from JavaScript. That does not mutate an attribute and does
 * not fire an `input` event, so a MutationObserver alone silently misses the
 * next call. Events and mutations are used as fast paths; a short poll is the
 * backstop that actually makes "refresh every time the info refreshes" true.
 */

import { collectCandidates, assignFields, readValue, FIELDS, cleanLabel } from '../lib/detect.js';
import { computeEquity, solveBalanceFromPayment } from '../lib/equity.js';
import { mergeRules, normalizeState } from '../lib/rules.js';
import { parseMoney, parsePercent, formatMoney, formatPercent } from '../lib/money.js';
import { resolveSelector, pageKey, originKey } from '../lib/selector.js';
import { extractValuation, valuationSite } from '../lib/valuation.js';
import { zillowSearchUrl, redfinSearchUrl } from '../lib/address.js';
import { mergeInputs, decideExternalValue, leadAddress } from '../lib/merge.js';
import {
  isSiteEnabled, setSiteEnabled, getBindings, setBinding, anySiteEnabled,
  getRuleOverrides, getPrefs, getPanelPos, setPanelPos, setPrefs,
} from '../lib/settings.js';
import { Panel } from './panel.js';
import { pickElement } from './picker.js';

const IS_TOP = window.top === window;

/** Fields the agent can type over. */
const EDITABLE = ['propertyValue', 'firstLien', 'secondLien', 'program', 'state'];

/** How long a value read from a valuation tab stays usable. */
const VALUATION_TTL_MS = 30 * 60 * 1000;

const state = {
  enabled: false,
  running: false,
  prefs: null,
  rules: null,
  bindings: {},
  page: pageKey(),
  origin: originKey(),

  detected: {},          // fieldKey -> { raw, label, source }
  manual: {},            // fieldKey -> raw string typed by the agent
  overrides: {
    closingCosts: '', ltvOverride: '', loanLimit: '',
    feeExempt: false, subsequentUse: false, financeFee: true,
    valueIsAvm: false,
  },
  avmTouched: false,     // true once the agent sets the AVM flag by hand
  frameFields: {},       // fields harvested from child frames
  externalValue: null,   // latest value seen on a Zillow/Redfin tab
  recordKey: null,
  recordLabel: '',
  lastSignature: '',
  picking: null,
  panel: null,
  timer: null,
  observer: null,
};

export async function start() {
  state.prefs = await getPrefs();

  // On a valuation site this runs as a reporter only: it reads the home value
  // and the property address, hands them to the panel on the dialer tab, and
  // renders nothing itself.
  const site = valuationSite(location.hostname);
  if (site) {
    if (state.prefs.readValuationSites !== false && await anySiteEnabled()) {
      const reporter = startValuationReporter();
      // Honour the setting being switched off without needing a reload.
      chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg?.type !== 'EQ_SETTINGS_CHANGED') return;
        const prefs = await getPrefs();
        if (prefs.readValuationSites === false) reporter.stop();
      });
    }
    return;
  }

  state.rules = mergeRules(await getRuleOverrides());
  state.enabled = await isSiteEnabled(state.origin);

  state.overrides.financeFee = state.prefs.financeFee !== false;
  state.overrides.closingCosts = state.prefs.defaultClosingCosts
    ? String(state.prefs.defaultClosingCosts)
    : '';

  chrome.runtime.onMessage.addListener(handleMessage);

  if (state.enabled) await activate();
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

function handleMessage(msg, _sender, sendResponse) {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'EQ_PING':
      sendResponse({
        ok: true,
        enabled: state.enabled,
        top: IS_TOP,
        page: state.page,
        origin: state.origin,
        summary: state.lastResult ? summarize(state.lastResult) : null,
      });
      return true;

    case 'EQ_SET_ENABLED':
      state.enabled = !!msg.enabled;
      if (state.enabled) activate();
      else deactivate();
      sendResponse({ ok: true, enabled: state.enabled });
      return true;

    case 'EQ_FOCUS_VALUE':
      state.panel?.focusValue();
      sendResponse({ ok: true });
      return true;

    case 'EQ_FRAME_FIELDS':
      // Relayed up from a child frame by the service worker.
      if (IS_TOP && msg.fields) {
        state.frameFields = msg.fields;
        scheduleRecompute();
      }
      return;

    case 'EQ_EXTERNAL_VALUE':
      if (IS_TOP && msg.valuation) {
        state.externalValue = msg.valuation;
        recompute();
      }
      return;

    case 'EQ_SETTINGS_CHANGED':
      reloadSettings();
      return;
  }
}

async function reloadSettings() {
  state.prefs = await getPrefs();
  state.rules = mergeRules(await getRuleOverrides());
  state.bindings = await getBindings(state.page);
  scheduleRecompute();
}

/* ------------------------------------------------------------------ *
 * Valuation-site reporter
 * ------------------------------------------------------------------ */

/**
 * Watch a Zillow/Redfin tab and report the property value it is showing.
 *
 * These sites are single-page apps: navigating between properties swaps the
 * content without a page load, so this re-reads on mutation as well as on a
 * slow interval, and only sends when the value or address actually changes.
 */
function startValuationReporter() {
  let lastSignature = null;
  let lastRunAt = 0;
  let stopped = false;

  const report = () => {
    if (stopped) return;

    // Listing sites mutate the DOM continuously. Extraction scans inline
    // scripts and can fall back to walking the whole document, so it is
    // throttled rather than run on every mutation burst.
    const now = Date.now();
    if (now - lastRunAt < 1000) return;
    lastRunAt = now;

    let found = null;
    try {
      found = extractValuation(document, location);
    } catch { /* markup changed under us; try again next tick */ }
    if (!found) return;

    const signature = `${found.value}|${found.address}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    try {
      chrome.runtime.sendMessage({ type: 'EQ_VALUATION_REPORT', valuation: found });
    } catch { /* worker asleep or context torn down */ }
  };

  const debounced = debounce(report, 400);
  let observer = null;

  report();
  try {
    observer = new MutationObserver(debounced);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* the interval still covers it */ }

  const timer = setInterval(report, 2000);

  return {
    stop() {
      stopped = true;
      observer?.disconnect();
      clearInterval(timer);
    },
  };
}

function debounce(fn, ms) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

async function activate() {
  if (state.running) return;
  state.running = true;

  state.bindings = await getBindings(state.page);

  if (IS_TOP) {
    state.panel = new Panel({
      onManualChange: (field, value) => {
        state.manual[field] = value;
        recompute();
      },
      onOverrideChange: (key, value) => {
        state.overrides[key] = value;
        if (key === 'valueIsAvm') state.avmTouched = true;
        recompute();
      },
      onPick: (field) => beginPick(field),
      onUseExternal: () => {
        const ext = state.externalValue;
        if (!ext?.value) return;
        state.manual.propertyValue = String(ext.value);
        state.overrides.valueIsAvm = true;
        state.avmTouched = true;
        recompute();
      },
      onSolveChange: (fields) => showSolvedBalance(fields),
      onUseSolved: (fields) => {
        const solved = solveFrom(fields);
        if (solved == null) {
          state.panel?.setSolverResult('Enter payment, rate and years left first.');
          return;
        }
        state.manual.firstLien = String(Math.round(solved));
        recompute();
        showSolvedBalance(fields);
      },
      onCopy: () => copySummary(),
      onReset: () => {
        state.manual = {};
        state.overrides.ltvOverride = '';
        state.overrides.loanLimit = '';
        state.avmTouched = false;
        scan(true);
      },
      onClose: async () => {
        await setSiteEnabled(state.origin, false);
        state.enabled = false;
        deactivate();
      },
      onCollapse: (collapsed) => setPrefs({ startCollapsed: collapsed }),
      onMove: (pos) => setPanelPos(pos),
    });

    state.panel.mount({
      collapsed: !!state.prefs.startCollapsed,
      pos: await getPanelPos(),
    });

    window.addEventListener('keydown', onHotkey, true);

    // A valuation tab may have been read before this panel existed.
    try {
      const res = await chrome.runtime.sendMessage({ type: 'EQ_REQUEST_VALUATION' });
      if (res?.valuation) state.externalValue = res.valuation;
    } catch { /* worker asleep; the next report will push it */ }
  }

  installWatchers();
  scan(true);
}

function deactivate() {
  state.running = false;
  clearInterval(state.timer);
  state.timer = null;
  state.observer?.disconnect();
  state.observer = null;
  document.removeEventListener('input', onPageInput, true);
  document.removeEventListener('change', onPageInput, true);
  window.removeEventListener('keydown', onHotkey, true);
  state.panel?.unmount();
  state.panel = null;
}

function onHotkey(e) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const key = e.key?.toLowerCase();
  if (key === 'e') {
    e.preventDefault();
    state.panel?.toggleCollapse();
  } else if (key === 'v') {
    e.preventDefault();
    state.panel?.focusValue();
  }
}

/* ------------------------------------------------------------------ *
 * Watching the page
 * ------------------------------------------------------------------ */

function installWatchers() {
  // Fast path 1: real user edits and well-behaved frameworks.
  document.addEventListener('input', onPageInput, true);
  document.addEventListener('change', onPageInput, true);

  // Fast path 2: structural changes (new form rendered, row swapped).
  state.observer = new MutationObserver(() => scheduleRecompute());
  try {
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['value', 'class', 'style'],
    });
  } catch { /* document not ready — the poll still covers us */ }

  // Backstop: programmatic `.value` assignment fires nothing at all.
  const ms = Number(state.prefs?.pollMs ?? 400);
  if (ms > 0) state.timer = setInterval(() => scan(false), ms);
}

function onPageInput(e) {
  if (e.target?.closest?.('#__equity_lens_host__')) return;
  scheduleRecompute();
}

let pending = null;
function scheduleRecompute() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    scan(false);
  }, 120);
}

/* ------------------------------------------------------------------ *
 * Scanning
 * ------------------------------------------------------------------ */

function scan(force) {
  if (!state.running) return;

  const detected = harvest();
  const recordKey = buildRecordKey(detected);
  const signature = JSON.stringify(detected);

  const recordChanged = recordKey && recordKey !== state.recordKey;

  if (recordChanged) {
    state.recordKey = recordKey;
    if (state.prefs?.resetValueOnNewRecord) {
      // A new caller is on the line — carrying the last lead's home value
      // forward would silently produce a wrong number, so drop everything
      // the agent typed.
      state.manual = {};
      state.overrides.ltvOverride = '';
      state.overrides.loanLimit = '';
      state.avmTouched = false;
    }
  }

  if (!force && !recordChanged && signature === state.lastSignature) return;
  state.lastSignature = signature;
  state.detected = detected;
  state.recordLabel = buildRecordLabel(detected);

  if (IS_TOP) {
    // A record change must overwrite the inputs even where the agent has
    // focus, so the previous caller's figures cannot linger on screen.
    recompute({ forceInputs: recordChanged });
    if (recordChanged) maybeFocusValue();
  } else {
    reportFrameFields(detected);
  }
}

/** Harvest all known fields from this document. */
function harvest() {
  const out = {};

  // 1. Explicit bindings win — the agent told us where to look.
  for (const [fieldKey, binding] of Object.entries(state.bindings ?? {})) {
    const el = resolveSelector(binding.selector);
    if (!el) continue;
    out[fieldKey] = {
      raw: readValue(el),
      label: binding.label ?? 'bound field',
      source: 'bound',
    };
  }

  // 2. Auto-detection for everything still unknown.
  let candidates = [];
  try {
    candidates = collectCandidates(document);
  } catch { /* hostile DOM — fall through with whatever we have */ }

  const assigned = assignFields(candidates);
  for (const [fieldKey, entry] of Object.entries(assigned)) {
    if (out[fieldKey]) continue;
    out[fieldKey] = {
      raw: entry.candidate.raw,
      label: entry.candidate.label,
      source: 'auto',
      score: Math.round(entry.score),
      isAvm: !!entry.candidate.isAvm,
    };
  }

  // 3. Record identifiers, which are usually plain text rather than inputs.
  const id = findRecordId();
  if (id) out.__recordId = { raw: id, label: 'record id', source: 'auto' };

  return out;
}

/**
 * Look for "RECORD ID: 12345" / "UID: V811..." style identifiers.
 *
 * textContent rather than innerText: this runs on every poll tick, and
 * innerText forces a layout pass for a string we only regex over.
 */
function findRecordId() {
  const text = document.body?.textContent?.slice(0, 20000) ?? '';
  const patterns = [
    /\bRECORD\s*ID\s*[:#]?\s*([A-Za-z0-9._-]{3,40})/i,
    /\bLEAD\s*ID\s*[:#]?\s*([A-Za-z0-9._-]{3,40})/i,
    /\bUID\s*[:#]?\s*([A-Za-z0-9._-]{6,40})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function buildRecordKey(detected) {
  if (detected.__recordId?.raw) return `id:${detected.__recordId.raw}`;
  const parts = ['lastName', 'street', 'zip']
    .map((k) => cleanLabel(detected[k]?.raw) ?? '')
    .filter(Boolean);
  return parts.length ? parts.join('|').toLowerCase() : null;
}

function buildRecordLabel(detected) {
  const name = [detected.firstName?.raw, detected.lastName?.raw]
    .map((s) => cleanLabel(s))
    .filter(Boolean)
    .join(' ');
  const place = [cleanLabel(detected.city?.raw), normalizeState(detected.state?.raw)]
    .filter(Boolean)
    .join(', ');
  return [name, place].filter(Boolean).join(' — ');
}

function maybeFocusValue() {
  // Only pull focus if the agent isn't mid-keystroke somewhere on the page.
  const active = document.activeElement;
  const busy = active && active !== document.body
    && active.matches?.('input, select, textarea')
    && !active.closest?.('#__equity_lens_host__');
  if (!busy && !state.panel?.collapsed) state.panel?.focusValue();
}

function reportFrameFields(detected) {
  // Child frames can't talk to the top frame directly across origins, so the
  // service worker relays for them.
  const slim = {};
  for (const [k, v] of Object.entries(detected)) {
    if (v?.raw != null && String(v.raw).trim() !== '') slim[k] = v;
  }
  if (!Object.keys(slim).length) return;
  try {
    chrome.runtime.sendMessage({ type: 'EQ_FRAME_REPORT', fields: slim });
  } catch { /* worker asleep or context torn down */ }
}

/* ------------------------------------------------------------------ *
 * Compute + render
 * ------------------------------------------------------------------ */

function recompute({ forceInputs = false } = {}) {
  if (!IS_TOP || !state.panel) return;

  const inputs = effectiveInputs();
  const external = applyExternalValue(inputs);

  // The AVM flag follows detection until the agent overrides it by hand;
  // the override then sticks until the next record.
  if (!state.avmTouched) state.overrides.valueIsAvm = !!inputs.propertyValue.isAvm;

  const result = computeEquity({
    propertyValue: inputs.propertyValue.num,
    valueIsAvm: !!state.overrides.valueIsAvm,
    firstLien: inputs.firstLien.num,
    secondLien: inputs.secondLien.num,
    program: inputs.program.normalized,
    state: inputs.state.normalized,
    closingCosts: parseMoney(state.overrides.closingCosts) ?? 0,
    ltvOverride: parseLtv(state.overrides.ltvOverride),
    loanLimit: parseMoney(state.overrides.loanLimit),
    feeExempt: !!state.overrides.feeExempt,
    subsequentUse: !!state.overrides.subsequentUse,
    financeFee: state.overrides.financeFee !== false,
  }, state.rules);

  // Lead data routinely carries a loan type the matrix has no meaning for —
  // one of the source screens held an agent ID in that column. Say so rather
  // than leaving an empty dropdown to be read as "nothing detected".
  if (inputs.program.value && !inputs.program.normalized) {
    result.warnings.unshift({
      level: 'warn',
      text: `Loan type "${truncate(inputs.program.value, 24)}" was not recognised. Pick the program.`,
    });
  }
  if (inputs.state.value && !inputs.state.normalized) {
    result.warnings.unshift({
      level: 'warn',
      text: `State "${truncate(inputs.state.value, 24)}" was not recognised, so no state cap is applied.`,
    });
  }

  state.lastResult = result;
  state.lastInputs = inputs;

  state.panel.render({
    inputs,
    overrides: state.overrides,
    result,
    external,
    recordLabel: state.recordLabel,
    forceInputs,
    live: state.running,
    picking: state.picking,
    showLookupLinks: state.prefs?.showLookupLinks !== false,
    lookupUrls: buildLookupUrls(inputs),
  });
}


function buildLookupUrls(inputs) {
  const address = leadAddress(inputs);
  if (!address) return null;
  return {
    address,
    zillow: zillowSearchUrl(address),
    redfin: redfinSearchUrl(address),
  };
}

/**
 * Apply the external-value decision to the merged inputs.
 *
 * The decision itself lives in lib/merge.js so it can be tested; this only
 * carries it out and hands the panel what it needs to render the row.
 */
function applyExternalValue(inputs) {
  const decision = decideExternalValue({
    inputs,
    external: state.externalValue,
    ttlMs: VALUATION_TTL_MS,
  });

  if (decision.status === 'expired') {
    state.externalValue = null;
    return null;
  }
  if (decision.status === 'none') return null;

  if (decision.status === 'applied') inputs.propertyValue = decision.value;

  return {
    ...state.externalValue,
    comparison: decision.comparison,
    applied: decision.status === 'applied',
  };
}

/** Merge every source into one value per field. */
function effectiveInputs() {
  return mergeInputs({
    manual: state.manual,
    detected: state.detected,
    frameFields: state.frameFields,
    keys: [...new Set([...Object.keys(FIELDS), ...EDITABLE])],
  });
}

function truncate(text, max) {
  const s = String(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}


/** "80", "80%", ".8" all mean 80%. Blank means "use the program default". */
function parseLtv(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseMoney(String(raw).replace('%', ''));
  if (n == null || n <= 0) return null;
  return n > 2 ? n / 100 : n;
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

async function beginPick(fieldKey) {
  state.picking = fieldKey;
  recompute();

  const label = FIELDS[fieldKey]?.label ?? fieldKey;
  const result = await pickElement({ prompt: `Click the "${label}" field — Esc to cancel` });

  state.picking = null;

  if (result?.selector) {
    state.bindings = await setBinding(state.page, fieldKey, {
      selector: result.selector,
      label,
      boundAt: Date.now(),
    });
    // A binding supersedes anything typed for that field.
    delete state.manual[fieldKey];
    scan(true);
  } else {
    recompute();
  }
}

/** Reverse a balance out of the payment fields in the panel's solver. */
function solveFrom({ payment, rate, years } = {}) {
  const months = parseMoney(years);
  return solveBalanceFromPayment({
    payment: parseMoney(payment),
    annualRate: parsePercent(rate),
    remainingMonths: months == null ? null : Math.round(months * 12),
  });
}

function showSolvedBalance(fields) {
  const solved = solveFrom(fields);
  state.panel?.setSolverResult(
    solved == null
      ? 'Enter all three to estimate the remaining balance.'
      : `Estimated balance <b>${formatMoney(solved)}</b>`,
  );
}

async function copySummary() {
  const text = summaryText(state.lastResult, state.lastInputs, state.recordLabel);
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied');
  } catch {
    // Clipboard API needs a secure context and permission; fall back.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash('Copied'); }
    catch { flash('Copy failed'); }
    ta.remove();
  }
}

function flash(msg) {
  const btn = state.panel?.els?.btnCopy;
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = original; }, 1200);
}

function summarize(r) {
  return {
    cashOut: r.estimatedCashToBorrower,
    maxLoan: r.maxBaseLoan,
    equity: r.grossEquity,
    currentLtv: r.currentLtv,
    maxLtv: r.maxLtv,
    program: r.programLabel,
    ok: r.ok,
  };
}

function summaryText(r, inputs, recordLabel) {
  if (!r) return 'Equity Lens — nothing calculated yet.';
  const lines = [];
  if (recordLabel) lines.push(recordLabel);
  lines.push(
    `Program:        ${r.programLabel ?? '—'}${r.state ? ` (${r.state})` : ''}`,
    `Home value:     ${formatMoney(r.propertyValue)}`,
    `Liens:          ${formatMoney(r.totalLiens)}`,
    `Gross equity:   ${formatMoney(r.grossEquity)}`,
    `Current LTV:    ${r.currentLtv != null ? formatPercent(r.currentLtv, 1) : '—'}`,
    `Max LTV:        ${r.maxLtv != null ? formatPercent(r.maxLtv, 0) : '—'}  (${r.ltvSource ?? '—'})`,
    `Max loan:       ${formatMoney(r.maxBaseLoan)}`,
  );
  if (r.financedFee) lines.push(`${(r.feeLabel ?? 'Fee').padEnd(15)} ${formatMoney(r.financedFee)}`);
  lines.push(
    `Total loan:     ${formatMoney(r.totalLoanAmount)}`,
    `Closing costs:  ${formatMoney(r.closingCosts)}`,
    `CASH OUT:       ${formatMoney(r.estimatedCashToBorrower)}`,
  );
  for (const w of r.warnings ?? []) lines.push(`! ${w.text}`);
  lines.push('', 'Estimate only — not a quote or commitment to lend.');
  return lines.join('\n');
}
