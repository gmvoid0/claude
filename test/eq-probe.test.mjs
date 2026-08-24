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
    assert.equal(store.version, 2);
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

/* --- the page the agent copies it from ---------------------------------- */

runTest('the page hands over the probe byte for byte', async () => {
  // The page carries the script inside it, and the agent pastes what the
  // Copy button gives them straight into a live broker portal. A single
  // mangled character there is a broken tool and a wasted afternoon, so the
  // round trip through HTML escaping is checked rather than assumed.
  const built = path.join(ROOT, 'docs/eq-probe-page.html');
  const page = await browser.newPage();
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"></head><body>${
        await fs.readFile(built, 'utf8')}</body></html>`,
    );
    const copied = await page.$eval('#script', (el) => el.value);
    assert.equal(copied, PROBE, 'what the Copy button holds is not the probe');
    assert.equal(await page.evaluate((src) => {
      try { new Function(src); return 'parses'; } catch (e) { return String(e); }
    }, copied), 'parses');
  } finally {
    await page.close();
  }
});

runTest('the page is rebuilt whenever the probe changes', async () => {
  // Generated, not kept beside it — a stale copy is the failure this guards.
  const { execFile } = await import('node:child_process');
  const built = path.join(ROOT, 'docs/eq-probe-page.html');
  const before = await fs.readFile(built, 'utf8');
  await new Promise((resolve, reject) => {
    execFile('node', ['tools/build-eq-page.mjs'], { cwd: ROOT },
      (err) => (err ? reject(err) : resolve()));
  });
  assert.equal(await fs.readFile(built, 'utf8'), before,
    'docs/eq-probe-page.html is out of date — run node tools/build-eq-page.mjs');
});

runTest('the page reads in both themes and never scrolls sideways', async () => {
  const built = await fs.readFile(path.join(ROOT, 'docs/eq-probe-page.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${built}</body></html>`;

  for (const [colorScheme, width] of [['light', 900], ['dark', 900], ['light', 380]]) {
    const page = await browser.newPage({ colorScheme, viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.setContent(html);
      const seen = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return {
          bg: body.backgroundColor,
          wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          // A step whose text landed in the 34px number gutter is the layout
          // bug this page shipped with once already.
          narrowest: Math.min(...[...document.querySelectorAll('.steps p')]
            .map((p) => p.getBoundingClientRect().width)),
        };
      });
      assert.deepEqual(errors, [], `${colorScheme} ${width}`);
      assert.notEqual(seen.bg, 'rgba(0, 0, 0, 0)', 'a transparent body borrows the host theme');
      assert.equal(seen.wide, false, `${colorScheme} ${width} scrolls sideways`);
      assert.ok(seen.narrowest > 180, `step text is ${seen.narrowest}px wide`);
    } finally {
      await page.close();
    }
  }
});

/* --- the second round, built after seeing the real Easy Qualifier -------- */

runTest('a value rendered into a label does not come back as one', async () => {
  // The first live run brought back "Loan Officer *Joe ShenaLoan Officer".
  // EQ builds a combobox's accessible name out of the label AND the chosen
  // value, so someone's name arrived through the one channel this thing
  // promised not to use. Whatever the field holds is stripped from its label.
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);

    const json = await page.evaluate(() => window.__samEqProbe.json());
    assert.ok(!json.includes('Joe Shena'), 'the loan officer name leaked into a label');

    const store = JSON.parse(json);
    const lo = fieldsOf(store).find((f) => f.id === 'ObfuscatedLoanOfficerContactId');
    assert.equal(lo.label, 'Loan Officer', 'and what is left is the label itself');

    const occ = fieldsOf(store).find((f) => f.id === 'OccupancyTypeId');
    assert.equal(occ.label, 'Occupancy', 'not "OccupancyPrimary ResidenceOccupancy"');
    assert.equal(occ.mirror, 'input[name="OccupancyTypeId"]', 'and its partner input is named');
  } finally {
    await page.close();
  }
});

runTest('reading the dropdowns opens every one of them and picks nothing', async () => {
  // The live run came back with one option list out of twenty, because a
  // React dropdown holds nothing in the document until it is opened and
  // opening one changes no fields, so nothing triggered a capture.
  const page = await open();
  try {
    await page.click('[data-next="2"]');
    await page.waitForTimeout(1400);

    const before = await page.evaluate(() => [...document.querySelectorAll('input')].map((el) => el.value));
    const found = await page.evaluate(() => window.__samEqProbe.dropdowns());
    const after = await page.evaluate(() => [...document.querySelectorAll('input')].map((el) => el.value));

    const occupancy = found.find((d) => d.id === 'OccupancyTypeId');
    assert.deepEqual(occupancy.options, [
      { value: '1', text: 'Primary Residence' },
      { value: '2', text: 'Second Home' },
      { value: '3', text: 'Investment' },
    ]);
    assert.equal(occupancy.mirror, 'input[name="OccupancyTypeId"]');
    assert.equal(occupancy.selectionChanged, undefined, 'the selection did not move');

    assert.deepEqual(after, before, 'reading the lists changed a field');
    assert.equal(await page.evaluate(
      () => [...document.querySelectorAll('[role=listbox]')].every((el) => el.hidden),
    ), true, 'a dropdown was left hanging open');
  } finally {
    await page.close();
  }
});

runTest('the results come back as a shape, never as a price', async () => {
  // The rule the user set: pricing is not cached or carried anywhere. Where
  // the rate and payment appear is structure and worth knowing; what they
  // say today is not ours to keep.
  const page = await open();
  try {
    await page.click('[data-next="3"]');
    await page.waitForTimeout(1400);
    const blocks = await page.evaluate(() => window.__samEqProbe.results());

    const table = blocks.find((b) => b.kind === 'table');
    assert.deepEqual(table.headers, ['Product', 'Rate', 'Price', 'Payment'],
      'the column names are the map');
    assert.deepEqual(table.shapes[0], ['## Year Fixed', '#.###%', '###.###', '$#,###.##'],
      'and every digit is masked');

    const json = JSON.stringify(blocks);
    for (const price of ['6.375', '100.482', '2,417', '6.250']) {
      assert.ok(!json.includes(price), `${price} was carried out of the page`);
    }
  } finally {
    await page.close();
  }
});
