/**
 * The probe the agent runs inside Easy Qualifier.
 *
 * This one matters more than most: the person running it is a loan officer
 * on a live broker portal, not a developer, and they get one shot at it
 * before the goodwill runs out. So it is exercised against a stand-in with
 * the shapes EQ is likely to have — a wizard that swaps steps in place, a
 * custom combobox, a radio group, a currency mask — and checked for the two
 * things that would make it unsafe to hand over: that it captures the map,
 * and that it captures nothing else.
 *
 * Skips itself (rather than failing) when Chromium is unavailable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import { loadChromium, launch } from './helpers/chromium.mjs';

const chromium = await loadChromium();

async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) return void res.writeHead(403).end('forbidden');
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

let browser = null;
let ctx = null;
if (chromium) {
  try {
    browser = await launch(chromium);
    ctx = await startServer();
  } catch {
    browser = null;
  }
}

const runTest = browser ? test : test.skip;

test.after(async () => {
  await browser?.close();
  ctx?.server.close();
});

const PROBE = await fs.readFile(path.join(ROOT, 'tools/eq-probe.js'), 'utf8');

async function open() {
  const page = await browser.newPage();
  await page.goto(`${ctx.base}/test/fixtures/eq-like.html`);
  await page.evaluate(PROBE);
  return page;
}

const dump = (page) => page.evaluate(() => window.__samEqProbe.store);
const fieldsOf = (store) => store.screens.flatMap((s) => s.fields);
const byName = (store, name) => fieldsOf(store).find((f) => f.name === name);

runTest('it captures the first screen the moment it is pasted in', async () => {
  const page = await open();
  try {
    const store = await dump(page);
    assert.equal(store.version, 1);
    assert.equal(store.screens.length, 1);
    assert.ok(store.screens[0].fieldCount > 0);
    assert.match(store.site, /eq-like\.html$/);
  } finally {
    await page.close();
  }
});

runTest('a label in a plain sibling div is still read', async () => {
  // Half the fields on a portal are labelled by a <div> above the box rather
  // than a <label for>. If the probe cannot read those, the map comes back
  // full of anonymous inputs and the whole exercise is wasted.
  const page = await open();
  try {
    const fico = byName(await dump(page), 'creditScore');
    assert.equal(fico.label, 'FICO Score');
    assert.ok(fico.selectors.includes('[data-testid="fico-input"]'));
    assert.equal(fico.maxLength, 3);
    assert.equal(fico.inputMode, 'numeric');
  } finally {
    await page.close();
  }
});

runTest('dropdown options come back whole, which is the point of the exercise', async () => {
  // S.A.M knows a file is VA. Only EQ knows whether it calls that "VA",
  // "Veterans Affairs" or "3" — so the option list is the map.
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);

    const store = await dump(page);
    const program = byName(store, 'loanProduct');
    assert.ok(program, 'the second screen was captured on its own');
    // An option whose value matches its text collapses to the bare string,
    // because the option lists are the bulk of what has to be pasted back.
    assert.deepEqual(program.options.list, [
      { value: '', text: 'Select…' },
      { value: 'CONV', text: 'Conventional' },
      'FHA',
      'VA',
      'USDA',
    ]);

    const purpose = byName(store, 'loanPurpose');
    assert.deepEqual(purpose.options.list.at(-1), { value: '3', text: 'Cash-Out Refinance' });
  } finally {
    await page.close();
  }
});

runTest('a radio group is one question, not five fields', async () => {
  const page = await open();
  try {
    const occupancy = byName(await dump(page), 'occupancy');
    assert.equal(occupancy.type, 'radio');
    assert.equal(occupancy.label, 'Occupancy', 'named by its legend');
    assert.deepEqual(occupancy.options.list, [
      { value: 'PRIM', text: 'Primary Residence' },
      { value: 'SEC', text: 'Second Home' },
      { value: 'INV', text: 'Investment' },
    ]);
  } finally {
    await page.close();
  }
});

runTest('a custom combobox is found, and its list when it is open', async () => {
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);
    await page.click('[data-open="cty-list"]');
    await page.evaluate(() => window.__samEqProbe.capture());

    const store = await dump(page);
    const county = fieldsOf(store).find((f) => f.role === 'combobox');
    assert.equal(county.label, 'County');
    assert.deepEqual(county.options.list, [
      { value: '47145', text: 'Roane' },
      { value: '47001', text: 'Anderson' },
      { value: '47093', text: 'Knox' },
    ]);
  } finally {
    await page.close();
  }
});

runTest('a currency box is flagged as masked so the fill engine treats it right', async () => {
  // Typing 400000 into a formatted box and letting it settle as $4.00 is the
  // classic way an automated fill goes wrong quietly.
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);
    const value = byName(await dump(page), 'propertyValue');
    assert.equal(value.masked, true);
    assert.equal(byName(await dump(page), 'firstMortgageBalance').masked, undefined);
  } finally {
    await page.close();
  }
});

runTest('a wizard step is captured once, not on every repaint', async () => {
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);
    await page.click('[data-next="1"]');
    await page.waitForTimeout(1400);
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);

    const store = await dump(page);
    assert.ok(store.screens.length <= 3, `${store.screens.length} screens for two steps`);
    const headings = store.screens.map((s) => s.heading);
    assert.ok(headings.some((h) => h?.includes('Borrower')), 'the first step is named');
    assert.ok(headings.some((h) => h?.includes('Property')), 'and so is the second');
  } finally {
    await page.close();
  }
});

/* --- the half that decides whether this is safe to hand someone ---------- */

