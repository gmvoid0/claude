/**
 * End-to-end DOM tests in a real browser.
 *
 * The pure scoring logic is covered in detect.test.mjs. This file covers the
 * part that can only be verified against a live document: finding inputs,
 * working out what each one is labelled, and noticing when the page swaps in
 * a new record without firing any events.
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

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

/**
 * Find a Chromium to drive.
 *
 * The npm `playwright` package pins a browser build number that often does
 * not match whatever is already installed on a CI image, so prefer an
 * existing binary over Playwright's own resolution.
 */
async function findChromium() {
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

let ctx = null;

async function setup() {
  if (ctx) return ctx;
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  ctx = { server, port, browser };
  return ctx;
}

test.after(async () => {
  if (!ctx) return;
  await ctx.browser.close();
  await new Promise((resolve) => ctx.server.close(resolve));
});

const skip = chromium ? false : 'playwright is not installed';

/**
 * Load a fixture and run the detector inside the page.
 * Returns { fieldKey: { raw, label, labelSource, score } }.
 */
async function detectOn(page, fixture, { mutate } = {}) {
  const { port } = await setup();
  await page.goto(`http://127.0.0.1:${port}/test/fixtures/${fixture}`);
  if (mutate) await page.evaluate(mutate);

  return page.evaluate(async (origin) => {
    const { collectCandidates, assignFields } =
      await import(`${origin}/extension/src/lib/detect.js`);
    const assigned = assignFields(collectCandidates(document));
    const out = {};
    for (const [key, entry] of Object.entries(assigned)) {
      out[key] = {
        raw: entry.candidate.raw,
        label: entry.candidate.label,
        labelSource: entry.candidate.labelSource,
        score: Math.round(entry.score),
      };
    }
    return out;
  }, `http://127.0.0.1:${port}`);
}

test('reads the agent screen correctly, ignoring misleading field names', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'agent-screen.html');

    assert.equal(got.firstLien?.raw, '270900');
    assert.equal(got.firstLien?.label, 'Mortgage Balance');
    assert.equal(got.payment?.raw, '6.06');
    assert.equal(got.program?.raw, 'VA');
    assert.equal(got.state?.raw, 'TN');
    assert.equal(got.city?.raw, 'ROCKWOOD');
    assert.equal(got.zip?.raw, '37854');
    assert.equal(got.street?.raw, '189 LEDGERWOOD LN');
    assert.equal(got.lastName?.raw, 'ROLLINS');
    assert.equal(got.firstName?.raw, 'RANDY D');

    // The balance field is really named `vendor_lead_code`; detection has to
    // have come from the rendered label, not the attribute.
    assert.notEqual(got.firstLien?.labelSource, 'name');

    // Nothing on this screen is a home value.
    assert.equal(got.propertyValue, undefined);
  } finally {
    await page.close();
  }
});

test('finds labels in an absolutely-positioned layout with no name attributes', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'absolute-layout.html');

    assert.equal(got.firstLien?.raw, '270900');
    assert.equal(got.firstLien?.labelSource, 'geometric');
    assert.equal(got.payment?.raw, '1806.42');
    assert.equal(got.program?.raw, 'FHA');
    assert.equal(got.state?.raw, 'TX');

    // Label sitting above its field rather than beside it.
    assert.equal(got.propertyValue?.raw, '$415,000');
  } finally {
    await page.close();
  }
});

test('picks up the next record after a silent programmatic value swap', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const before = await detectOn(page, 'agent-screen.html');
    assert.equal(before.firstLien?.raw, '270900');
    assert.equal(before.state?.raw, 'TN');

    // Exactly what a dialer does between calls: assign to `.value`. No input
    // event, no attribute mutation — a MutationObserver would see nothing.
    const after = await page.evaluate(async (origin) => {
      window.loadNextRecord({
        id: '7164999',
        first: 'MARIA',
        last: 'CHEN',
        address: '44 OAK ST',
        city: 'AUSTIN',
        state: 'TX',
        zip: '78701',
        balance: '318450',
        loanType: 'CV',
      });
      const { collectCandidates, assignFields } =
        await import(`${origin}/extension/src/lib/detect.js`);
      const assigned = assignFields(collectCandidates(document));
      const out = {};
      for (const [key, entry] of Object.entries(assigned)) out[key] = entry.candidate.raw;
      return out;
    }, `http://127.0.0.1:${(await setup()).port}`);

    assert.equal(after.firstLien, '318450');
    assert.equal(after.state, 'TX');
    assert.equal(after.program, 'CV');
    assert.equal(after.lastName, 'CHEN');
  } finally {
    await page.close();
  }
});

