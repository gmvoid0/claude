/**
 * Classic-script loader.
 *
 * Manifest V3 content scripts are not ES modules, so this thin shim pulls in
 * the real module graph through the extension's web-accessible resources.
 */
(async () => {
  try {
    const url = chrome.runtime.getURL('src/content/main.js');
    const mod = await import(url);
    await mod.start();
  } catch (err) {
    // A failure here must never break the host page.
    if (!/Extension context invalidated/i.test(String(err?.message))) {
      console.debug('[S.A.M] failed to start:', err);
    }
  }
})();
