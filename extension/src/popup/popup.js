import { isSiteEnabled, setSiteEnabled } from '../lib/settings.js';
import { formatMoney, formatPercent } from '../lib/money.js';

const els = {
  origin: document.getElementById('origin'),
  enabled: document.getElementById('enabled'),
  note: document.getElementById('note'),
  summary: document.getElementById('summary'),
  cash: document.getElementById('s-cash'),
  loan: document.getElementById('s-loan'),
  ltv: document.getElementById('s-ltv'),
  prog: document.getElementById('s-prog'),
  focus: document.getElementById('focus'),
  options: document.getElementById('options'),
};

let tab = null;
let origin = null;

init();

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    els.origin.textContent = 'Not a web page';
    els.enabled.disabled = true;
    els.focus.disabled = true;
    els.note.textContent = 'Extensions cannot read browser or store pages.';
    return;
  }

  origin = new URL(tab.url).origin;
  els.origin.textContent = origin;
  els.enabled.checked = await isSiteEnabled(origin);

  els.enabled.addEventListener('change', onToggle);
  els.focus.addEventListener('click', onFocus);
  els.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

  refreshSummary();
}

async function onToggle() {
  const enabled = els.enabled.checked;
  await setSiteEnabled(origin, enabled);

  // Broadcast to every frame, not just the top one: an AVM panel or form
  // rendered in an iframe has its own copy of the content script that also
  // needs to start, otherwise it stays dark until the tab is reloaded.
  const delivered = await send({ type: 'EQ_SET_ENABLED', enabled }, { allFrames: true });

  if (!delivered) {
    // The content script only loads on page load; a freshly-permitted tab
    // needs one reload before the panel appears.
    els.note.textContent = 'Reload the tab to start the panel.';
  } else {
    els.note.textContent = enabled
      ? 'Panel is running. Alt+E collapses it, Alt+V jumps to the value box.'
      : 'Panel is off for this site.';
    setTimeout(refreshSummary, 300);
  }
}

async function onFocus() {
  await send({ type: 'EQ_FOCUS_VALUE' });
  window.close();
}

async function refreshSummary() {
  const res = await send({ type: 'EQ_PING' });
  const s = res?.summary;
  if (!s) {
    els.summary.hidden = true;
    return;
  }
  els.summary.hidden = false;
  els.cash.textContent = formatMoney(s.cashOut);
  els.loan.textContent = formatMoney(s.maxLoan);
  els.ltv.textContent = s.currentLtv != null ? formatPercent(s.currentLtv, 1) : '—';
  els.prog.textContent = s.program ?? '—';
}

/**
 * Returns the response, or null when no content script is listening.
 * Targets the top frame by default; `allFrames` reaches every frame in the tab.
 */
async function send(message, { allFrames = false } = {}) {
  if (tab?.id == null) return null;
  try {
    return allFrames
      ? await chrome.tabs.sendMessage(tab.id, message)
      : await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  } catch {
    return null;
  }
}
