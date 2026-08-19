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

import { loadChromium, launch } from './helpers/chromium.mjs';

const chromium = await loadChromium();

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

let ctx = null;

async function setup() {
  if (ctx) return ctx;
  const { server, port } = await startServer();
  const browser = await launch(chromium);
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

test('reads the tax history off the rendered table when the payload has none', { skip }, async () => {
  // The path that has to work when Zillow changes its bundle. The fixture is
  // the real page: a percentage badge inside the tax cell, a current year
  // with no bill yet, and a price-history table directly above with money in
  // it that must not be mistaken for the tax.
  const { browser, port } = await setup();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/test/fixtures/zillow-tax-table.html`);

    const found = await page.evaluate(async (origin) => {
      const { extractTaxHistory } = await import(`${origin}/extension/src/lib/valuation.js`);
      return extractTaxHistory(document, '');
    }, `http://127.0.0.1:${port}`);

    assert.ok(found, 'expected a tax history');
    assert.equal(found.annualTax, 1733, 'the badge in the cell is not part of the figure');
    assert.equal(found.year, 2025, 'the newest year that actually has a bill');
    assert.equal(found.assessment, 264629);
    assert.equal(found.source, 'dom');

    assert.notEqual(found.annualTax, 257900, 'that is a sold price from the table above');
    assert.notEqual(found.annualTax, 264629, 'and that is the assessment beside it');
  } finally {
    await page.close();
  }
});

test('a bot check is recognised so it can be put in front of a human', { skip }, async () => {
  // The failure this covers was a silent one: a background lookup tab landed
  // on a "Press & Hold" page, found no value, and closed itself on the
  // timeout. Nothing reached the panel and nothing said why.
  const { browser, port } = await setup();
  const page = await browser.newPage();
  const origin = `http://127.0.0.1:${port}`;
  try {
    await page.goto(`${origin}/test/fixtures/zillow-blocked.html`);

    const out = await page.evaluate(async (base) => {
      const { detectChallenge, extractValuation } = await import(`${base}/extension/src/lib/valuation.js`);
      return {
        challenge: detectChallenge(document),
        value: extractValuation(document, {
          hostname: 'www.zillow.com',
          href: 'https://www.zillow.com/homes/x_rb/',
        }),
      };
    }, origin);

    assert.ok(out.challenge, 'the verification page must be recognised');
    assert.equal(out.challenge.kind, 'captcha');
    assert.equal(out.value, null, 'and must never yield a figure');
  } finally {
    await page.close();
  }
});

test('an ordinary property page is not mistaken for a bot check', { skip }, async () => {
  const { browser, port } = await setup();
  const page = await browser.newPage();
  const origin = `http://127.0.0.1:${port}`;
  try {
    await page.goto(`${origin}/test/fixtures/zillow-property.html`);
    const challenge = await page.evaluate(async (base) => {
      const { detectChallenge } = await import(`${base}/extension/src/lib/valuation.js`);
      return detectChallenge(document);
    }, origin);
    assert.equal(challenge, null, 'a real page must not be surfaced as a challenge');
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
    cap: text('[data-bar=right]'),
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
        advertised: text('[data-out=advertised]'),
        cashNote: text('[data-out=cashNote]'),
        costLine: text('[data-out=costLine]'),
        cap: text('[data-bar=right]'),
        now: text('[data-bar=left]'),
        verdict: text('[data-out=verdict]'),
      };
    });

    // The panel shows both answers and the LTV meter; the supporting figures
    // are asserted against the calculator itself in equity.test.mjs.
    assert.equal(after.cap, 'Cap 100%', 'VA outside Texas');
    assert.equal(after.now, 'Now 67.7%');
    assert.equal(after.advertised, '$129,100', 'the raw figure, before fee and costs');
    assert.equal(after.cash, '$109,535', 'what the borrower actually receives');
    assert.match(after.cashNote, /after \$19,565/, 'and the gap between them is named');
    assert.match(after.costLine, /Cost to close \$19,565/, 'all in, fee included');
    assert.match(after.costLine, /funding fee/i, 'and split into its two halves');
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