test('the full pipeline turns a scraped screen into a cash-out figure', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/agent-screen.html`);

    const result = await page.evaluate(async (origin) => {
      const { collectCandidates, assignFields } = await import(`${origin}/extension/src/lib/detect.js`);
      const { computeEquity } = await import(`${origin}/extension/src/lib/equity.js`);
      const { normalizeProgram, normalizeState } = await import(`${origin}/extension/src/lib/rules.js`);
      const { parseMoney } = await import(`${origin}/extension/src/lib/money.js`);

      const f = assignFields(collectCandidates(document));
      const raw = (k) => f[k]?.candidate?.raw ?? null;

      return computeEquity({
        propertyValue: 400000,                       // typed by the agent
        firstLien: parseMoney(raw('firstLien')),
        program: normalizeProgram(raw('program')),
        state: normalizeState(raw('state')),
        financeFee: true,
      });
    }, `http://127.0.0.1:${port}`);

    assert.equal(result.ok, true);
    assert.equal(result.program, 'VA');
    assert.equal(result.state, 'TN');
    assert.equal(result.maxLtv, 1);
    assert.equal(result.totalLiens, 270900);
    assert.equal(result.grossEquity, 129100);
    assert.equal(result.maxBaseLoan, 391581);
    assert.equal(result.estimatedCashToBorrower, 120681);
  } finally {
    await page.close();
  }
});

test('reads an AVM value out of another extension\'s shadow-root panel', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'avm-panel.html');

    // Balance comes from the dialer form, value from the injected panel.
    assert.equal(got.firstLien?.raw, '412500');
    assert.equal(got.propertyValue?.raw, '$661,400');
    assert.equal(got.propertyValue?.label, 'Zestimate');   // ® stripped
    assert.equal(got.propertyValue?.labelSource, 'geometric');
    assert.equal(got.state?.raw, 'WA');
    assert.equal(got.program?.raw, 'VA');
  } finally {
    await page.close();
  }
});

test('a busy host page does not starve the injected AVM panel', { skip }, async () => {
  // Regression: traversal budget was consumed in document order, so a large
  // host document exhausted it before any shadow root was reached and the one
  // element carrying the home value was never examined. Invisible on a small
  // fixture, total failure on a real dialer screen.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'busy-page-avm.html');

    assert.equal(got.propertyValue?.raw, '$412,700',
      'the AVM value must survive a text-heavy host page');
    assert.equal(got.firstLien?.raw, '200000');
    assert.equal(got.state?.raw, 'ID');
    assert.equal(got.program?.raw, 'VA');
  } finally {
    await page.close();
  }
});

test('bed / bath / sqft and a monthly payment are not mistaken for the value', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'avm-panel.html');
    assert.equal(got.propertyValue?.raw, '$661,400');
    assert.notEqual(got.propertyValue?.raw, '2,243');
    assert.notEqual(got.propertyValue?.raw, '$4,027');
    // "Est. refi payment: $4,027/mo" must not become the home value either.
    assert.ok(!String(got.propertyValue?.raw).includes('4,027'));
  } finally {
    await page.close();
  }
});

test('AVM value plus dialer balance produces a haircut screening figure', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/avm-panel.html`);

    const out = await page.evaluate(async (origin) => {
      const { collectCandidates, assignFields } = await import(`${origin}/extension/src/lib/detect.js`);
      const { computeEquity } = await import(`${origin}/extension/src/lib/equity.js`);
      const { normalizeProgram, normalizeState, mergeRules } = await import(`${origin}/extension/src/lib/rules.js`);
      const { parseMoney } = await import(`${origin}/extension/src/lib/money.js`);

      const f = assignFields(collectCandidates(document));
      const pick = (k) => f[k]?.candidate ?? null;

      const value = pick('propertyValue');
      const rules = mergeRules({ avmHaircut: 0.05 });

      return computeEquity({
        propertyValue: parseMoney(value?.raw),
        valueIsAvm: !!value?.isAvm,
        firstLien: parseMoney(pick('firstLien')?.raw),
        program: normalizeProgram(pick('program')?.raw),
        state: normalizeState(pick('state')?.raw),
        financeFee: true,
      }, rules);
    }, `http://127.0.0.1:${port}`);

    assert.equal(out.ok, true);
    assert.equal(out.program, 'VA');
    assert.equal(out.state, 'WA');
    assert.equal(out.propertyValueEntered, 661400);
    assert.equal(out.valueIsAvm, true);
    assert.equal(out.avmHaircut, 0.05);
    assert.equal(out.propertyValue, 628330);            // 661,400 less 5%
    assert.equal(out.totalLiens, 412500);
    assert.ok(out.warnings.some((w) => /not an appraisal/i.test(w.text)));
    assert.ok(out.estimatedCashToBorrower > 0);
  } finally {
    await page.close();
  }
});

