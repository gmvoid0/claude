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
  $('readValuationSites').checked = prefs.readValuationSites !== false;
  $('financeFee').checked = prefs.financeFee !== false;
  $('feeExempt').checked = !!prefs.feeExempt;
  $('subsequentUse').checked = !!prefs.subsequentUse;
  $('valueIsAvm').checked = !!prefs.valueIsAvm;
  $('ltvOverride').value = prefs.ltvOverride ?? '';
  $('loanLimit').value = prefs.loanLimit ?? '';
  $('startCollapsed').checked = !!prefs.startCollapsed;
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

  await setRuleOverrides(overrides);

  await setPrefs({
    defaultClosingCosts: parseMoney($('closingCosts').value) ?? 0,
    pollMs: clampInt($('pollMs').value, 0, 5000, 400),
    resetValueOnNewRecord: $('resetValueOnNewRecord').checked,
    showLookupLinks: $('showLookupLinks').checked,
    readValuationSites: $('readValuationSites').checked,
    financeFee: $('financeFee').checked,
    feeExempt: $('feeExempt').checked,
    subsequentUse: $('subsequentUse').checked,
    valueIsAvm: $('valueIsAvm').checked,
    ltvOverride: $('ltvOverride').value.trim(),
    loanLimit: $('loanLimit').value.trim(),
    startCollapsed: $('startCollapsed').checked,
  });

  rules = mergeRules(await getRuleOverrides());
  prefs = await getPrefs();

  notifyContentScripts();
  flash('Saved');
}

async function restoreDefaults() {
  await setRuleOverrides(null);
  await setPrefs({ ...DEFAULT_PREFS });
  rules = mergeRules(null);
  prefs = { ...DEFAULT_PREFS };
  renderPrograms();
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
