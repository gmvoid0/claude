/**
 * Service worker.
 *
 * Does two small jobs:
 *   1. Relays field reports from child frames up to the top frame, because a
 *      cross-origin iframe can't postMessage into the top document.
 *   2. Broadcasts settings changes so open tabs pick them up without a reload.
 */

/**
 * The most recent home value seen on a valuation tab, held in memory only.
 * Never persisted — it is property data, and it is worthless the moment the
 * agent moves to the next lead.
 */
let latestValuation = null;

/** Valuations older than this are not offered to the panel. */
const VALUATION_TTL_MS = 30 * 60 * 1000;

function freshValuation() {
  if (!latestValuation) return null;
  if (Date.now() - latestValuation.at > VALUATION_TTL_MS) {
    latestValuation = null;
    return null;
  }
  return latestValuation;
}

async function broadcastValuation() {
  const valuation = freshValuation();
  if (!valuation) return;
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map((tab) =>
      tab.id == null
        ? null
        : chrome.tabs
            .sendMessage(tab.id, { type: 'SAM_EXTERNAL_VALUE', valuation }, { frameId: 0 })
            .catch(() => { /* no panel on this tab */ })));
  } catch { /* tabs unavailable */ }
}

/**
 * A lookup opened on the agent's behalf.
 *
 * The wait is the problem this solves: an agent should not be clicking a link
 * and watching a page load while a customer is on the phone. The lookup is
 * started the moment an address is known, in a background tab that never
 * takes focus, and closed as soon as a value has been read from it.
 *
 * This is an ordinary navigation in the agent's own session — the same one
 * they perform by hand today, just earlier. Nothing is fetched behind the
 * site's back and no security control is bypassed.
 */
let pendingLookup = null;
const LOOKUP_TIMEOUT_MS = 30000;

async function openLookup({ url, address }) {
  if (!url) return;
  // One at a time, and never twice for the same property.
  if (pendingLookup && Date.now() - pendingLookup.startedAt < LOOKUP_TIMEOUT_MS) return;
  if (pendingLookup?.address === address) return;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    pendingLookup = { tabId: tab.id, address, startedAt: Date.now() };

    setTimeout(() => {
      if (pendingLookup?.tabId === tab.id) closeLookup(tab.id);
    }, LOOKUP_TIMEOUT_MS);
  } catch {
    pendingLookup = null;
  }
}

function closeLookup(tabId) {
  pendingLookup = null;
  chrome.tabs.remove(tabId).catch(() => { /* already gone */ });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SAM_OPEN_LOOKUP') {
    openLookup(msg);
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === 'SAM_VALUATION_REPORT') {
    if (msg.valuation?.value) {
      latestValuation = { ...msg.valuation, at: Date.now(), tabId: sender?.tab?.id ?? null };
      broadcastValuation();

      // The tab existed only to produce this figure.
      const tabId = sender?.tab?.id;
      if (tabId != null && pendingLookup?.tabId === tabId) closeLookup(tabId);
    }
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === 'SAM_REQUEST_VALUATION') {
    // A panel that started after the valuation tab was read asks for it.
    sendResponse?.({ valuation: freshValuation() });
    return true;
  }

  if (msg?.type === 'SAM_FRAME_REPORT') {
    const tabId = sender?.tab?.id;
    if (tabId == null || sender.frameId === 0) return;
    chrome.tabs
      .sendMessage(tabId, { type: 'SAM_FRAME_FIELDS', fields: msg.fields }, { frameId: 0 })
      .catch(() => { /* top frame has no listener (disabled site) */ });
    return;
  }

  if (msg?.type === 'SAM_BROADCAST_SETTINGS') {
    broadcastSettings();
    sendResponse?.({ ok: true });
    return true;
  }
});

async function broadcastSettings() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) =>
        tab.id == null
          ? null
          : chrome.tabs
              .sendMessage(tab.id, { type: 'SAM_SETTINGS_CHANGED' })
              .catch(() => { /* no content script on this tab */ }),
      ),
    );
  } catch { /* tabs permission unavailable */ }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage?.().catch(() => {});
  }
});