test('extracts the Zestimate and address from a Zillow property page', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/zillow-property.html`);

    const found = await page.evaluate(async (origin) => {
      const { extractValuation } = await import(`${origin}/extension/src/lib/valuation.js`);
      // The fixture is served from localhost, so pass a Zillow-shaped location.
      return extractValuation(document, {
        hostname: 'www.zillow.com',
        href: 'https://www.zillow.com/homedetails/12345678_zpid/',
      });
    }, `http://127.0.0.1:${port}`);

    assert.ok(found, 'expected a valuation');
    assert.equal(found.value, 661400);
    assert.equal(found.site, 'zillow');
    assert.equal(found.isAvm, true);
    assert.match(found.address, /809 SE 37th St/);
    assert.match(found.address, /98604/);

    // Decoys on the same page must not win.
    assert.notEqual(found.value, 412000);   // last sold price
    assert.notEqual(found.value, 3150);     // rent estimate
    assert.notEqual(found.value, 5880);     // annual tax
  } finally {
    await page.close();
  }
});

test('a Zillow value still resolves when the embedded JSON is gone', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/zillow-property.html`);

    // Simulate Zillow changing its payload shape, which they do regularly.
    const found = await page.evaluate(async (origin) => {
      document.getElementById('__NEXT_DATA__')?.remove();
      const { extractValuation } = await import(`${origin}/extension/src/lib/valuation.js`);
      return extractValuation(document, {
        hostname: 'www.zillow.com',
        href: 'https://www.zillow.com/homedetails/12345678_zpid/',
      });
    }, `http://127.0.0.1:${port}`);

    assert.ok(found, 'should fall back to reading the rendered page');
    assert.equal(found.value, 661400);
    assert.equal(found.source, 'dom');

    // The fallback must still refuse the other large figures on the page.
    // A sold price silently driving a 100% LTV screen is the failure mode
    // this restriction exists for.
    assert.notEqual(found.value, 412000);   // last sold price
    assert.notEqual(found.value, 3150);     // rent estimate
    assert.notEqual(found.value, 5880);     // annual tax
  } finally {
    await page.close();
  }
});

test('a Zillow value only auto-fills when the address matches the lead', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/zillow-property.html`);

    const out = await page.evaluate(async (origin) => {
      const { extractValuation } = await import(`${origin}/extension/src/lib/valuation.js`);
      const { compareAddresses } = await import(`${origin}/extension/src/lib/address.js`);

      const found = extractValuation(document, {
        hostname: 'www.zillow.com',
        href: 'https://www.zillow.com/homedetails/12345678_zpid/',
      });

      return {
        value: found.value,
        // The lead actually on screen.
        sameLead: compareAddresses('809 SE 37TH ST, BATTLE GROUND, WA 98604', found.address).confidence,
        // A different lead the agent happens to be talking to.
        otherLead: compareAddresses('189 LEDGERWOOD LN, ROCKWOOD, TN 37854', found.address).confidence,
        // Same street, wrong house.
        neighbour: compareAddresses('811 SE 37TH ST, BATTLE GROUND, WA 98604', found.address).confidence,
      };
    }, `http://127.0.0.1:${port}`);

    assert.equal(out.value, 661400);
    assert.equal(out.sameLead, 'exact', 'the matching lead should auto-fill');
    assert.equal(out.otherLead, 'none', 'a different property must never auto-fill');
    assert.equal(out.neighbour, 'none', 'the house next door must never auto-fill');
  } finally {
    await page.close();
  }
});

