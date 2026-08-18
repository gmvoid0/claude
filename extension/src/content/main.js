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
import { computeEquity } from '../lib/equity.js';
import { estimateClosingCosts, closingCostText } from '../lib/closing.js';
import { mergeRules, normalizeState } from '../lib/rules.js';
import { parseMoney, parsePercent, formatMoney, formatPercent } from '../lib/money.js';
import { resolveSelector, pageKey, originKey } from '../lib/selector.js';
import { extractValuation, valuationSite, detectChallenge } from '../lib/valuation.js';
import { zillowSearchUrl, redfinSearchUrl } from '../lib/address.js';
import { mergeInputs, decideExternalValue, leadAddress, carryForwardDetection, detectionSignature }
  from '../lib/merge.js';
import {
  isSiteEnabled, setSiteEnabled, getBindings, setBinding, anySiteEnabled,
  getRuleOverrides, getPrefs, getPanelPos, setPanelPos, getPanelSize, setPanelSize, setPrefs,
} from '../lib/settings.js';
import {
  buildApplication, filledCount, isWorthSaving, impliesFeeExemption, toText, toPlain,
} from '../lib/application.js';
import { saveApplication } from '../lib/settings.js';
import { renderDocument } from '../lib/document.js';
import { buildApplicationDocument, applicationFilename } from '../lib/application-pdf.js';
import { Panel } from './panel.js';
import { pickElement } from './picker.js';
import { fillForm, fillLookups } from './fill.js';
import { isSalesforceHost, planFill, LOOKUP_MAP } from '../lib/salesforce.js';

const IS_TOP = window.top === window;

/** Fields the agent can type over. */
const EDITABLE = ['propertyValue', 'firstLien', 'secondLien', 'program', 'state'];

/**
 * Application fields that are a calculator input wearing a different label.
 * Editing one of these on the form drives the estimator too, so the two
 * halves of the panel can never show different numbers for the same thing.
 */
const APPLICATION_TO_INPUT = {
  value: 'propertyValue',
  balance: 'firstLien',
  loanType: 'program',
};

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
  app: {},               // application fields the agent typed
  appDraft: null,        // unsaved application carried over from the last record
  coBorrower: false,     // second borrower section shown
  frameFields: {},       // fields harvested from child frames
  externalValue: null,   // latest value seen on a Zillow/Redfin tab
  lookupBlocked: null,   // a lookup page is asking for human verification
  miniOpen: false,       // the mini browser window is up
  miniAddress: null,     // the address it is currently showing
  miniDismissed: false,  // the agent closed it; stop opening it on its own
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
      const reporter = startValuationReporter(site);
      // Honour the setting being switched off without needing a reload.
      chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg?.type !== 'SAM_SETTINGS_CHANGED') return;
        const prefs = await getPrefs();
        if (prefs.readValuationSites === false) reporter.stop();
      });
    }
    return;
  }

  // On a Salesforce application page this runs as a receiver: it renders
  // nothing and waits to be handed an application to type in.
  if (isSalesforceHost(location.hostname)) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type !== 'SAM_FILL_FORM') return;
      applyHandoff(msg.plan).then(sendResponse);
      return true;   // the lookups are asynchronous
    });
    // A form opened after the send still collects what is waiting.
    claimPendingHandoff();
    return;
  }

  state.rules = mergeRules(await getRuleOverrides());
  state.enabled = await isSiteEnabled(state.origin);

  state.overrides = overridesFromPrefs(state.prefs);

  chrome.runtime.onMessage.addListener(handleMessage);

  if (state.enabled) await activate();
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

