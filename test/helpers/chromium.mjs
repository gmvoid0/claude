/**
 * Finding a Chromium to drive.
 *
 * The npm `playwright` package pins a browser build number that often does
 * not match whatever is already installed on a CI image, so prefer an
 * existing binary over Playwright's own resolution. Getting this wrong is
 * quiet rather than loud: the browser tests skip themselves and a green run
 * means nothing, so it lives in one place rather than being copied.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export async function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  let entries = [];
  try {
    entries = await fs.readdir(base);
  } catch {
    return undefined;   // let Playwright try its bundled path
  }

  const candidates = entries
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((name) => path.join(base, name, 'chrome-linux', 'chrome'));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch { /* try the next one */ }
  }
  return undefined;
}

/** Playwright, or null when it or its browser is not installed here. */
export async function loadChromium() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    return null;
  }
}

export async function launch(chromium) {
  return chromium.launch({
    executablePath: await findChromium(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}