/**
 * Boot the actual content-script orchestrator against the agent screen, with
 * a minimal chrome.* shim. This is the only test that exercises main.js —
 * module wiring, panel mount, detection, merge and render together.
 */
async function bootPanel(page, fixture) {
  const { port } = await setup();
  const origin = `http://127.0.0.1:${port}`;
  await page.goto(`${origin}/test/fixtures/${fixture}`);

  await page.evaluate(async (base) => {
    const store = { enabledSites: { [location.origin]: true } };
    window.chrome = {
      runtime: {
        onMessage: { addListener() {} },
        sendMessage: async () => ({}),
        getURL: (path) => `${base}/extension/${path}`,
      },
      storage: {
        local: {
          async get(key) {
            const keys = Array.isArray(key) ? key : [key];
            const out = {};
            for (const k of keys) if (k in store) out[k] = store[k];
            return out;
          },
          async set(obj) { Object.assign(store, obj); },
        },
      },
    };
    const mod = await import(`${base}/extension/src/content/main.js`);
    await mod.start();
  }, origin);

  await page.waitForFunction(() => !!document.getElementById('__sam_panel_host__'), null,
    { timeout: 5000 });
}

const readPanel = () => {
  const root = document.getElementById('__sam_panel_host__').shadowRoot;
  const text = (sel) => root.querySelector(sel)?.textContent?.trim() ?? null;
  const val = (sel) => root.querySelector(sel)?.value ?? null;
  return {
    balance: val('[data-in=firstLien]'),
    program: val('[data-in=program]'),
    state: val('[data-in=state]'),
    value: val('[data-in=propertyValue]'),
    cash: text('[data-out=cash]'),
    maxLoan: text('[data-out=maxLoan]'),
    equity: text('[data-out=equity]'),
    maxLtv: text('[data-out=maxLtv]'),
    who: text('.who'),
  };
};

test('the content script boots, detects, and computes on the agent screen', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const before = await page.evaluate(readPanel);
    assert.equal(before.balance, '270900', 'balance auto-filled from the form');
    assert.equal(before.program, 'VA', 'dropdown shows the normalized program');
    assert.equal(before.state, 'TN');
    assert.equal(before.value, '', 'no home value on this screen');
    assert.equal(before.cash, '—', 'no cash figure until a value is entered');
    assert.match(before.who, /RANDY D ROLLINS/);

    // The agent types the value.
    const after = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const input = root.querySelector('[data-in=propertyValue]');
      input.value = '400000';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const text = (sel) => root.querySelector(sel)?.textContent?.trim() ?? null;
      return {
        cash: text('[data-out=cash]'),
        maxLoan: text('[data-out=maxLoan]'),
        equity: text('[data-out=equity]'),
        maxLtv: text('[data-out=maxLtv]'),
        verdict: text('[data-out=verdict]'),
      };
    });

    assert.equal(after.maxLtv, '100%', 'VA outside Texas');
    assert.equal(after.maxLoan, '$391,581');
    assert.equal(after.equity, '$129,100');
    assert.equal(after.cash, '$120,681');
    assert.match(after.verdict, /threshold/i);
  } finally {
    await page.close();
  }
});

test('the detector does not read the panel back in as page data', { skip }, async () => {
  // The panel is mounted in an *open* shadow root, which the detector
  // traverses like any other. It renders a "Home value" label beside a
  // currency figure, so without an explicit exclusion it harvests its own
  // output and feeds it back in as though it had come from the page —
  // conjuring a home value on a screen that has none.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const seen = await page.evaluate(async (origin) => {
      const { collectCandidates } = await import(`${origin}/extension/src/lib/detect.js`);
      const candidates = collectCandidates(document);
      return {
        total: candidates.length,
        fromPanel: candidates.filter((c) => c.el?.closest?.('#__sam_panel_host__')).length,
        labels: candidates.map((c) => c.label),
      };
    }, `http://127.0.0.1:${(await setup()).port}`);

    assert.equal(seen.fromPanel, 0, 'no candidate may come from the panel');
    assert.ok(seen.total > 0, 'the page itself is still being read');
    // The panel's own field captions must never appear as detected labels.
    assert.ok(!seen.labels.includes('Home value'));
    assert.ok(!seen.labels.includes('2nd / HELOC'));

    // And the value box must stay empty rather than filling from the panel.
    const value = await page.evaluate(() =>
      document.getElementById('__sam_panel_host__').shadowRoot
        .querySelector('[data-in=propertyValue]').value);
    assert.equal(value, '');
  } finally {
    await page.close();
  }
});

