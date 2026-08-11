/**
 * Service worker.
 *
 * Does two small jobs:
 *   1. Relays field reports from child frames up to the top frame, because a
 *      cross-origin iframe can't postMessage into the top document.
 *   2. Broadcasts settings changes so open tabs pick them up without a reload.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
