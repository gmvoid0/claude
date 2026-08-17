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

/** Send a message to the top frame of every tab that will listen. */
async function broadcast(message, options = { frameId: 0 }) {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map((tab) =>
      tab.id == null
        ? null
        : chrome.tabs
            .sendMessage(tab.id, message, options)
            .catch(() => { /* no listener on this tab */ })));
  } catch { /* tabs unavailable */ }
}

async function broadcastValuation() {
  const valuation = freshValuation();
  if (!valuation) return;
  await broadcast({ type: 'SAM_EXTERNAL_VALUE', valuation });
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
    pendingLookup = { tabId: tab.id, address, startedAt: Date.now(), surfaced: false };

    setTimeout(() => {
      // A tab brought forward for a bot check belongs to the agent now.
      // Closing it out from under them mid-verification would be the worst
      // possible moment to do it.
      if (pendingLookup?.tabId === tab.id && !pendingLookup.surfaced) closeLookup(tab.id);
    }, LOOKUP_TIMEOUT_MS);
  } catch {
    pendingLookup = null;
  }
}

/**
 * A lookup page is asking a human to prove they are one.
 *
 * The failure this fixes is a silent one. The background tab is invisible by
 * design, so a "Press & Hold" page sat there unseen until the timeout closed
 * it, and the panel simply never received a value — nothing on screen said
 * why. On a floor sharing one office IP that is most mornings, not an edge
 * case.
 *
 * So the tab comes to the front, the auto-close is called off, and the panel
 * is told what happened. Two seconds of holding a button clears it and the
 * value arrives through the ordinary path. Nothing is solved or bypassed
 * here: it is a human verification, and this puts it in front of the human.
 */
async function surfaceChallenge(msg, sender) {
  const tabId = sender?.tab?.id;
  const notify = () => broadcast({
    type: 'SAM_LOOKUP_BLOCKED',
    site: msg?.site ?? 'The lookup site',
    kind: msg?.kind ?? 'challenge',
  });

  if (tabId == null) { notify(); return; }

  // The mini browser is already on screen; ask for attention rather than
  // yanking focus off the dialer.
  const mini = await loadMini();
  if (mini?.tabId === tabId) {
    try { await chrome.windows.update(mini.windowId, { drawAttention: true }); }
    catch { /* window gone */ }
    notify();
    return;
  }

  if (pendingLookup?.tabId !== tabId) { notify(); return; }

  pendingLookup.surfaced = true;
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
  } catch { /* tab closed already */ }

  notify();
}

function closeLookup(tabId) {
  pendingLookup = null;
  chrome.tabs.remove(tabId).catch(() => { /* already gone */ });
}

/**
 * The mini browser.
 *
 * A small popup window — no tab strip, no omnibox — showing the lead's
 * address on Zillow beside the dialer, so the agent can see the photos and
 * the comps while the customer is still talking. The value it finds arrives
 * in the panel through the ordinary valuation path, because S.A.M's content
 * script runs in this window like any other.
 *
 * It is a real browser window, not an embedded frame. Zillow sends
 * `X-Frame-Options: DENY` precisely so its pages cannot be embedded, and the
 * only way to put it in an iframe is to strip that header on the way in.
 * That is a deliberate security control belonging to someone else, and
 * stripping it is not something to ship under a lender's name. A popup
 * window is the same navigation the agent performs by hand today, in their
 * own session, with nothing bypassed — and it looks and behaves the same.
 *
 * One window, reused. A window per lookup would bury the dialer by the
 * fourth call of the morning.
 */
let miniWindow = null;   // { windowId, tabId, url, address }

const MINI = { width: 540, height: 780 };
const MINI_KEY = 'miniWindow';

/**
 * Remember which window is the preview, across service-worker restarts.
 *
 * This worker is killed after about thirty seconds of quiet and restarted on
 * the next message, taking every variable with it. Holding the window id in
 * memory alone meant that after any pause — which is to say between most
 * calls — the worker had forgotten the window existed and opened a second
 * one. By the end of a shift the agent had a row of them.
 *
 * Session storage rather than local: the id is meaningless once the browser
 * closes, and persisting it would have the same failure in a slower form.
 */
async function loadMini() {
  if (miniWindow) return miniWindow;
  try {
    const stored = await chrome.storage.session.get(MINI_KEY);
    const held = stored?.[MINI_KEY];
    if (!held?.windowId) return null;
    // Trust nothing: the agent may have closed it while we were not running.
    await chrome.windows.get(held.windowId);
    miniWindow = held;
  } catch {
    miniWindow = null;
    chrome.storage.session?.remove(MINI_KEY).catch(() => {});
  }
  return miniWindow;
}

async function rememberMini(value) {
  miniWindow = value;
  try {
    if (value) await chrome.storage.session.set({ [MINI_KEY]: value });
    else await chrome.storage.session.remove(MINI_KEY);
  } catch { /* session storage unavailable; in-memory still works */ }
}

