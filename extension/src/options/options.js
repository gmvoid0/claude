import { DEFAULT_RULES, mergeRules, PROGRAMS } from '../lib/rules.js';
import { parseMoney, parsePercent } from '../lib/money.js';
import {
  getRuleOverrides, setRuleOverrides, getPrefs, setPrefs, DEFAULT_PREFS,
  getEnabledSites, setSiteEnabled, getBindings, clearBindings,
} from '../lib/settings.js';

const $ = (id) => document.getElementById(id);

let rules = DEFAULT_RULES;
let prefs = DEFAULT_PREFS;

init();

async function init() {
  rules = mergeRules(await getRuleOverrides());
  prefs = await getPrefs();

  renderPrograms();
  renderClosingPrograms();
  renderPrefs();
  await renderSites();
  await renderBindings();

  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', restoreDefaults);
}

function renderPrograms() {
  const tbody = $('programs').querySelector('tbody');
  tbody.textContent = '';

  for (const key of PROGRAMS) {
    const p = rules.programs[key];
    if (!p) continue;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${key}</td>
      <td><input type="text" data-p="${key}" data-k="maxLtv" /></td>
      <td><input type="text" data-p="${key}" data-k="txLtv" /></td>
      <td><input type="text" data-p="${key}" data-k="upfrontFeeRate" /></td>
      <td><input type="text" data-p="${key}" data-k="upfrontFeeRateSubsequent" /></td>
      <td style="text-align:center"><input type="checkbox" data-p="${key}" data-k="feeInsideCap" /></td>
    `;
    tbody.appendChild(tr);

    setVal(tr, 'maxLtv', pctText(p.maxLtv));
    setVal(tr, 'txLtv', pctText(p.stateOverrides?.TX ?? p.maxLtv));
    setVal(tr, 'upfrontFeeRate', pctText(p.upfrontFeeRate));
    setVal(tr, 'upfrontFeeRateSubsequent', pctText(p.upfrontFeeRateSubsequent));
    tr.querySelector('[data-k=feeInsideCap]').checked = !!p.feeInsideCap;
  }
}

/** Per-program closing charges: origination, underwriting, appraisal. */
function renderClosingPrograms() {
  const tbody = $('closingPrograms').querySelector('tbody');
  tbody.textContent = '';
  const c = rules.closing ?? {};

  for (const key of PROGRAMS) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${key}</td>
      <td><input type="text" data-c="${key}" data-k="originationPct" /></td>
      <td><input type="text" data-c="${key}" data-k="underwritingFee" /></td>
      <td><input type="text" data-c="${key}" data-k="appraisal" /></td>
    `;
    tbody.appendChild(tr);
    setVal(tr, 'originationPct', pctText(c.originationPct?.[key] ?? 0));
    setVal(tr, 'underwritingFee', String(c.underwritingFee?.[key] ?? 0));
    setVal(tr, 'appraisal', String(c.appraisal?.[key] ?? 0));
  }
}

function setVal(scope, key, value) {
  const el = scope.querySelector(`[data-k="${key}"]`);
  if (el) el.value = value;
}

function pctText(rate) {
  if (rate == null || !Number.isFinite(rate)) return '';
  return `${+(rate * 100).toFixed(4)}%`;
}