test('collapsing leaves the title bar and nothing else', { skip }, async () => {
  // Regression: the collapse rule was declared above `.wrap.with-drawer`,
  // which carries the same specificity and therefore won. With the drawer
  // open — the default — collapsing kept the two-column grid at full width
  // and only hid the calculator body, so a 980px pill radius stretched the
  // remaining panel into a giant oval sitting over the dialer. It read as a
  // freeze because the thing that was supposed to get out of the way had
  // instead grown.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const wrap = root.querySelector('.wrap');
      const rect = (sel) => root.querySelector(sel).getBoundingClientRect().toJSON();
      const shot = () => ({
        wrap: rect('.wrap'),
        header: rect('.hd'),
        drawer: rect('[data-app=drawer]'),
        body: rect('.body'),
        radius: parseFloat(getComputedStyle(wrap).borderBottomLeftRadius),
      });

      if (root.querySelector('[data-app=drawer]').hidden) root.querySelector('[data-act=app]').click();
      const open = shot();
      root.querySelector('[data-act=collapse]').click();
      const collapsed = shot();
      root.querySelector('[data-act=collapse]').click();
      return { open, collapsed, restored: shot() };
    });

    assert.ok(out.open.drawer.width > 100, 'the drawer starts open');

    assert.equal(out.collapsed.drawer.width, 0, 'the drawer must go with the body');
    assert.equal(out.collapsed.body.width, 0, 'the calculator must be hidden');
    assert.ok(out.collapsed.wrap.height <= out.collapsed.header.height + 2,
      `collapsed panel must be no taller than its title bar (was ${out.collapsed.wrap.height})`);
    assert.ok(out.collapsed.wrap.width < out.open.wrap.width / 2,
      `collapsed panel must shrink (${out.open.wrap.width} -> ${out.collapsed.wrap.width})`);
    assert.ok(out.collapsed.radius < 60,
      `a pill radius on a full-size panel is what drew the oval (was ${out.collapsed.radius})`);

    assert.ok(out.restored.drawer.width > 100, 'expanding brings the application back');
    assert.ok(Math.abs(out.restored.wrap.width - out.open.wrap.width) < 2,
      'and restores the width it had');
  } finally {
    await page.close();
  }
});

test('the assumptions on the panel move the figure and stick', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');   // VA, TN, $270,900 balance

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const settle = () => new Promise((r) => setTimeout(r, 120));
      const cash = () => root.querySelector('[data-out=cash]').textContent.trim();

      const value = root.querySelector('[data-in=propertyValue]');
      value.value = '400000';
      value.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      const financed = cash();

      const toggle = async (key) => {
        const el = root.querySelector(`[data-ovr=${key}]`);
        el.checked = !el.checked;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
      };

      // Paying the funding fee at closing instead of financing it.
      await toggle('financeFee');
      const atClosing = cash();

      // Waiving it altogether.
      await toggle('feeExempt');
      const waived = cash();

      const stored = await window.chrome.storage.local.get('prefs');

      return {
        financed,
        atClosing,
        waived,
        feeShown: root.querySelector('[data-ovr=feeLine]').textContent.trim(),
        prefs: stored.prefs ?? null,
      };
    });

    assert.equal(out.financed, '$109,535', 'fee financed inside the 100% cap');
    assert.equal(out.atClosing, '$109,237', 'an unfinanced fee comes out of the proceeds');
    assert.equal(out.waived, '$117,837', 'no fee leaves only the closing costs');
    assert.match(out.feeShown, /no upfront fee/i, 'and the fee line says so');

    assert.equal(out.prefs.financeFee, false, 'the switch is a standing assumption');
    assert.equal(out.prefs.feeExempt, true);
  } finally {
    await page.close();
  }
});

test('the property preview is up from the start, and stays shut once closed', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const btn = root.querySelector('[data-act=mini]');
      const settle = () => new Promise((r) => setTimeout(r, 150));

      // Intercept the worker so no window is actually opened.
      const sent = [];
      window.chrome.runtime.sendMessage = async (msg) => {
        sent.push(msg);
        if (msg.type === 'SAM_OPEN_MINI') return { ok: true, open: true };
        if (msg.type === 'SAM_CLOSE_MINI') return { ok: true, open: false };
        return {};
      };

      // It opened itself on the record that was already on screen.
      const openedOnLoad = btn.textContent;

      btn.click();
      await settle();
      const afterClose = btn.textContent;

      // A closed preview must not come back on the next call.
      window.loadNextRecord({
        id: '7164777', first: 'MARIA', last: 'CHEN', address: '44 OAK ST',
        city: 'AUSTIN', state: 'TX', zip: '78701', balance: '318450', loanType: 'CV',
      });
      await settle();
      const reopened = sent.filter((m) => m.type === 'SAM_OPEN_MINI').length;

      // Asking for it back cancels that.
      btn.click();
      await settle();
      const asked = sent.filter((m) => m.type === 'SAM_OPEN_MINI').at(-1) ?? null;

      // And from then on it follows each new call again.
      window.loadNextRecord({
        id: '7164666', first: 'DALE', last: 'PARK', address: '12 BIRCH RD',
        city: 'RENO', state: 'NV', zip: '89501', balance: '210000', loanType: 'FHA',
      });
      await settle();
      const followed = sent.filter((m) => m.type === 'SAM_OPEN_MINI').at(-1) ?? null;

      return {
        openedOnLoad,
        afterClose,
        closeSent: sent.some((m) => m.type === 'SAM_CLOSE_MINI'),
        reopened,
        asked,
        followed,
        finalLabel: btn.textContent,
      };
    });

    assert.match(out.openedOnLoad, /close/i, 'the preview is up without being asked for');
    assert.equal(out.closeSent, true);
    assert.match(out.afterClose, /preview/i);

    assert.equal(out.reopened, 0, 'closing it once should be enough');

    assert.ok(out.asked, 'the button brings it back');
    assert.match(decodeURIComponent(out.asked.url), /44 OAK ST/, 'on the record now on screen');
    assert.notEqual(out.asked.focused, false,
      'a click is a request to look at it, so that one does come forward');

    assert.match(decodeURIComponent(out.followed.url), /12 BIRCH RD/, 'and follows the next call');
    assert.equal(out.followed.focused, false,
      'but a call landing never pulls focus off the dialer');
    assert.match(out.finalLabel, /close/i);
  } finally {
    await page.close();
  }
});

