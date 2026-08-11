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
            .sendMessage(tab.id, { type: 'EQ_EXTERNAL_VALUE', valuation }, { frameId: 0 })
            .catch(() => { /* no panel on this tab */ })));
  } catch { /* tabs unavailable */ }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'EQ_VALUATION_REPORT') {
    if (msg.valuation?.value) {
      latestValuation = { ...msg.valuation, at: Date.now(), tabId: sender?.tab?.id ?? null };
      broadcastValuation();
    }
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === 'EQ_REQUEST_VALUATION') {
    // A panel that started after the valuation tab was read asks for it.
    sendResponse?.({ valuation: freshValuation() });
    return true;
  }

  if (msg?.type === 'EQ_FRAME_REPORT') {
    const tabId = sender?.tab?.id;
    if (tabId == null || sender.frameId === 0) return;
    chrome.tabs
      .sendMessage(tabId, { type: 'EQ_FRAME_FIELDS', fields: msg.fields }, { frameId: 0 })
      .catch(() => { /* top frame has no listener (disabled site) */ });
    return;
  }

  if (msg?.type === 'EQ_BROADCAST_SETTINGS') {
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
              .sendMessage(tab.id, { type: 'EQ_SETTINGS_CHANGED' })
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