function handleMessage(msg, _sender, sendResponse) {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'SAM_PING':
      sendResponse({
        ok: true,
        enabled: state.enabled,
        top: IS_TOP,
        page: state.page,
        origin: state.origin,
        summary: state.lastResult ? summarize(state.lastResult) : null,
      });
      return true;

    case 'SAM_SET_ENABLED':
      state.enabled = !!msg.enabled;
      if (state.enabled) activate();
      else deactivate();
      sendResponse({ ok: true, enabled: state.enabled });
      return true;

    case 'SAM_FOCUS_VALUE':
      state.panel?.focusValue();
      sendResponse({ ok: true });
      return true;

    case 'SAM_FRAME_FIELDS':
      // Relayed up from a child frame by the service worker.
      if (IS_TOP && msg.fields) {
        state.frameFields = msg.fields;
        scheduleRecompute();
      }
      return;

    case 'SAM_EXTERNAL_VALUE':
      if (IS_TOP && msg.valuation) {
        state.externalValue = msg.valuation;
        // A value arriving is proof the check was cleared.
        state.lookupBlocked = null;
        recompute();
      }
      return;

    case 'SAM_LOOKUP_BLOCKED':
      if (IS_TOP) {
        state.lookupBlocked = { site: msg.site ?? 'The lookup site', at: Date.now() };
        recompute();
      }
      return;

    case 'SAM_MINI_CLOSED':
      // Closed with the window's own button rather than ours. Same meaning:
      // they want it gone, so it does not come back on the next record.
      state.miniOpen = false;
      state.miniAddress = null;
      state.miniDismissed = true;
      state.panel?.setMiniOpen(false);
      return;

    case 'SAM_SETTINGS_CHANGED':
      reloadSettings();
      return;
  }
}

async function reloadSettings() {
  state.prefs = await getPrefs();
  state.rules = mergeRules(await getRuleOverrides());
  state.bindings = await getBindings(state.page);
  // Standing assumptions changed in settings must take effect immediately,
  // on this record, without a reload.
  state.overrides = overridesFromPrefs(state.prefs);
  state.avmTouched = false;
  scheduleRecompute();
}

/**
 * Panel key -> the preference that stores it.
 *
 * Closing costs is the one that differs: the panel calls it what it is, the
 * setting has always been named for the fact that it is a default.
 */
const OVERRIDE_PREFS = {
  ltvOverride: 'ltvOverride',
  loanLimit: 'loanLimit',
  closingCosts: 'defaultClosingCosts',
  financeFee: 'financeFee',
  feeExempt: 'feeExempt',
  subsequentUse: 'subsequentUse',
  valueIsAvm: 'valueIsAvm',
};

async function persistOverride(key, value) {
  const pref = OVERRIDE_PREFS[key];
  if (!pref) return;
  try {
    await setPrefs({ [pref]: value });
    state.prefs = { ...state.prefs, [pref]: value };
  } catch { /* storage unavailable; it still applies to this session */ }
}

/**
 * The standing assumptions, as configured. Rebuilt from preferences whenever
 * settings change and on every new record, so a shop's policy is applied to
 * every call rather than depending on an agent setting it by hand.
 */