test('the panel can be dragged to a new size and remembers it', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const before = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const grip = root.querySelector('.grip').getBoundingClientRect();
      return {
        width: root.querySelector('.body').getBoundingClientRect().width,
        grip: { x: grip.left + grip.width / 2, y: grip.top + grip.height / 2 },
      };
    });

    // The grip is on the bottom-left corner, so dragging left widens.
    await page.mouse.move(before.grip.x, before.grip.y);
    await page.mouse.down();
    await page.mouse.move(before.grip.x - 60, before.grip.y - 20, { steps: 6 });
    await page.mouse.up();

    const after = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const stored = await window.chrome.storage.local.get('panelSize');
      return {
        width: root.querySelector('.body').getBoundingClientRect().width,
        drawer: root.querySelector('[data-app=drawer]').getBoundingClientRect().width,
        stored: stored.panelSize ?? null,
      };
    });

    assert.ok(after.width > before.width + 40,
      `dragging left must widen the panel (${before.width} -> ${after.width})`);
    assert.ok(Math.abs(after.drawer - after.width) < 2,
      'both columns move together rather than going lopsided');
    assert.ok(after.stored?.width > before.width, 'the size survives the next call');
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
        fullName: root.querySelector('[data-app-field=fullName]').value,
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
    assert.equal(state.before.cashOutHint, 'up to $109,535');
    assert.equal(state.before.phone, '3024239504');

    assert.equal(state.before.saveHidden, true, 'auto-fill alone must not offer a save');
    assert.equal(state.after.saveHidden, false, 'the agent\'s own entry does');
  } finally {
    await page.close();
  }
});

test('correcting the application moves the cash-out figure with it', { skip }, async () => {
  // The two halves of the panel are one thing. Fixing the balance on the
  // form and watching the headline sit still would read as the tool being
  // broken, and the agent would be right.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const settle = () => new Promise((r) => setTimeout(r, 120));
      const read = () => ({
        cash: root.querySelector('[data-out=cash]').textContent.trim(),
        value: root.querySelector('[data-in=propertyValue]').value,
        balance: root.querySelector('[data-in=firstLien]').value,
        program: root.querySelector('[data-in=program]').value,
      });

      const type = async (field, text) => {
        const el = root.querySelector(`[data-app-field=${field}]`);
        // Focus first, as a human would: the panel deliberately refuses to
        // write into a field that has the caret in it.
        el.focus();
        el.value = text;
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        await settle();
      };

      await type('value', '400000');
      const afterValue = read();

      await type('balance', '250000');
      const afterBalance = read();

      await type('loanType', 'CONV');
      const afterProgram = read();

      return { afterValue, afterBalance, afterProgram };
    });

    assert.equal(out.afterValue.value, '400000', 'the estimator takes the value from the form');
    assert.equal(out.afterValue.cash, '$109,535');

    assert.equal(out.afterBalance.balance, '250000');
    assert.equal(out.afterBalance.cash, '$130,435', 'a lower payoff frees more cash');

    assert.equal(out.afterProgram.program, 'CONV');
    // 80% of $400,000 less the $250,000 payoff entered a moment ago, less costs.
    assert.equal(out.afterProgram.cash, '$59,925', 'conventional caps at 80% of value');
  } finally {
    await page.close();
  }
});

test('the borrower name survives a screen that mislabels the name boxes', { skip }, async () => {
  // The live failure: every field on a real agent screen read correctly
  // except the two that make up the borrower's name, so the panel header and
  // the application both sat empty on a form that plainly showed both.
  //
  // The cause was structural rather than a missing pattern. Label resolution
  // returns the first thing it finds; when a page hands it the wrong text,
  // that text scores zero for every field and the element is dropped — with
  // `name="first_name"` sitting unread on the very same input. The attribute
  // is now scored alongside the label, at a lower weight, so a wrong label
  // costs precision rather than the whole field.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'vicidial-live.html');

    const out = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      return {
        fullName: root.querySelector('[data-app-field=fullName]').value,
        who: root.querySelector('.who').textContent.trim(),
        balance: root.querySelector('[data-in=firstLien]').value,
        state: root.querySelector('[data-in=state]').value,
        fico: root.querySelector('[data-app-field=fico]').value,
      };
    });

    assert.equal(out.fullName, 'SAMIR GEORGE', 'the name fills from the attributes');
    assert.match(out.who, /SAMIR GEORGE/, 'and the header names who is on the phone');
    assert.match(out.who, /SIMPSONVILLE, SC/);

    // The rest of the screen must not have been disturbed by the fallback.
    assert.equal(out.balance, '131853');
    assert.equal(out.state, 'SC');
    assert.equal(out.fico, '655');
  } finally {
    await page.close();
  }
});