test('clearing a field does not snap back to the page value', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const cleared = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const input = root.querySelector('[data-in=firstLien]');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Outlast a poll tick, which is what used to refill it.
      await new Promise((r) => setTimeout(r, 900));
      return root.querySelector('[data-in=firstLien]').value;
    });

    assert.equal(cleared, '', 'a deliberately emptied field must stay empty');
  } finally {
    await page.close();
  }
});

test('the panel picks up the next call without a reload', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const next = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;

      // Agent enters a value for the current caller.
      const valueInput = root.querySelector('[data-in=propertyValue]');
      valueInput.value = '400000';
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));

      // The dialer swaps in the next lead — no events, no attribute changes.
      window.loadNextRecord({
        id: '7164999', first: 'MARIA', last: 'CHEN', address: '44 OAK ST',
        city: 'AUSTIN', state: 'TX', zip: '78701', balance: '318450', loanType: 'CV',
      });

      await new Promise((r) => setTimeout(r, 1200));
      const text = (sel) => root.querySelector(sel)?.textContent?.trim() ?? null;
      return {
        balance: root.querySelector('[data-in=firstLien]').value,
        program: root.querySelector('[data-in=program]').value,
        state: root.querySelector('[data-in=state]').value,
        value: root.querySelector('[data-in=propertyValue]').value,
        who: text('.who'),
      };
    });

    assert.equal(next.balance, '318450', 'new balance detected');
    assert.equal(next.program, 'CONV', '"CV" normalized for the dropdown');
    assert.equal(next.state, 'TX');
    assert.match(next.who, /MARIA CHEN/);
    // The critical one: the previous caller's home value must not carry over.
    assert.equal(next.value, '', 'the previous record\'s value must be cleared');
  } finally {
    await page.close();
  }
});

test('a Texas record produces the 80% cap end to end', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/agent-screen.html`);

    const result = await page.evaluate(async (origin) => {
      const { collectCandidates, assignFields } = await import(`${origin}/extension/src/lib/detect.js`);
      const { computeEquity } = await import(`${origin}/extension/src/lib/equity.js`);
      const { normalizeProgram, normalizeState } = await import(`${origin}/extension/src/lib/rules.js`);
      const { parseMoney } = await import(`${origin}/extension/src/lib/money.js`);

      document.querySelector('[name=state]').value = 'TX';

      const f = assignFields(collectCandidates(document));
      const raw = (k) => f[k]?.candidate?.raw ?? null;

      return computeEquity({
        propertyValue: 400000,
        firstLien: parseMoney(raw('firstLien')),
        program: normalizeProgram(raw('program')),
        state: normalizeState(raw('state')),
        financeFee: true,
      });
    }, `http://127.0.0.1:${port}`);

    assert.equal(result.state, 'TX');
    assert.equal(result.maxLtv, 0.8);
    assert.equal(result.estimatedCashToBorrower, 42364);
    assert.ok(result.warnings.some((w) => /Texas/i.test(w.text)));
  } finally {
    await page.close();
  }
});

test('a read-only labelled cell is detected, so Number fills in', { skip }, async () => {
  // The phone on the agent screen is displayed text in a table cell, not an
  // input. Without harvesting labelled cells the application's Number field
  // stays permanently empty.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'agent-screen.html');
    assert.equal(got.phone?.raw, '3024239504');
    assert.equal(got.phone?.labelSource, 'cell');
  } finally {
    await page.close();
  }
});

test('the application drawer opens beside the calculator, not above it', { skip }, async () => {
  // Regression: flex wrapping stacked the drawer on top of the panel as soon
  // as a border pushed the row past its declared width.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const box = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const openDrawer = () => {
        if (root.querySelector('[data-app=drawer]').hidden) root.querySelector('[data-act=app]').click();
      };
      openDrawer();
      const drawer = root.querySelector('[data-app=drawer]').getBoundingClientRect();
      const body = root.querySelector('.body').getBoundingClientRect();
      return { drawer: drawer.toJSON(), body: body.toJSON() };
    });

    assert.ok(box.drawer.width > 100, 'drawer is visible');
    assert.ok(box.drawer.right <= box.body.left + 2,
      `drawer must sit left of the calculator (drawer right ${box.drawer.right}, body left ${box.body.left})`);
    assert.ok(Math.abs(box.drawer.top - box.body.top) < 4,
      'drawer and calculator must share a top edge, not stack');
  } finally {
    await page.close();
  }
});