function overridesFromPrefs(prefs = {}) {
  return {
    closingCosts: prefs.defaultClosingCosts ? String(prefs.defaultClosingCosts) : '',
    ltvOverride: prefs.ltvOverride ?? '',
    loanLimit: prefs.loanLimit ?? '',
    financeFee: prefs.financeFee !== false,
    feeExempt: !!prefs.feeExempt,
    subsequentUse: !!prefs.subsequentUse,
    valueIsAvm: !!prefs.valueIsAvm,
  };
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
function startValuationReporter(site) {
  let lastSignature = null;
  let lastRunAt = 0;
  let stopped = false;
  let challengeReported = false;

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

    if (!found) {
      // No value and a bot check on screen: this tab is stuck behind a
      // human verification. Say so, so it can be put in front of a human
      // rather than expiring unseen in the background.
      reportChallenge();
      return;
    }
    challengeReported = false;

    const signature = `${found.value}|${found.address}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    try {
      chrome.runtime.sendMessage({ type: 'SAM_VALUATION_REPORT', valuation: found });
    } catch { /* worker asleep or context torn down */ }
  };

  function reportChallenge() {
    if (challengeReported) return;
    const challenge = detectChallenge(document);
    if (!challenge) return;

    challengeReported = true;
    try {
      chrome.runtime.sendMessage({
        type: 'SAM_VALUATION_BLOCKED',
        site: site?.label ?? 'The lookup site',
        kind: challenge.kind,
        url: location.href,
      });
    } catch { /* worker asleep or context torn down */ }
  }

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
        // Recompute first so the figure moves under the agent's finger, then
        // persist. These are standing assumptions: one flipped on the panel
        // is meant to hold for every call after it, not just this one.
        recompute();
        persistOverride(key, value);
      },
      onPick: (field) => beginPick(field),
      onApplicationChange: (field, value) => {
        state.app[field] = value;
        // Some of the form is the calculator's own inputs under another
        // label. Correcting the balance on the application and watching the
        // cash-out figure not move would read as the tool being broken —
        // and the agent would be right.
        const mirrored = APPLICATION_TO_INPUT[field];
        if (mirrored) state.manual[mirrored] = value;
        recompute();
      },
      onSaveApplication: () => persistApplication(state.lastApplication, state.recordLabel),
      onCopyApplication: () => copyApplication(),
      onSendToSalesforce: () => sendToSalesforce(),
      onSaveDraft: () => {
        if (state.appDraft) {
          persistApplication(state.appDraft.application, state.appDraft.label, {
            result: state.appDraft.result,
          });
        }
        state.appDraft = null;
        recompute();
      },
      onDiscardDraft: () => {
        state.appDraft = null;
        recompute();
      },
      onCoBorrowerToggle: (on) => {
        state.coBorrower = on;
        if (!on) {
          // Hiding the section discards its entries rather than keeping them
          // invisibly attached to the file.
          for (const key of Object.keys(state.app)) {
            if (key.startsWith('co')) delete state.app[key];
          }
        }
        recompute();
      },
      onMiniBrowser: () => toggleMiniBrowser(),
      onUseExternal: () => {
        const ext = state.externalValue;
        if (!ext?.value) return;
        state.manual.propertyValue = String(ext.value);
        state.overrides.valueIsAvm = true;
        state.avmTouched = true;
        recompute();
      },
      onTakeHomeChange: (field, value) => {
        recompute();
      },
      onCopy: () => copySummary(),
      onReset: () => {
        state.manual = {};
        state.app = {};
        state.overrides = overridesFromPrefs(state.prefs);
        state.avmTouched = false;
        scan(true);
      },
      onClose: async () => {
        await setSiteEnabled(state.origin, false);
        state.enabled = false;
        deactivate();
      },
      onCollapse: (collapsed) => setPrefs({ startCollapsed: collapsed }),
      onDrawerToggle: (open) => setPrefs({ startWithApplication: open }),
      onMove: (pos) => setPanelPos(pos),
      onResize: (size) => setPanelSize(size),
    });

    state.panel.mount({
      collapsed: !!state.prefs.startCollapsed,
      pos: await getPanelPos(),
      size: await getPanelSize(),
    });

    // The application is the point of the tool, not an extra, so it is open
    // unless the agent has closed it.
    if (state.prefs.startWithApplication !== false) state.panel.toggleDrawer(true);

    window.addEventListener('keydown', onHotkey, true);

    // A valuation tab may have been read before this panel existed.
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SAM_REQUEST_VALUATION' });
      if (res?.valuation) state.externalValue = res.valuation;
    } catch { /* worker asleep; the next report will push it */ }

    // A preview window outlives a reload of the dialer tab, so ask rather
    // than assume — otherwise the button offers to open a second one.
    try {
      const mini = await chrome.runtime.sendMessage({ type: 'SAM_MINI_STATE' });
      state.miniOpen = !!mini?.open;
      state.miniAddress = mini?.address ?? null;
      state.panel.setMiniOpen(state.miniOpen);
    } catch { /* worker asleep; the button assumes closed */ }
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
  } else if (key === 'a') {
    e.preventDefault();
    state.panel?.toggleDrawer();
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
  if (e.target?.closest?.('#__sam_panel_host__')) return;
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

  const scanned = harvest();

  // Hold briefly onto fields a single scan failed to see, so a repaint on the
  // host page does not blink values out of the panel.
  const detected = carryForwardDetection(state.detected, scanned);

  const recordKey = buildRecordKey(detected);
  const signature = detectionSignature(detected);

  const recordChanged = recordKey && recordKey !== state.recordKey;

  if (recordChanged) {
    state.recordKey = recordKey;
    // Whatever the last lookup ran into belonged to the last caller.
    state.lookupBlocked = null;
    if (state.prefs?.resetValueOnNewRecord) {
      // A new caller is on the line — carrying the last lead's home value
      // forward would silently produce a wrong number, so drop everything
      // the agent typed.
      // The application clears with the record, exactly like the estimator.
      // Anything the agent had actually entered is held as a draft rather
      // than discarded silently — losing a part-filled application because
      // the next call landed would be indefensible.
      if (isWorthSaving(state.lastApplication)) {
        state.appDraft = {
          application: state.lastApplication,
          label: state.recordLabel,
          filled: filledCount(state.lastApplication),
          // The previous caller's figures, so a draft saved later is not
          // quietly costed against whoever is on the phone by then.
          result: state.lastResult,
        };
      }
      state.app = {};
      state.manual = {};
      state.coBorrower = false;
      state.overrides = overridesFromPrefs(state.prefs);
      state.avmTouched = false;
      state.lookupRequestedFor = null;
    }
    // Never let one caller's detected fields survive into the next call.
    state.detected = {};
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
  const surname = detected.lastName?.raw ?? detected.fullName?.raw;
  const parts = [surname, detected.street?.raw, detected.zip?.raw]
    .map((raw) => cleanLabel(raw) ?? '')
    .filter(Boolean);
  return parts.length ? parts.join('|').toLowerCase() : null;
}

function buildRecordLabel(detected) {
  // Split first and last where the screen has them, the whole-name field
  // where it doesn't.
  const name = [detected.firstName?.raw, detected.lastName?.raw]
    .map((s) => cleanLabel(s))
    .filter(Boolean)
    .join(' ') || cleanLabel(detected.fullName?.raw) || '';
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
    && !active.closest?.('#__sam_panel_host__');
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
    chrome.runtime.sendMessage({ type: 'SAM_FRAME_REPORT', fields: slim });
  } catch { /* worker asleep or context torn down */ }
}

/* ------------------------------------------------------------------ *
 * Compute + render
 * ------------------------------------------------------------------ */

function recompute({ forceInputs = false } = {}) {
  if (!IS_TOP || !state.panel) return;

  const inputs = effectiveInputs();
  const external = applyExternalValue(inputs);
  maybeStartLookup(inputs);
  followMiniBrowser(inputs);

  // The AVM flag follows detection until the agent overrides it by hand;
  // the override then sticks until the next record.
  if (!state.avmTouched) {
    state.overrides.valueIsAvm = !!state.prefs?.valueIsAvm || !!inputs.propertyValue.isAvm;
  }

  // Built before the calculation so a disability rating entered on the form
  // can waive the VA funding fee, which is what it does in reality.
  const preliminary = buildApplication({
    inputs, result: state.lastResult, manual: state.app, address: leadAddress(inputs),
    coBorrower: state.coBorrower,
  });
  const feeExempt = !!state.overrides.feeExempt || impliesFeeExemption(preliminary);

  const shared = {
    propertyValue: inputs.propertyValue.num,
    valueIsAvm: !!state.overrides.valueIsAvm,
    firstLien: inputs.firstLien.num,
    secondLien: inputs.secondLien.num,
    program: inputs.program.normalized,
    state: inputs.state.normalized,
    ltvOverride: parseLtv(state.overrides.ltvOverride),
    loanLimit: parseMoney(state.overrides.loanLimit),
    feeExempt,
    subsequentUse: !!state.overrides.subsequentUse,
    financeFee: state.overrides.financeFee !== false,
  };

  // Two passes, because closing costs are charged on a loan amount and the
  // loan amount does not depend on them. The first pass sizes the loan, the
  // estimate is built against it, and the second pass takes the money out.
  // Nothing oscillates: the LTV cap never moves between the two.
  const sized = computeEquity({ ...shared, closingCosts: 0 }, state.rules);
  const closing = estimateClosing(sized, inputs);

  const result = computeEquity({ ...shared, closingCosts: closing.total }, state.rules);
  result.closingEstimate = closing;
  for (const warning of closing.warnings ?? []) result.warnings.push(warning);

  // Lead data routinely carries a loan type the matrix has no meaning for —
  // one of the source screens held an agent ID in that column. Say so rather
  // than leaving an empty dropdown to be read as "nothing detected".
  if (inputs.program.value && !inputs.program.normalized) {
    result.warnings.unshift({
      level: 'warn',
      text: `Loan type "${truncate(inputs.program.value, 24)}" was not recognised. Pick the program.`,
    });
  }
  // A lookup stuck behind a bot check. Said plainly, because the agent is
  // about to be looking at a verification page and should know why.
  if (state.lookupBlocked && !inputs.propertyValue.value) {
    result.warnings.unshift({
      level: 'warn',
      text: `${state.lookupBlocked.site} is asking to verify you are human. `
        + 'The tab has been brought to the front — clear it and the value comes back here.',
    });
  }

  if (inputs.state.value && !inputs.state.normalized) {
    result.warnings.unshift({
      level: 'warn',
      text: `State "${truncate(inputs.state.value, 24)}" was not recognised, so no state cap is applied.`,
    });
  }

  // Rebuilt against the final figures so Cash-out reflects this calculation.
  const application = buildApplication({
    inputs, result, manual: state.app, address: leadAddress(inputs),
    coBorrower: state.coBorrower,
  });

  state.lastResult = result;
  state.lastInputs = inputs;
  state.lastApplication = application;

  state.panel.render({
    inputs,
    overrides: state.overrides,
    result,
    external,
    recordLabel: state.recordLabel,
    application,
    applicationFilled: filledCount(application),
    canSaveApplication: isWorthSaving(application),
    draft: state.appDraft,
    coBorrower: state.coBorrower,
    forceInputs,
    live: state.running,
    picking: state.picking,
    showLookupLinks: state.prefs?.showLookupLinks !== false,
    showMiniBrowser: state.prefs?.miniBrowser !== false,
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
 * Start the value lookup as soon as the address is known.
 *
 * Off unless switched on, because it opens a tab and that is a visible thing
 * to do on someone's behalf. When it is on, the point is timing: the lookup
 * begins when the record lands rather than when the agent gets round to
 * clicking, so the figure is usually waiting by the time it is wanted.
 */
function maybeStartLookup(inputs) {
  if (state.prefs?.autoLookup !== true) return;

  const address = leadAddress(inputs);
  if (!address) return;
  if (address === state.lookupRequestedFor) return;

  // Nothing to look up if a value is already in hand.
  if (inputs.propertyValue?.value) return;

  state.lookupRequestedFor = address;
  try {
    chrome.runtime.sendMessage({
      type: 'SAM_OPEN_LOOKUP',
      url: zillowSearchUrl(address),
      address,
    });
  } catch { /* worker asleep; the manual link still works */ }
}

/* ------------------------------------------------------------------ *
 * Mini browser
 * ------------------------------------------------------------------ */

/**
 * Open or close the property preview.
 *
 * Nothing opens until this is clicked — the window is a deliberate act, not
 * something that appears on its own when a call lands. Once it is open it
 * follows the record, because a preview showing the previous caller's house
 * is worse than no preview at all.
 */
async function toggleMiniBrowser() {
  if (state.miniOpen) {
    try { await chrome.runtime.sendMessage({ type: 'SAM_CLOSE_MINI' }); }
    catch { /* worker asleep; the window is orphaned but harmless */ }
    state.miniOpen = false;
    state.miniAddress = null;
    state.miniDismissed = true;
    state.panel?.setMiniOpen(false);
    return;
  }

  // Asking for it back cancels the dismissal.
  state.miniDismissed = false;

  const address = leadAddress(state.lastInputs ?? effectiveInputs());
  if (!address) {
    state.panel?.setMiniOpen(false);
    return;
  }

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({
      type: 'SAM_OPEN_MINI',
      url: zillowSearchUrl(address),
      address,
    });
  } catch { /* worker asleep */ }

  state.miniOpen = !!res?.open;
  state.miniAddress = state.miniOpen ? address : null;
  state.panel?.setMiniOpen(state.miniOpen);
}

/**
 * Keep the preview pointed at the record now on screen, and open it in the
 * first place if it is meant to be up.
 *
 * Always unfocused: the agent is typing into the dialer, and a window
 * stealing focus mid-call is how you lose a keystroke into the wrong field.
 * The window appears beside them, it does not take over.
 *
 * `miniDismissed` is the whole reason this does not become a nuisance. An
 * agent who closes the preview has said something, and a tool that reopens
 * it on the next call has not listened. It stays shut until they press the
 * button again.
 */
function followMiniBrowser(inputs) {
  const wanted = state.miniOpen
    || (state.prefs?.miniBrowser !== false
      && state.prefs?.miniBrowserAuto !== false
      && !state.miniDismissed);
  if (!wanted) return;

  const address = leadAddress(inputs);
  if (!address || address === state.miniAddress) return;

  state.miniAddress = address;
  state.miniOpen = true;
  state.panel?.setMiniOpen(true);

  try {
    chrome.runtime.sendMessage({
      type: 'SAM_OPEN_MINI',
      url: zillowSearchUrl(address),
      address,
      focused: false,
    });
  } catch { /* worker asleep; the button still works */ }
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

/* ------------------------------------------------------------------ *
 * Salesforce handoff
 * ------------------------------------------------------------------ */

/** Type the current application into an open Salesforce form. */
async function sendToSalesforce() {
  const inputs = state.lastInputs ?? {};
  const plan = planFill(state.lastApplication, {
    includeCoBorrower: state.coBorrower,
    addressParts: {
      street: inputs.street?.value,
      city: inputs.city?.value,
      state: inputs.state?.normalized ?? inputs.state?.value,
      zip: inputs.zip?.value,
    },
    lookupDefaults: {
      loanOfficer: state.prefs?.loanOfficer ?? '',
      transferAgent: state.prefs?.transferAgent ?? '',
      loanOfficerAssistant: state.prefs?.loanOfficerAssistant ?? '',
    },
  });

  if (!plan.entries.length && !plan.lookups.length) {
    state.panel?.setHandoffResult({
      tone: 'warn',
      text: 'Nothing to send yet.',
      detail: 'Fill in at least a name or a figure first.',
    });
    return;
  }

  state.panel?.setHandoffResult({ tone: 'info', text: 'Sending…' });

  let report = null;
  try {
    report = await chrome.runtime.sendMessage({ type: 'SAM_HANDOFF', plan });
  } catch {
    report = { ok: false, reason: 'no-worker' };
  }

  state.panel?.setHandoffResult(describeHandoff(report));
}

const LOOKUP_REASONS = {
  'no-results': 'no results came back',
  'no-match': 'no record matched that name',
  ambiguous: 'several records matched — pick one yourself',
  'no-field': 'the field was not on the form',
  'not-selectable': 'the result could not be clicked',
};

function describeHandoff(report) {
  if (report?.ok) {
    const filled = report.filled?.length ?? 0;
    const missed = report.notFound?.length ?? 0;

    const label = (key) => LOOKUP_MAP.find((l) => l.key === key)?.label ?? key;
    const linked = (report.lookups ?? []).filter((l) => l.ok);
    const unlinked = (report.lookups ?? []).filter((l) => !l.ok);

    const detail = [];
    if (linked.length) detail.push(`Linked ${linked.map((l) => label(l.key)).join(', ')}.`);
    for (const item of unlinked) {
      detail.push(`${label(item.key)}: ${LOOKUP_REASONS[item.reason] ?? 'not linked'}.`);
    }
    if (missed) detail.push(`${missed} field${missed === 1 ? '' : 's'} could not be matched.`);

    return {
      tone: missed || unlinked.length ? 'warn' : 'ok',
      text: `Filled ${filled} field${filled === 1 ? '' : 's'} in Salesforce.`,
      detail: detail.join(' '),
    };
  }

  const reasons = {
    'no-tab': 'Open the LO Application in another tab, then send again.',
    'no-form': 'That Salesforce tab does not look like the application form.',
    'no-permission': 'S.A.M cannot see your tabs — check the extension permissions.',
    'no-worker': 'The extension background stopped. Reload the tab and try again.',
    'nothing-to-send': 'Nothing to send.',
  };
  return {
    tone: 'bad',
    text: 'Not sent.',
    detail: reasons[report?.reason] ?? 'Salesforce did not accept the handoff.',
  };
}

/**
 * Salesforce side: type a handed-over application into the form.
 *
 * Plain fields first, then the lookups, which are slow because each waits on
 * a search coming back from the server.
 */
async function applyHandoff(plan) {
  if (!plan?.entries?.length && !plan?.lookups?.length) {
    return { ok: false, reason: 'nothing-to-send' };
  }
  try {
    const { filled, notFound } = fillForm(plan.entries ?? []);
    const lookups = await fillLookups(plan.lookups ?? []);
    const ok = filled.length > 0 || lookups.some((l) => l.ok);
    return { ok, filled, notFound, lookups, reason: ok ? null : 'no-form' };
  } catch {
    return { ok: false, reason: 'no-form' };
  }
}

/** Collect anything sent before this form was open. */
async function claimPendingHandoff() {
  try {
    const held = await chrome.runtime.sendMessage({ type: 'SAM_HANDOFF_CLAIM' });
    if (held?.plan) await applyHandoff(held.plan);
  } catch { /* nothing waiting */ }
}

function truncate(text, max) {
  const s = String(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}


/**
 * Closing costs for this file.
 *
 * A figure the agent typed wins outright — they are looking at a Loan
 * Estimate and this is not. Otherwise the costs are estimated from the loan
 * that was just sized, per program, because a cash figure quoted with no
 * costs taken out is the optimistic kind of wrong.
 */
function estimateClosing(sized, inputs) {
  const typed = parseMoney(state.overrides.closingCosts);
  if (typed != null) {
    return { total: typed, items: [], warnings: [], typed: true };
  }
  if (state.prefs?.estimateClosingCosts === false) {
    return { total: 0, items: [], warnings: [], typed: false };
  }

  return {
    ...estimateClosingCosts({
      program: sized.program,
      state: sized.state,
      baseLoan: sized.maxBaseLoan,
      totalLoan: sized.totalLoanAmount,
      // The rate on the screen belongs to the loan being paid off, not the
      // new one, so it is a stand-in rather than a fact. Better than nothing
      // for a fifteen-day interest accrual, and labelled as assumed.
      rate: parsePercent(inputs.interestRate?.value ?? ''),
    }, state.rules?.closing),
    typed: false,
  };
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


/** Store a completed application locally. */
async function persistApplication(application, label, { result = state.lastResult } = {}) {
  if (!application) return;

  let stored = false;
  try {
    await saveApplication({ label: label || 'Unnamed', fields: toPlain(application) });
    stored = true;
  } catch { /* storage unavailable; the sheet is still worth producing */ }

  // The sheet is the point of saving. Somebody has to be handed this file —
  // a loan officer, a processor, an email — and neither the clipboard nor
  // the Salesforce handoff survives that trip.
  let downloaded = false;
  try {
    downloaded = downloadApplicationPdf(application, label, result);
  } catch { /* reported below rather than thrown into a call */ }

  flash(
    downloaded ? 'Saved + PDF' : (stored ? 'Saved' : 'Save failed'),
    state.panel?.els?.btnAppSave,
  );
  recompute();
}

/**
 * Write the application out as a PDF and hand it to the browser.
 *
 * A blob rather than a data URL: Chrome refuses large data: downloads, and a
 * blob URL is the route that does not care how big the file gets. The anchor
 * is created, clicked and removed within the same tick, and the object URL is
 * released a moment later — leaving it alive pins the whole file in memory
 * for the life of the tab, which on a dialer is the whole shift.
 */
function downloadApplicationPdf(application, label, result) {
  const now = new Date();
  const doc = buildApplicationDocument({
    application,
    result,
    recordLabel: label || state.recordLabel,
    coBorrower: state.coBorrower,
    now,
  });

  const bytes = renderDocument(doc);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = applicationFilename({ recordLabel: label || state.recordLabel, application, now });
  link.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

async function copyApplication() {
  const text = toText(state.lastApplication, { heading: state.recordLabel });
  await writeClipboard(text, state.panel?.els?.btnAppCopy);
}

async function copySummary() {
  const text = summaryText(state.lastResult, state.lastInputs, state.recordLabel);
  await writeClipboard(text, state.panel?.els?.btnCopy);
}

async function writeClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied', button);
    return;
  } catch { /* clipboard API needs a secure context; fall through */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); flash('Copied', button); }
  catch { flash('Copy failed', button); }
  ta.remove();
}

function flash(msg, button) {
  const btn = button ?? state.panel?.els?.btnCopy;
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
  if (!r) return 'S.A.M — nothing calculated yet.';
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
  if (r.unfinancedFee) {
    lines.push(`${(r.feeLabel ?? 'Fee').padEnd(15)} ${formatMoney(r.unfinancedFee)}  (due at closing)`);
  }
  lines.push(
    `Total loan:     ${formatMoney(r.totalLoanAmount)}`,
    '',
    `ADVERTISED:     ${formatMoney(r.advertisedCashOut)}   (before fees and costs)`,
    `Closing costs:  ${formatMoney(r.closingCosts)}`,
    `TAKE-HOME:      ${formatMoney(r.estimatedCashToBorrower)}`,
  );

  const itemised = closingCostText(r.closingEstimate);
  if (itemised) lines.push('', 'Closing costs, estimated:', itemised);
  for (const w of r.warnings ?? []) lines.push(`! ${w.text}`);
  lines.push('', 'Estimate only — not a quote or commitment to lend.');
  return lines.join('\n');
}