test('a visible label still beats the attribute under it', { skip }, async () => {
  // The relabelling case this tool was built for: the balance box is really
  // named `vendor_lead_code`, and scoring the attribute must not undo that.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const got = await detectOn(page, 'agent-screen.html');
    assert.equal(got.firstLien?.raw, '270900');
    assert.notEqual(got.firstLien?.labelSource, 'name');
    assert.equal(got.firstName?.raw, 'RANDY D');
    assert.equal(got.lastName?.raw, 'ROLLINS');
  } finally {
    await page.close();
  }
});

test('a name field bound by hand fills the application', { skip }, async () => {
  // The escape hatch for a screen this cannot read. Detection covers First
  // and Last boxes and a combined name field; a dialer that labels it
  // something else entirely is a screen nobody here can see, so the agent
  // points at it once and it sticks for that page.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const before = await page.evaluate(() => {
      // A name box this detector has no pattern for, put somewhere the
      // pointer can reach it.
      const odd = document.createElement('input');
      odd.type = 'text';
      odd.id = 'odd_name_box';
      odd.value = 'DOROTHY VANCE-HOLLIS';
      odd.style.cssText = 'position:fixed;left:20px;top:400px;width:260px;z-index:9';
      document.body.appendChild(odd);

      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      root.querySelector('[data-act=pick-fullName]').click();
      return root.querySelector('[data-app-field=fullName]').value;
    });

    // A real pointer: the picker tracks what is under the cursor, which is
    // how it knows what a click means.
    const box = await page.evaluate(() => {
      const r = document.getElementById('odd_name_box').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.click(box.x, box.y);

    await page.waitForFunction(
      () => document.getElementById('__sam_panel_host__').shadowRoot
        .querySelector('[data-app-field=fullName]').value === 'DOROTHY VANCE-HOLLIS',
      null,
      { timeout: 4000 },
    ).catch(() => {});

    const after = await page.evaluate(() => document.getElementById('__sam_panel_host__')
      .shadowRoot.querySelector('[data-app-field=fullName]').value);

    assert.equal(before, 'RANDY D ROLLINS', 'detection had already found the split name');
    assert.equal(after, 'DOROTHY VANCE-HOLLIS',
      'a field bound by hand outranks anything the detector guessed');
  } finally {
    await page.close();
  }
});

test('Save downloads the application as a PDF', { skip }, async () => {
  // The point of saving is that somebody gets handed the file. A save that
  // only writes to extension storage is a save nobody can act on.
  const { browser } = await setup();
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await bootPanel(page, 'agent-screen.html');

    await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const type = (sel, text) => {
        const el = root.querySelector(sel);
        el.focus();
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      type('[data-in=propertyValue]', '400000');
      type('[data-app-field=income]', '96000');
      await new Promise((r) => setTimeout(r, 200));
    });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.evaluate(() => document.getElementById('__sam_panel_host__')
        .shadowRoot.querySelector('[data-act=app-save]').click()),
    ]);

    assert.match(download.suggestedFilename(), /^SAM-RANDY-D-ROLLINS-\d{8}-\d{4}\.pdf$/);

    const file = await download.path();
    const bytes = await fs.readFile(file);
    const raw = bytes.toString('latin1');

    assert.ok(raw.startsWith('%PDF-1.4'), 'a real PDF, not an empty blob');
    assert.ok(bytes.length > 2000, `expected a populated document, got ${bytes.length} bytes`);

    const shown = [...raw.matchAll(/\((.*?)\) Tj/g)]
      .map((m) => m[1].replace(/\\([()\\])/g, '$1'))
      .join('\n');

    assert.match(shown, /RANDY D ROLLINS/);
    assert.match(shown, /\$129,100/, 'the advertised figure');
    assert.match(shown, /\$109,535/, 'the take-home figure');
    assert.match(shown, /\$96,000/, 'what the agent entered');
    assert.match(shown, /not a quote/i, 'and the disclaimer');

    // The button says what happened.
    const label = await page.evaluate(() => document.getElementById('__sam_panel_host__')
      .shadowRoot.querySelector('[data-act=app-save]').textContent);
    assert.match(label, /PDF/);
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

/* --- handing the application to Salesforce ------------------------------ */

const LEAD_ADDRESS = {
  street: '189 LEDGERWOOD LN', city: 'ROCKWOOD', state: 'TN', zip: '37854',
};

