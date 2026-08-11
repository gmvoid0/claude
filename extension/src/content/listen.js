/**
 * Listening to the call.
 *
 * Uses the browser's own speech recognition, which is free and — since
 * Chrome 139 — can run entirely on the device. On-device is requested
 * whenever it is available, and not only for latency: it means no audio and
 * no transcript ever leaves the machine, which is a materially easier thing
 * to put in front of a compliance team than shipping customer speech to a
 * third-party service.
 *
 * What it can and cannot hear, stated plainly, because it shapes everything
 * downstream: this reads the *default input device*. That is the agent's
 * microphone. The customer's voice arrives through the softphone and comes
 * out of the speakers, so it is not in this stream unless the machine's
 * input has been set to a loopback device that mixes system audio in.
 * Agents restate figures back to customers as a matter of course — "so your
 * balance is about two hundred thousand" — and a restated figure is a
 * confirmed one, which is why this remains useful on the agent's side alone.
 *
 * Two practical faults in the API are handled here rather than left to bite:
 * recognition stops on its own after a few seconds of silence, and restarting
 * from `onend` fails intermittently. So restarts are supervised, backed off
 * on repeated failure, and never left to a single callback.
 */

const RESTART_DELAY_MS = 250;
const MAX_BACKOFF_MS = 8000;
const WATCHDOG_MS = 4000;

/** Browser support, without assuming a vendor prefix. */
function recognitionClass() {
  return globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;
}

export function speechSupported() {
  return !!recognitionClass();
}

/**
 * Whether recognition can run without sending audio off the device.
 * Returns 'available' | 'downloadable' | 'downloading' | 'unavailable'.
 */
export async function onDeviceStatus(lang = 'en-US') {
  const Recognition = recognitionClass();
  if (!Recognition?.available) return 'unavailable';
  try {
    return await Recognition.available({ langs: [lang], processLocally: true });
  } catch {
    return 'unavailable';
  }
}

/** Fetch the local language pack. Returns true when it is ready to use. */
export async function installOnDevice(lang = 'en-US') {
  const Recognition = recognitionClass();
  if (!Recognition?.install) return false;
  try {
    return await Recognition.install({ langs: [lang], processLocally: true });
  } catch {
    return false;
  }
}

/**
 * Start listening.
 *
 * onSegment({ text, isFinal, at }) fires as speech is recognised.
 * onState({ listening, error, onDevice }) reports what it is doing.
 * Returns { stop() }.
 */
export function startListening({ lang = 'en-US', preferOnDevice = true, onSegment, onState } = {}) {
  const Recognition = recognitionClass();
  if (!Recognition) {
    onState?.({ listening: false, error: 'unsupported' });
    return { stop() {} };
  }

  let recognition = null;
  let stopped = false;
  let backoff = RESTART_DELAY_MS;
  let lastActivity = Date.now();
  let restartTimer = null;
  let onDevice = false;

  const report = (patch) => onState?.({ listening: !stopped, onDevice, ...patch });

  const build = () => {
    const r = new Recognition();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    // Ask for local processing where the build supports it. Both spellings
    // appear across versions of the proposal, and setting one the engine does
    // not know is harmless.
    if (preferOnDevice) {
      try { r.processLocally = true; } catch { /* not supported here */ }
      try { r.options = { langs: [lang], processLocally: true }; } catch { /* ditto */ }
    }

    r.onresult = (event) => {
      lastActivity = Date.now();
      backoff = RESTART_DELAY_MS;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (!text.trim()) continue;
        onSegment?.({ text: text.trim(), isFinal: !!result.isFinal, at: Date.now() });
      }
    };

    r.onerror = (event) => {
      lastActivity = Date.now();
      const code = event?.error ?? 'unknown';

      // Permission and hardware faults are terminal; retrying just spins.
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stopped = true;
        report({ listening: false, error: 'microphone-blocked' });
        return;
      }
      if (code === 'audio-capture') {
        stopped = true;
        report({ listening: false, error: 'no-microphone' });
        return;
      }
      // 'no-speech' and 'aborted' are the ordinary consequence of a pause.
      if (code !== 'no-speech' && code !== 'aborted') report({ error: code });
    };

    r.onend = () => {
      if (stopped) return;
      scheduleRestart();
    };

    return r;
  };

  const scheduleRestart = () => {
    if (stopped || restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (stopped) return;
      try {
        recognition = build();
        recognition.start();
        lastActivity = Date.now();
      } catch {
        // Already-started throws; back off and let the watchdog try again.
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        scheduleRestart();
      }
    }, backoff);
  };

  // `onend` does not fire reliably, so nothing depends on it alone.
  const watchdog = setInterval(() => {
    if (stopped) return;
    if (Date.now() - lastActivity < WATCHDOG_MS) return;
    lastActivity = Date.now();
    try { recognition?.stop(); } catch { /* it may already be stopped */ }
    scheduleRestart();
  }, WATCHDOG_MS);

  (async () => {
    if (preferOnDevice) {
      const status = await onDeviceStatus(lang);
      if (status === 'downloadable') await installOnDevice(lang);
      onDevice = (await onDeviceStatus(lang)) === 'available';
    }
    if (stopped) return;
    try {
      recognition = build();
      recognition.start();
      report({ listening: true });
    } catch {
      scheduleRestart();
    }
  })();

  return {
    stop() {
      stopped = true;
      clearInterval(watchdog);
      clearTimeout(restartTimer);
      try { recognition?.stop(); } catch { /* already stopped */ }
      report({ listening: false });
    },
  };
}
