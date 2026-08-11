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
import { mergeRules, normalizeProgram, normalizeState } from '../lib/rules.js';
import { parseMoney, parsePercent, formatMoney, formatPercent } from '../lib/money.js';
import { resolveSelector, pageKey, originKey } from '../lib/selector.js';
import {
  isSiteEnabled, setSiteEnabled, getBindings, setBinding,
  getRuleOverrides, getPrefs, getPanelPos, setPanelPos, setPrefs,
} from '../lib/settings.js';
import { Panel } from './panel.js';
import { pickElement } from './picker.js';

const IS_TOP = window.top === window;

/** Fields the agent can type over. */
const EDITABLE = ['propertyValue', 'firstLien', 'secondLien', 'program', 'state'];

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
    recompute();
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

/** Look for "RECORD ID: 12345" / "UID: V811..." style identifiers. */
function findRecordId() {
  const text = document.body?.innerText?.slice(0, 4000) ?? '';
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

function recompute() {
  if (!IS_TOP || !state.panel) return;

  const inputs = effectiveInputs();

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

  state.lastResult = result;
  state.lastInputs = inputs;

  state.panel.render({
    inputs,
    overrides: state.overrides,
    result,
    recordLabel: state.recordLabel,
    live: state.running,
    picking: state.picking,
    showLookupLinks: state.prefs?.showLookupLinks !== false,
  });
}

/**
 * Merge, in priority order: what the agent typed > bound field > auto-detected
 * in this frame > auto-detected in a child frame.
 */
function effectiveInputs() {
  const out = {};
  const keys = new Set([...Object.keys(FIELDS), ...EDITABLE]);

  for (const key of keys) {
    const manual = state.manual[key];
    const local = state.detected[key];
    const frame = state.frameFields[key];

    let raw;
    let source = 'none';
    let sourceLabel = null;
    let isAvm = false;

    if (manual != null && manual !== '') {
      raw = manual;
      source = 'manual';
    } else if (local?.raw != null && String(local.raw).trim() !== '') {
      raw = local.raw;
      source = local.source === 'bound' ? 'bound' : 'auto';
      sourceLabel = local.label;
      isAvm = !!local.isAvm;
    } else if (frame?.raw != null && String(frame.raw).trim() !== '') {
      raw = frame.raw;
      source = frame.source === 'bound' ? 'bound' : 'auto';
      sourceLabel = `${frame.label} (frame)`;
      isAvm = !!frame.isAvm;
    } else if (manual === '') {
      raw = '';
      source = 'manual';
    } else {
      raw = '';
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

function isImplausible(key, num) {
  const range = FIELDS[key]?.range;
  if (!range || num == null) return false;
  return num < range[0] || num > range[1];
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