async function fillSalesforce(page, { coBorrower = false, addressParts = LEAD_ADDRESS } = {}) {
  const { port } = await setup();
  const origin = `http://127.0.0.1:${port}`;
  await page.goto(`${origin}/test/fixtures/salesforce-application.html`);
  if (coBorrower) await page.click('#add-co');

  return page.evaluate(async ({ base, withCo, parts }) => {
    const { planFill } = await import(`${base}/extension/src/lib/salesforce.js`);
    const { fillForm } = await import(`${base}/extension/src/content/fill.js`);

    const v = (value) => ({ value });
    const application = {
      fullName: v('RANDY D ROLLINS'),
      fico: v('712'), phone: v('3024239504'),
      income: v('$96,000'), disability: v('30%'),
      // Deliberately absent: the real application holds one address line, and
      // the parts travel separately. Putting them here would test a shape
      // that never occurs.
      coFullName: v('JANE ROLLINS'),
      coFico: v('698'), coIncome: v('$54,000'),
    };

    const plan = planFill(application, { includeCoBorrower: withCo, addressParts: parts });
    const result = fillForm(plan.entries);

    const byName = (n) => document.querySelector(`[name="${n}"]`)?.value ?? null;
    return {
      result,
      plan: { missing: plan.missing, lookups: plan.lookups.map((l) => l.key) },
      // What the framework's own listeners saw, not just what the DOM holds.
      observed: window.__observed,
      values: {
        first: byName('b-01'), last: byName('b-03'), fico: byName('b-05'),
        phone: byName('b-07'), street: byName('b-09'), city: byName('b-10'),
        state: byName('b-11'), zip: byName('b-12'), income: byName('b-15'),
        disability: byName('b-20'),
        lead: byName('l-01'), loanOfficer: byName('l-03'),
        email: byName('b-06'), ssn: byName('b-18'), marital: byName('b-19'),
        coFirst: byName('c-01'), coLast: byName('c-02'), coFico: byName('c-03'),
        coIncome: byName('c-05'),
      },
    };
  }, { base: origin, withCo: coBorrower, parts: addressParts });
}

test('fills the Salesforce borrower section by label', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values, result } = await fillSalesforce(page);

    assert.equal(values.first, 'RANDY D');
    assert.equal(values.last, 'ROLLINS');
    assert.equal(values.fico, '712');
    assert.equal(values.phone, '3024239504');
    assert.equal(values.street, '189 LEDGERWOOD LN');
    assert.equal(values.city, 'ROCKWOOD');
    assert.equal(values.state, 'TN');
    assert.equal(values.zip, '37854');
    assert.deepEqual(result.notFound, []);
  } finally {
    await page.close();
  }
});

test('the property address fills the four boxes the form asks for', { skip }, async () => {
  // S.A.M holds the address as one line for the agent. The form wants it in
  // four, and without the parts those four entries matched nothing — the
  // address simply never left the panel.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const withParts = await fillSalesforce(page, { addressParts: LEAD_ADDRESS });
    assert.equal(withParts.values.street, '189 LEDGERWOOD LN');
    assert.equal(withParts.values.city, 'ROCKWOOD');
    assert.equal(withParts.values.state, 'TN');
    assert.equal(withParts.values.zip, '37854');

    // And without them the four boxes stay empty rather than being guessed at.
    const without = await fillSalesforce(page, { addressParts: {} });
    assert.equal(without.values.street, '');
    assert.equal(without.values.city, '');
    assert.equal(without.values.zip, '');
  } finally {
    await page.close();
  }
});

test('figures arrive as numbers, not as formatted text', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values } = await fillSalesforce(page);
    assert.equal(values.income, '96000', 'currency formatting must be stripped');
    assert.equal(values.disability, '30', 'the percent sign must be stripped');
  } finally {
    await page.close();
  }
});

test('the framework actually sees the change', { skip }, async () => {
  // Assigning .value directly leaves a Salesforce component unaware — the box
  // looks filled and submits empty. This asserts the events fired.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { observed } = await fillSalesforce(page);
    assert.equal(observed['b-01'], 'RANDY D');
    assert.equal(observed['b-15'], '96000');
    assert.ok(Object.keys(observed).length >= 8);
  } finally {
    await page.close();
  }
});

test('lookups, picklists and unknown fields are left alone', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values, plan } = await fillSalesforce(page);

    // A lookup that looks filled but holds no record is worse than an empty one.
    assert.equal(values.lead, '');
    assert.equal(values.loanOfficer, '');
    assert.equal(values.marital, '--None--');

    // Never captured, so never guessed at.
    assert.equal(values.email, '');
    assert.equal(values.ssn, '');

    assert.ok(plan.missing.includes('SSN'));
  } finally {
    await page.close();
  }
});

test('the co-borrower fills its own section, not the borrower\'s', { skip }, async () => {
  // Both sections label their fields "First Name". Landing a co-borrower in
  // the primary's box would silently corrupt the application.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values } = await fillSalesforce(page, { coBorrower: true });

    assert.equal(values.first, 'RANDY D', 'primary keeps its own name');
    assert.equal(values.last, 'ROLLINS');
    assert.equal(values.coFirst, 'JANE');
    assert.equal(values.coLast, 'ROLLINS');
    assert.equal(values.coFico, '698');
    assert.equal(values.coIncome, '54000');
  } finally {
    await page.close();
  }
});