function renderPrefs() {
  $('threshold').value = rules.minCashOutThreshold ?? '';
  $('avmHaircut').value = pctText(rules.avmHaircut ?? 0);
  $('closingCosts').value = prefs.defaultClosingCosts ?? 0;
  $('pollMs').value = prefs.pollMs ?? 400;
  $('resetValueOnNewRecord').checked = prefs.resetValueOnNewRecord !== false;
  $('showLookupLinks').checked = prefs.showLookupLinks !== false;
  $('miniBrowser').checked = prefs.miniBrowser !== false;
  $('miniBrowserAuto').checked = prefs.miniBrowserAuto !== false;
  $('readValuationSites').checked = prefs.readValuationSites !== false;
  $('loanOfficer').value = prefs.loanOfficer ?? '';
  $('transferAgent').value = prefs.transferAgent ?? '';
  $('loanOfficerAssistant').value = prefs.loanOfficerAssistant ?? '';
  $('autoLookup').checked = !!prefs.autoLookup;
  $('ltvOverride').value = prefs.ltvOverride ?? '';
  $('loanLimit').value = prefs.loanLimit ?? '';
  $('startCollapsed').checked = !!prefs.startCollapsed;
  $('estimateClosingCosts').checked = prefs.estimateClosingCosts !== false;

  const c = rules.closing ?? {};
  $('titlePolicyPct').value = pctText(c.titlePolicyPct ?? 0);
  $('titleSearch').value = c.titleSearch ?? 0;
  $('settlementFee').value = c.settlementFee ?? 0;
  $('recordingFees').value = c.recordingFees ?? 0;
  $('creditReport').value = c.creditReport ?? 0;
  $('floodCert').value = c.floodCert ?? 0;
  $('prepaidInterestDays').value = c.prepaidInterestDays ?? 0;
  $('assumedRate').value = pctText(c.assumedRate ?? 0);
  $('discountPointsPct').value = pctText(c.discountPointsPct ?? 0);
  $('transferTaxPct').value = pctText(c.transferTaxPct ?? 0);
  $('propertyTaxRate').value = pctText(c.propertyTaxRate ?? 0);
  $('insuranceRate').value = pctText(c.insuranceRate ?? 0);
  $('escrowMonthsTaxes').value = c.escrowMonthsTaxes ?? 0;
  $('escrowMonthsInsurance').value = c.escrowMonthsInsurance ?? 0;
  $('escrowReserves').value = c.escrowReserves ?? 0;
  $('texasFeeCapPct').value = pctText(c.texasFeeCapPct ?? 0);
}