async function openMini({ url, address, focused = true }) {
  if (!url) return { ok: false, open: false, reason: 'no-address' };

  const existing = await loadMini();
  if (existing) {
    try {
      await chrome.windows.update(existing.windowId, { focused, drawAttention: !focused });
      if (url !== existing.url) await chrome.tabs.update(existing.tabId, { url });
      await rememberMini({ ...existing, url, address });
      return { ok: true, open: true };
    } catch {
      await rememberMini(null);   // closed behind our back; fall through
    }
  }

  try {
    const win = await chrome.windows.create({
      url,
      type: 'popup',
      focused,
      width: MINI.width,
      height: MINI.height,
      ...(await miniPlacement()),
    });
    await rememberMini({
      windowId: win.id,
      tabId: win.tabs?.[0]?.id ?? null,
      url,
      address,
    });
    return { ok: true, open: true };
  } catch {
    await rememberMini(null);
    return { ok: false, open: false, reason: 'blocked' };
  }
}

/**
 * Put it against the left edge of the window the agent is working in.
 *
 * The panel docks right, so the left side is the half of a dialer screen
 * with the least on it. Chrome places the window itself if the current
 * window's geometry is unavailable.
 */
async function miniPlacement() {
  try {
    const current = await chrome.windows.getLastFocused();
    if (current?.left == null || current?.top == null) return {};
    return {
      left: Math.max(0, Math.round(current.left + 32)),
      top: Math.max(0, Math.round(current.top + 64)),
    };
  } catch {
    return {};
  }
}

async function closeMini() {
  const open = await loadMini();
  await rememberMini(null);
  if (!open) return { ok: true, open: false };
  try {
    await chrome.windows.remove(open.windowId);
  } catch { /* already gone */ }
  return { ok: true, open: false };
}

// The agent can close it with the window's own button, which no message
// tells us about. Watch for it, or the panel's toggle goes out of step.
chrome.windows?.onRemoved?.addListener(async (windowId) => {
  const held = await loadMini();
  if (held?.windowId !== windowId) return;
  await rememberMini(null);
  broadcast({ type: 'SAM_MINI_CLOSED' });
});

/**
 * An application waiting to be typed into Salesforce.
 *
 * Held rather than pushed, because the form may not be open yet. Whichever
 * Salesforce tab reports itself next collects it, fills what it can, and
 * reports back what actually landed.
 */
let pendingHandoff = null;
const HANDOFF_TTL_MS = 10 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SAM_HANDOFF') {
    pendingHandoff = { plan: msg.plan, at: Date.now(), fromTab: sender?.tab?.id ?? null };
    deliverHandoff().then((report) => sendResponse?.(report));
    return true;
  }

  if (msg?.type === 'SAM_HANDOFF_CLAIM') {
    const fresh = pendingHandoff && Date.now() - pendingHandoff.at < HANDOFF_TTL_MS;
    sendResponse?.({ plan: fresh ? pendingHandoff.plan : null });
    if (fresh) pendingHandoff = null;
    return true;
  }

  if (msg?.type === 'SAM_OPEN_LOOKUP') {
    openLookup(msg);
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === 'SAM_OPEN_MINI') {
    openMini(msg).then((res) => sendResponse?.(res));
    return true;
  }

  if (msg?.type === 'SAM_CLOSE_MINI') {
    closeMini().then((res) => sendResponse?.(res));
    return true;
  }

  if (msg?.type === 'SAM_MINI_STATE') {
    loadMini().then((held) => sendResponse?.({
      ok: true,
      open: !!held,
      address: held?.address ?? null,
    }));
    return true;
  }

  if (msg?.type === 'SAM_VALUATION_REPORT') {
    if (msg.valuation?.value) {
      latestValuation = { ...msg.valuation, at: Date.now(), tabId: sender?.tab?.id ?? null };
      broadcastValuation();

      // A background lookup tab existed only to produce this figure, so it
      // goes as soon as it has. The mini browser is never closed this way —
      // the agent opened it to look at the property, not to harvest a number.
      const tabId = sender?.tab?.id;
      if (tabId != null && pendingLookup?.tabId === tabId && miniWindow?.tabId !== tabId) {
        closeLookup(tabId);
      }
    }
    sendResponse?.({ ok: true });
    return true;
  }

  if (msg?.type === 'SAM_VALUATION_BLOCKED') {
    surfaceChallenge(msg, sender);
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
  // Every frame, not just the top one: a child frame harvests fields too.
  await broadcast({ type: 'SAM_SETTINGS_CHANGED' }, undefined);
}

/**
 * Offer the pending application to an open Salesforce tab.
 * Returns a report the panel can show verbatim.
 */
async function deliverHandoff() {
  if (!pendingHandoff) return { ok: false, reason: 'nothing-to-send' };

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({
      // Must stay in step with SALESFORCE_HOSTS in lib/salesforce.js. An org
      // on *.salesforce.com had a content script listening and no tab query
      // that could find it, so every handoff reported "no Salesforce tab".
      url: [
        'https://*.my.site.com/*',
        'https://*.lightning.force.com/*',
        'https://*.force.com/*',
        'https://*.salesforce.com/*',
      ],
    });
  } catch {
    return { ok: false, reason: 'no-permission' };
  }

  if (!tabs.length) return { ok: false, reason: 'no-tab' };

  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      const report = await chrome.tabs.sendMessage(tab.id, {
        type: 'SAM_FILL_FORM',
        plan: pendingHandoff.plan,
      });
      if (report?.ok) {
        pendingHandoff = null;
        return { ...report, tabId: tab.id };
      }
    } catch { /* no listener on that tab; try the next */ }
  }

  return { ok: false, reason: 'no-form' };
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage?.().catch(() => {});
  }
});