test('no co-borrower section means no co-borrower values anywhere', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values } = await fillSalesforce(page, { coBorrower: false });
    assert.equal(values.coFirst, '', 'the hidden section must be left untouched');
    assert.equal(values.first, 'RANDY D');
  } finally {
    await page.close();
  }
});

test('the full name is split into the two fields Salesforce wants', { skip }, async () => {
  // S.A.M shows one name box; the form has First and Last. Splitting happens
  // on the way out so nobody types the same name twice.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { values } = await fillSalesforce(page, { coBorrower: true });
    assert.equal(values.first, 'RANDY D');
    assert.equal(values.last, 'ROLLINS');
    assert.equal(values.coFirst, 'JANE');
    assert.equal(values.coLast, 'ROLLINS');
  } finally {
    await page.close();
  }
});

/* --- lookups ------------------------------------------------------------ */

async function runLookups(page, { defaults, borrower = 'RANDY D ROLLINS' } = {}) {
  const { port } = await setup();
  const origin = `http://127.0.0.1:${port}`;
  await page.goto(`${origin}/test/fixtures/salesforce-application.html`);

  return page.evaluate(async ({ base, lookupDefaults, name }) => {
    const { planFill } = await import(`${base}/extension/src/lib/salesforce.js`);
    const { fillLookups } = await import(`${base}/extension/src/content/fill.js`);

    const application = { fullName: { value: name } };
    const plan = planFill(application, { lookupDefaults });
    const results = await fillLookups(plan.lookups);

    return {
      results,
      selected: window.__selected,
      values: {
        lead: document.querySelector('[name="l-01"]').value,
        transferAgent: document.querySelector('[name="l-02"]').value,
        loanOfficer: document.querySelector('[name="l-03"]').value,
      },
    };
  }, { base: origin, lookupDefaults: defaults, name: borrower });
}

test('a lookup is searched and the matching record actually selected', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { results, selected } = await runLookups(page, {
      defaults: { loanOfficer: 'JANE SMITH', transferAgent: 'DALE CARTER' },
    });

    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    assert.equal(byKey.lead.ok, true, 'the Lead is linked from the borrower name');
    assert.equal(byKey.loanOfficer.ok, true);
    assert.equal(byKey.transferAgent.ok, true);

    // A record was picked, not merely typed — this is the distinction that
    // separates a real link from a box that looks filled.
    assert.equal(selected['l-01'], 'RANDY D ROLLINS');
    assert.equal(selected['l-03'], 'JANE SMITH');
    assert.equal(selected['l-02'], 'DALE CARTER');
  } finally {
    await page.close();
  }
});

test('an ambiguous search is never resolved by guessing', { skip }, async () => {
  // Five Richards. Taking the first would attach the application to somebody
  // else's file.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { results, selected } = await runLookups(page, {
      defaults: { loanOfficer: 'RICHARD' },
      borrower: 'RICHARD',
    });

    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    assert.equal(byKey.loanOfficer.ok, false);
    assert.equal(byKey.loanOfficer.reason, 'ambiguous');
    assert.ok(byKey.loanOfficer.matched > 1, 'the count is reported so the agent knows why');
    assert.equal(selected['l-03'], undefined, 'nothing was selected');
  } finally {
    await page.close();
  }
});

test('a full name resolves where the first name alone would not', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { results, selected } = await runLookups(page, {
      defaults: { loanOfficer: 'RICHARD SASKO' },
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    assert.equal(byKey.loanOfficer.ok, true);
    assert.equal(selected['l-03'], 'RICHARD SASKO');
  } finally {
    await page.close();
  }
});

test('a name with no matching record is left alone', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { results, selected } = await runLookups(page, {
      defaults: { loanOfficer: 'NOBODY ATALL' },
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    assert.equal(byKey.loanOfficer.ok, false);
    assert.ok(['no-results', 'no-match'].includes(byKey.loanOfficer.reason));
    assert.equal(selected['l-03'], undefined);
  } finally {
    await page.close();
  }
});

test('an unconfigured lookup is not attempted at all', { skip }, async () => {
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    const { results } = await runLookups(page, { defaults: {} });
    const keys = results.map((r) => r.key);
    assert.deepEqual(keys, ['lead'], 'only the Lead, which comes from the borrower');
  } finally {
    await page.close();
  }
});

/* --- the figure that goes into Easy Qualifier --------------------------- */