test('the application fills from the record and offers to save once worked on', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const state = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      if (root.querySelector('[data-app=drawer]').hidden) {
        root.querySelector('[data-act=app]').click();
      }

      const v = root.querySelector('[data-in=propertyValue]');
      v.value = '400000';
      v.dispatchEvent(new Event('input', { bubbles: true }));

      const saveBtn = root.querySelector('[data-act=app-save]');
      const read = () => ({
        balance: root.querySelector('[data-app-field=balance]').value,
        value: root.querySelector('[data-app-field=value]').value,
        cashOut: root.querySelector('[data-app-field=cashOut]').value,
        cashOutHint: root.querySelector('[data-app-field=cashOut]').placeholder,
        phone: root.querySelector('[data-app-field=phone]').value,
        // Measured, not asserted from the property: a `hidden` element that
        // CSS still lays out is visible to the agent regardless.
        saveHidden: saveBtn.getBoundingClientRect().width === 0,
      });

      const before = read();

      const income = root.querySelector('[data-app-field=income]');
      income.value = '96000';
      income.dispatchEvent(new Event('input', { bubbles: true }));

      return { before, after: read() };
    });

    assert.equal(state.before.balance, '$270,900');
    assert.equal(state.before.value, '$400,000');
    // The ceiling is offered as guidance; the borrower's actual request is
    // the agent's to enter.
    assert.equal(state.before.cashOut, '');
    assert.equal(state.before.cashOutHint, 'up to $120,681');
    assert.equal(state.before.phone, '3024239504');

    assert.equal(state.before.saveHidden, true, 'auto-fill alone must not offer a save');
    assert.equal(state.after.saveHidden, false, 'the agent\'s own entry does');
  } finally {
    await page.close();
  }
});

test('a new call clears the application but keeps unsaved work as a draft', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      if (root.querySelector('[data-app=drawer]').hidden) {
        root.querySelector('[data-act=app]').click();
      }

      const income = root.querySelector('[data-app-field=income]');
      income.value = '96000';
      income.dispatchEvent(new Event('input', { bubbles: true }));

      window.loadNextRecord({
        id: '7164999', first: 'MARIA', last: 'CHEN', address: '44 OAK ST',
        city: 'AUSTIN', state: 'TX', zip: '78701', balance: '318450', loanType: 'CV',
      });
      await new Promise((r) => setTimeout(r, 1200));

      return {
        income: root.querySelector('[data-app-field=income]').value,
        balance: root.querySelector('[data-app-field=balance]').value,
        draftShown: !root.querySelector('[data-app=draft]').hidden,
        draftText: root.querySelector('[data-app=draft-text]').textContent,
      };
    });

    assert.equal(out.income, '', 'the form clears with the record');
    assert.equal(out.balance, '$318,450', 'and refills from the new one');
    assert.equal(out.draftShown, true, 'unsaved work is not silently discarded');
    assert.match(out.draftText, /RANDY D ROLLINS/);
  } finally {
    await page.close();
  }
});

test('the application drawer is open when the panel loads', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');
    const visible = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      return root.querySelector('[data-app=drawer]').getBoundingClientRect().width > 100;
    });
    assert.equal(visible, true, 'the application is the point of the tool, not an extra');
  } finally {
    await page.close();
  }
});

test('the loan type dropdown options are readable against their popup', { skip }, async () => {
  // Native option lists inherit colour from the select, so a dark-mode or
  // red-tinted select rendered near-invisible text on a light popup.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');
    const styles = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const option = root.querySelector('[data-in=program] option[value=VA]');
      const s = getComputedStyle(option);
      return { color: s.color, background: s.backgroundColor };
    });
    assert.ok(styles.color, 'options declare their own colour');
    assert.notEqual(styles.background, 'rgba(0, 0, 0, 0)',
      'options declare their own background rather than inheriting the field tint');
  } finally {
    await page.close();
  }
});