async function renderSites() {
  const sites = await getEnabledSites();
  const ul = $('sites');
  ul.textContent = '';
  const origins = Object.keys(sites);

  if (!origins.length) {
    ul.innerHTML = '<li class="empty">None yet. Turn the panel on from the toolbar popup while you are on a page.</li>';
    return;
  }

  for (const origin of origins) {
    const li = document.createElement('li');
    li.append(origin);
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      await setSiteEnabled(origin, false);
      await renderSites();
      notifyContentScripts();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

async function renderBindings() {
  const all = await getBindings();
  const ul = $('bindings');
  ul.textContent = '';
  const pages = Object.keys(all);

  if (!pages.length) {
    ul.innerHTML = '<li class="empty">None yet.</li>';
    return;
  }

  for (const page of pages) {
    const fields = Object.keys(all[page]).join(', ');
    const li = document.createElement('li');
    li.append(`${page} → ${fields}`);
    const btn = document.createElement('button');
    btn.textContent = 'Clear';
    btn.addEventListener('click', async () => {
      await clearBindings(page);
      await renderBindings();
      notifyContentScripts();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

async function save() {
  const overrides = { programs: {} };

  for (const key of PROGRAMS) {
    const row = document.querySelector(`[data-p="${key}"]`)?.closest('tr');
    if (!row) continue;

    const maxLtv = parsePercent(row.querySelector('[data-k=maxLtv]').value);
    const txLtv = parsePercent(row.querySelector('[data-k=txLtv]').value);
    const fee = parsePercent(row.querySelector('[data-k=upfrontFeeRate]').value);
    const feeSub = parsePercent(row.querySelector('[data-k=upfrontFeeRateSubsequent]').value);
    const inside = row.querySelector('[data-k=feeInsideCap]').checked;

    const base = DEFAULT_RULES.programs[key];
    const program = {
      maxLtv: maxLtv ?? base.maxLtv,
      upfrontFeeRate: fee ?? 0,
      upfrontFeeRateSubsequent: feeSub ?? fee ?? 0,
      feeInsideCap: inside,
      stateOverrides: {},
    };
    // Only record a Texas override when it is actually tighter.
    if (txLtv != null && txLtv < program.maxLtv) program.stateOverrides.TX = txLtv;

    overrides.programs[key] = program;
  }

  overrides.minCashOutThreshold = parseMoney($('threshold').value) ?? 0;
  overrides.avmHaircut = parsePercent($('avmHaircut').value) ?? 0;
  overrides.closing = readClosingRules();

  await setRuleOverrides(overrides);

  await setPrefs({
    defaultClosingCosts: parseMoney($('closingCosts').value) ?? 0,
    pollMs: clampInt($('pollMs').value, 0, 5000, 400),
    resetValueOnNewRecord: $('resetValueOnNewRecord').checked,
    showLookupLinks: $('showLookupLinks').checked,
    miniBrowser: $('miniBrowser').checked,
    miniBrowserAuto: $('miniBrowserAuto').checked,
    readValuationSites: $('readValuationSites').checked,
    loanOfficer: $('loanOfficer').value.trim(),
    transferAgent: $('transferAgent').value.trim(),
    loanOfficerAssistant: $('loanOfficerAssistant').value.trim(),
    autoLookup: $('autoLookup').checked,
    ltvOverride: $('ltvOverride').value.trim(),
    loanLimit: $('loanLimit').value.trim(),
    startCollapsed: $('startCollapsed').checked,
    estimateClosingCosts: $('estimateClosingCosts').checked,
  });

  rules = mergeRules(await getRuleOverrides());
  prefs = await getPrefs();

  renderClosingPrograms();
  notifyContentScripts();
  flash('Saved');
}

/**
 * Read the closing-cost table back out of the form.
 *
 * Written whole rather than merged: these are one coherent cost model, and
 * half a saved model mixed with half a default is a figure nobody could
 * account for.
 */
function readClosingRules() {
  const base = DEFAULT_RULES.closing;
  const out = {
    ...base,
    originationPct: {},
    underwritingFee: {},
    appraisal: {},
    titlePolicyPct: parsePercent($('titlePolicyPct').value) ?? base.titlePolicyPct,
    titleSearch: parseMoney($('titleSearch').value) ?? 0,
    settlementFee: parseMoney($('settlementFee').value) ?? 0,
    recordingFees: parseMoney($('recordingFees').value) ?? 0,
    creditReport: parseMoney($('creditReport').value) ?? 0,
    floodCert: parseMoney($('floodCert').value) ?? 0,
    prepaidInterestDays: clampInt($('prepaidInterestDays').value, 0, 60, 15),
    assumedRate: parsePercent($('assumedRate').value) ?? base.assumedRate,
    discountPointsPct: parsePercent($('discountPointsPct').value) ?? 0,
    transferTaxPct: parsePercent($('transferTaxPct').value) ?? 0,
    propertyTaxRate: parsePercent($('propertyTaxRate').value) ?? 0,
    insuranceRate: parsePercent($('insuranceRate').value) ?? 0,
    escrowMonthsTaxes: clampInt($('escrowMonthsTaxes').value, 0, 24, 6),
    escrowMonthsInsurance: clampInt($('escrowMonthsInsurance').value, 0, 24, 3),
    escrowReserves: parseMoney($('escrowReserves').value) ?? 0,
    texasFeeCapPct: parsePercent($('texasFeeCapPct').value) ?? base.texasFeeCapPct,
  };

  for (const key of PROGRAMS) {
    const row = document.querySelector(`[data-c="${key}"]`)?.closest('tr');
    if (!row) continue;
    out.originationPct[key] =
      parsePercent(row.querySelector('[data-k=originationPct]').value) ?? 0;
    out.underwritingFee[key] =
      parseMoney(row.querySelector('[data-k=underwritingFee]').value) ?? 0;
    out.appraisal[key] =
      parseMoney(row.querySelector('[data-k=appraisal]').value) ?? 0;
  }
  return out;
}

async function restoreDefaults() {
  await setRuleOverrides(null);
  await setPrefs({ ...DEFAULT_PREFS });
  rules = mergeRules(null);
  prefs = { ...DEFAULT_PREFS };
  renderPrograms();
  renderClosingPrograms();
  renderPrefs();
  notifyContentScripts();
  flash('Defaults restored');
}

function notifyContentScripts() {
  chrome.runtime.sendMessage({ type: 'SAM_BROADCAST_SETTINGS' }).catch(() => {});
}

function clampInt(raw, lo, hi, fallback) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function flash(text) {
  const el = $('status');
  el.textContent = text;
  setTimeout(() => { el.textContent = ''; }, 1800);
}