test('the loan amount is built from the application and the tax bill', { skip }, async () => {
  // The method the floor runs, end to end on a real screen: six months of
  // escrow off the Zillow tax bill, the flat charges, the payoff and the
  // cash, grossed up. This is the number an agent types into EQ, so it is
  // asserted to the dollar rather than to a range.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const type = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const settle = () => new Promise((r) => setTimeout(r, 60));

      const read = () => ({
        final: root.querySelector('[data-eq=final]').textContent.trim(),
        note: root.querySelector('[data-eq=note]').textContent.trim(),
        rows: [...root.querySelectorAll('.eq-row')]
          .map((row) => row.textContent.replace(/\s+/g, ' ').trim()),
        why: [...root.querySelectorAll('.eq-why')].map((el) => el.textContent.trim()),
        src: root.querySelector('[data-eq=taxsrc]').textContent.trim(),
      });

      const before = read();

      type('[data-app-field=balance]', '270900');
      await settle();
      type('[data-app-field=cashOut]', '96000');
      await settle();
      const noTax = read();

      type('[data-in=annualPropertyTax]', '1733');
      await settle();
      return { before, noTax, after: read() };
    });

    // Nothing invented while a line is still missing.
    assert.equal(out.noTax.final, '—', 'no loan amount without the tax bill');
    assert.match(out.noTax.note, /property tax/i, 'and it says which line is holding it up');

    // 1,366.50 escrow + 1,500 title + 270,900 payoff + 96,000 cash
    // + 700 appraisal + 2,000 underwriting = 372,466.50, x 1.035.
    assert.equal(out.after.final, '$385,503');
    assert.match(out.after.note, /Loan Amount/i);

    const rows = out.after.rows.join(' | ');
    assert.match(rows, /Escrows, 6 months\$1,367/);
    assert.match(rows, /Title fees\$1,500/);
    assert.match(rows, /Mortgage payoff\$270,900/);
    assert.match(rows, /Cash to borrower\$96,000/);
    assert.match(rows, /Appraisal\$700/);
    assert.match(rows, /Underwriting\$2,000/);
    assert.match(rows, /Subtotal\$372,467/);
    // The column has to add up on the page, not only in the model.
    assert.match(rows, /Gross-up × 1\.035\+\$13,036/);
    assert.match(rows, /Loan amount\$385,503/);

    // The escrow line shows its working, because it is the one that gets
    // argued with on the call.
    assert.ok(out.after.why.some((w) => /\$1,733 tax \+ \$1,000 insurance, 6 of 12 months/.test(w)),
      `escrow working not shown: ${JSON.stringify(out.after.why)}`);
    assert.match(out.after.src, /entered by hand/);
  } finally {
    await page.close();
  }
});

test('the rest of the Easy Qualifier form is listed beside it', { skip }, async () => {
  // The agent reads down the panel and types into EQ, so the panel has to
  // show EQ's fields under EQ's names — including the ones nothing can fill,
  // which are the ones worth seeing before the quote comes back wrong.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const type = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      };
      const settle = () => new Promise((r) => setTimeout(r, 60));

      type('[data-in=propertyValue]', '400000');
      await settle();
      type('[data-in=annualPropertyTax]', '1733');
      await settle();
      type('[data-app-field=balance]', '270900');
      await settle();
      type('[data-app-field=cashOut]', '96000');
      await settle();
      type('[data-app-field=fico]', '712');
      await settle();

      const rows = {};
      for (const row of root.querySelectorAll('.eq-f')) {
        rows[row.querySelector('.eq-fn').textContent.replace('*', '').trim()] =
          row.querySelector('.eq-fv').textContent.trim();
      }
      return {
        rows,
        marks: [...root.querySelectorAll('.eq-fm .k')].map((el) => el.textContent.trim()),
        needs: [...root.querySelectorAll('.eq-f.need .eq-fn')].map((el) => el.textContent.trim()),
      };
    });

    assert.equal(out.rows['Borrower Name'], 'RANDY D ROLLINS');
    assert.equal(out.rows['Appraised Value'], '$400,000');
    assert.equal(out.rows['Loan Type'], 'VA');
    assert.equal(out.rows['Qualifying Credit Score'], '712');
    assert.equal(out.rows['ZIP Code'], '37854');
    assert.equal(out.rows['Loan Amount'], '$385,503');

    // EQ requires these two and nothing here can fill them, so they are
    // listed empty rather than dropped.
    assert.equal(out.rows['Occupancy'], '—');
    assert.equal(out.rows['Property Type'], '—');

    // A VA file gets VA's own words for the refinance, not the generic pair.
    assert.equal(out.rows['Refinance Purpose'], 'VA cash-out - type II');

    // The list ends at Borrower Income: everything past it sits at zero in
    // EQ and does not move the quote.
    for (const dropped of ['Monthly Debt', 'Taxes (annual)',
      'Homeowners Insurance (annual)', 'Employment Options']) {
      assert.equal(out.rows[dropped], undefined, `${dropped} should not be listed`);
    }

    // The three kinds are told apart, because they are not equally
    // trustworthy and the agent is the one who has to defend them.
    assert.ok(out.marks.includes('calculated'), 'the loan amount is marked as worked out');
    assert.ok(out.marks.includes('assumed'), 'and the standing choices as assumptions');

    // And flagged, because a required box left empty is what sends a quote
    // back from EQ rather than out to the borrower.
    assert.ok(out.needs.some((n) => /Property Type/.test(n)),
      `required gaps not flagged: ${JSON.stringify(out.needs)}`);
    assert.ok(out.needs.some((n) => /Occupancy/.test(n)));
  } finally {
    await page.close();
  }
});