runTest('nothing anyone typed comes back', async () => {
  const page = await open();
  try {
    await page.fill('#fName', 'RANDY');
    await page.fill('#lName', 'ROLLINS');
    await page.fill('[name=creditScore]', '712');
    await page.evaluate(() => window.__samEqProbe.capture());

    const json = await page.evaluate(() => window.__samEqProbe.json());
    for (const secret of ['RANDY', 'ROLLINS', '712']) {
      assert.ok(!json.includes(secret), `"${secret}" leaked into the map`);
    }

    // The shape is still reported: filled or empty, never with what.
    const store = JSON.parse(json);
    const first = fieldsOf(store).find((f) => f.name === 'borrowerFirstName' && f.filled);
    assert.ok(first, 'that the box has something in it is worth knowing');
  } finally {
    await page.close();
  }
});

runTest('password boxes are not even listed', async () => {
  const page = await open();
  try {
    const store = await dump(page);
    assert.equal(byName(store, 'password'), undefined);
    assert.ok(!JSON.stringify(store).includes('"password"'));
  } finally {
    await page.close();
  }
});

runTest('no cookie, token or storage is read, and nothing is sent', async () => {
  // The user's own integration spec says it plainly: never handle
  // credentials or tokens, and no background requests to UWM. This is that
  // rule enforced rather than promised.
  const page = await open();
  try {
    const calls = [];
    page.on('request', (r) => { if (!r.url().startsWith(ctx.base)) calls.push(r.url()); });

    await page.evaluate(() => {
      document.cookie = 'session=super-secret-value; path=/';
      localStorage.setItem('access_token', 'super-secret-value');
      sessionStorage.setItem('jwt', 'super-secret-value');
    });
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);
    await page.evaluate(() => window.__samEqProbe.capture());

    const json = await page.evaluate(() => window.__samEqProbe.json());
    assert.ok(!json.includes('super-secret-value'), 'a credential reached the map');
    assert.deepEqual(calls, [], 'the probe made a network call');

    // And the source itself never mentions the APIs that would do it.
    const source = PROBE.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket',
      'document.cookie', 'localStorage', 'sessionStorage']) {
      assert.ok(!source.includes(banned), `the probe references ${banned}`);
    }
  } finally {
    await page.close();
  }
});

runTest('it leaves the page exactly as it found it', async () => {
  const page = await open();
  try {
    const before = await page.evaluate(() => ({
      values: [...document.querySelectorAll('input,select')].map((el) => el.value),
      checked: [...document.querySelectorAll('input[type=radio]')].map((el) => el.checked),
    }));
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);
    await page.click('[data-next="1"]');
    await page.waitForTimeout(1400);
    await page.evaluate(() => window.__samEqProbe.capture());

    const after = await page.evaluate(() => ({
      values: [...document.querySelectorAll('input,select')].map((el) => el.value),
      checked: [...document.querySelectorAll('input[type=radio]')].map((el) => el.checked),
    }));
    assert.deepEqual(after, before, 'the probe changed the form');
  } finally {
    await page.close();
  }
});

runTest('stopping takes the box away and leaves nothing behind', async () => {
  const page = await open();
  try {
    await page.evaluate(() => window.__samEqProbe.stop());
    const gone = await page.evaluate(() => ({
      host: !!document.getElementById('__sam_eq_probe'),
      global: !!window.__samEqProbe,
    }));
    assert.deepEqual(gone, { host: false, global: false });
  } finally {
    await page.close();
  }
});

runTest('pasting it in twice does not start a second one', async () => {
  const page = await open();
  try {
    await page.evaluate(PROBE);
    const hosts = await page.evaluate(() => document.querySelectorAll('#__sam_eq_probe').length);
    assert.equal(hosts, 1);
  } finally {
    await page.close();
  }
});