test('the payment from Easy Qualifier comes back as two debt ratios', { skip }, async () => {
  // The round trip: S.A.M sizes the loan, EQ prices it, and the payment
  // comes back here to answer whether the borrower can carry it. Both
  // ratios show; only the ones with a limit behind them carry a verdict.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const type = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      };
      const settle = () => new Promise((r) => setTimeout(r, 60));
      const read = () => ({
        rows: [...root.querySelectorAll('.dti-row')].map((row) => ({
          label: row.querySelector('span').textContent.trim(),
          value: row.querySelector('b').textContent.trim(),
          note: row.querySelector('i').textContent.trim(),
          verdict: row.className.replace('dti-row', '').trim(),
        })),
        empty: root.querySelector('.dti-none')?.textContent.trim() ?? null,
        src: root.querySelector('[data-dti=src]').textContent.trim(),
        warn: [...root.querySelectorAll('.dti-warn')].map((el) => el.textContent.trim()),
      });

      const before = read();
      type('[data-app-field=income]', '7400');
      await settle();
      const noPiti = read();

      type('[data-in=piti]', '2417.19');
      await settle();
      const va = read();

      // Same file, priced conventional: the tighter housing ratio bites.
      type('[data-in=program]', 'CONV');
      await settle();
      return { before, noPiti, va, conv: read() };
    });

    assert.match(out.noPiti.empty, /PITI/, 'it asks for the payment rather than showing nothing');

    // 2,417.19 / 7,400 = 32.66%, which clears VA's 35.
    assert.equal(out.va.rows.length, 1, 'front-end only');
    const [front] = out.va.rows;
    assert.equal(front.label, 'Front-end');
    assert.equal(front.value, '32.66%');
    assert.equal(front.verdict, 'ok');
    assert.match(front.note, /under 35%, 2\.34 pts of room/);
    assert.match(out.va.src, /VA — 35% front-end/);

    // Conventional holds it at 32, so the same file flips — and the red
    // number comes with the payment that would have worked.
    assert.equal(out.conv.rows[0].value, '32.66%');
    assert.equal(out.conv.rows[0].verdict, 'no');
    assert.match(out.conv.rows[0].note, /over 32% — needs a payment under \$2,368/);
    assert.match(out.conv.src, /CONV — 32% front-end/);
  } finally {
    await page.close();
  }
});

test('a loan sized past the programme cap says so on the panel', { skip }, async () => {
  // The two halves of the panel are computed independently: the loan is
  // sized from what the borrower needs, the cap comes from the programme.
  // On a conventional file they disagree, and the agent must not be the one
  // who has to notice.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(async () => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const type = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      };
      const settle = () => new Promise((r) => setTimeout(r, 60));
      const over = () => root.querySelector('[data-eq=over]').textContent.trim();

      type('[data-in=propertyValue]', '400000');
      await settle();
      type('[data-in=annualPropertyTax]', '1733');
      await settle();
      type('[data-app-field=balance]', '270900');
      await settle();
      type('[data-app-field=cashOut]', '96000');
      await settle();
      const va = over();

      type('[data-in=program]', 'CONV');
      await settle();
      const conv = over();

      // Cut the cash-out until it fits under the 80% cap.
      type('[data-app-field=cashOut]', '30000');
      await settle();
      return { va, conv, trimmed: over() };
    });

    assert.equal(out.va, '', 'VA at 100% has room for this loan');
    assert.match(out.conv, /Over the 80% cap of \$320,000 by \$65,503/);
    assert.match(out.conv, /cannot be written as sized/);
    assert.equal(out.trimmed, '', 'and it clears once the cash-out comes down');
  } finally {
    await page.close();
  }
});

test('the seven fields the answer depends on are picked out', { skip }, async () => {
  // A sixteen-row form where every row looks the same hides which blanks
  // actually stop a quote. These seven feed the loan amount, the debt
  // ratio, or both.
  const { browser } = await setup();
  const page = await browser.newPage();
  try {
    await bootPanel(page, 'agent-screen.html');

    const out = await page.evaluate(() => {
      const root = document.getElementById('__sam_panel_host__').shadowRoot;
      const rows = [...root.querySelectorAll('.app-row')];
      const labelOf = (row) => row.querySelector('.app-label').textContent.trim();
      const keys = rows.filter((r) => r.classList.contains('key'));
      const plain = rows.find((r) => !r.classList.contains('key'));
      return {
        keys: keys.map(labelOf),
        keyBg: getComputedStyle(keys[0]).backgroundColor,
        plainBg: getComputedStyle(plain).backgroundColor,
      };
    });

    assert.deepEqual(out.keys, [
      'Full name', 'Mortgage balance', 'FICO', 'Cash-out',
      'Value', 'Monthly income', 'Loan type',
    ]);
    assert.notEqual(out.keyBg, out.plainBg, 'and they sit on a different ground');
    assert.notEqual(out.keyBg, 'rgba(0, 0, 0, 0)');
  } finally {
    await page.close();
  }
});
