/**
 * Reading a home value off a valuation site the user has open.
 *
 * Scope, deliberately: this only ever reads a page that is already loaded in
 * the user's own browser, in their own session, rendered normally — the same
 * thing any browser extension does. It does not fetch, crawl, or request
 * anything from these sites in the background. Automated retrieval is both
 * against their terms of use and, at any volume, self-defeating: bot
 * protection blocks it within minutes.
 *
 * Site markup changes often, so extraction is layered and degrades rather
 * than breaking: structured JSON embedded in the page first, then the
 * generic label-based detector against what is rendered.
 *
 * Both layers only ever accept a figure that is identified as a valuation.
 * Listing pages carry list prices, sold prices and tax assessments, and any
 * of those read as a home value would be wrong in a way that looks entirely
 * plausible.
 */

import { collectCandidates, assignFields } from './detect.js';
import { parseMoney } from './money.js';

/** Sites this understands. */
export const VALUATION_HOSTS = [
  { match: /(^|\.)zillow\.com$/i, site: 'zillow', label: 'Zillow' },
  { match: /(^|\.)redfin\.com$/i, site: 'redfin', label: 'Redfin' },
];

/** Identify a valuation site by hostname, or null. */
export function valuationSite(hostname) {
  if (!hostname) return null;
  return VALUATION_HOSTS.find((h) => h.match.test(hostname)) ?? null;
}

/** Plausible band for a US home value; anything outside is a misread. */
const VALUE_RANGE = [20000, 25000000];

/* ------------------------------------------------------------------ *
 * Bot checks
 * ------------------------------------------------------------------ */

/**
 * Recognise a page that is asking a human to prove they are one.
 *
 * This matters most where it is least visible. A lookup opened in a
 * background tab is invisible by design, so a "Press & Hold to confirm you
 * are a human" page sits there unseen until the tab closes itself, and the
 * agent is told nothing — the value simply never arrives. On a call floor
 * sharing one office IP that is not rare, it is most mornings.
 *
 * So the challenge is detected and the tab is brought to the front instead,
 * where a two-second hold clears it and the value comes back through the
 * ordinary path. Nothing here attempts to solve or bypass the check: it is
 * a human verification, and putting it in front of the human is the point.
 *
 * Matching is on rendered text and on the containers the common vendors
 * mount — PerimeterX, Cloudflare, reCAPTCHA, hCaptcha — and is deliberately
 * anchored to short pages. A property page mentioning the word "captcha"
 * somewhere in a review is not a challenge.
 */
const CHALLENGE_SELECTORS = [
  '#px-captcha',                 // PerimeterX, which is what Zillow uses
  '[id^="px-captcha"]',
  '#challenge-form',             // Cloudflare
  '#cf-challenge-running',
  '.cf-browser-verification',
  '.g-recaptcha',
  '#recaptcha',
  '.h-captcha',
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  'iframe[title*="challenge" i]',
];

const CHALLENGE_PHRASES = [
  /press\s*(&|and)\s*hold/i,
  /confirm you are a human/i,
  /verify (that )?you('re| are) (a )?human/i,
  /are you a human/i,
  /prove you('re| are) not a robot/i,
  /i'?m not a robot/i,
  /unusual (traffic|activity)/i,
  /automated (requests|traffic)/i,
  /access to this page has been denied/i,
  /checking your browser before/i,
  /please verify you are a human/i,
];

/** A challenge page is short. Anything long is a real page. */
const CHALLENGE_TEXT_CAP = 4000;

/**
 * @returns {{ kind: string, label: string }|null}
 */
export function detectChallenge(doc = document) {
  try {
    for (const selector of CHALLENGE_SELECTORS) {
      const el = doc.querySelector(selector);
      // A hidden reCAPTCHA badge rides along on plenty of ordinary forms, so
      // the container has to actually be rendered to count.
      if (el && isRendered(el)) {
        return { kind: 'captcha', label: 'verification' };
      }
    }

    const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > CHALLENGE_TEXT_CAP) return null;

    for (const re of CHALLENGE_PHRASES) {
      if (re.test(text)) return { kind: 'challenge', label: 'verification' };
    }
  } catch { /* hostile or torn-down document */ }

  return null;
}

function isRendered(el) {
  try {
    const r = el.getBoundingClientRect?.();
    if (r && (r.width > 0 || r.height > 0)) return true;
    // A challenge that has not laid out yet still counts if it is in the tree
    // and not explicitly hidden.
    return !!el.ownerDocument?.defaultView
      && el.ownerDocument.defaultView.getComputedStyle(el).display !== 'none';
  } catch {
    return true;
  }
}

/**
 * Extract { value, valueLabel, address, site, source } from a document,
 * or null when the page isn't a property page or nothing could be read.
 */
export function extractValuation(doc = document, loc = location) {
  const site = valuationSite(loc?.hostname);
  if (!site) return null;

  const html = rawScripts(doc);

  const value =
    fromEmbeddedJson(html) ??
    fromDom(doc);

  if (value == null) return null;
  if (value.amount < VALUE_RANGE[0] || value.amount > VALUE_RANGE[1]) return null;

  const address = extractAddress(doc, html);
  if (!address) return null;   // without an address it cannot be matched safely

  const tax = extractTaxHistory(doc, html);

  return {
    value: value.amount,
    valueLabel: value.label,
    address,
    site: site.site,
    siteLabel: site.label,
    source: value.source,
    url: loc?.href ?? null,
    isAvm: true,

    // The escrow estimate is six months of taxes and insurance, and this is
    // where the taxes come from. Null when the page has no tax history —
    // some do not — and the panel says so rather than inventing a figure.
    annualPropertyTax: tax?.annualTax ?? null,
    taxYear: tax?.year ?? null,
    taxAssessment: tax?.assessment ?? null,
    taxSource: tax?.source ?? null,
  };
}

/**
 * Make the page render the section the tax history lives in.
 *
 * This is the whole of "the escrow only calculates when I manually scroll
 * down on the Zillow page". Zillow mounts Public tax history when it comes
 * near the viewport, so on a listing nobody has scrolled the figure is not
 * in the document at all — there is nothing to parse and no amount of
 * parsing finds it.
 *
 * So the page gets scrolled, which is exactly what the agent was doing by
 * hand. It aims at the heading when one is already there, otherwise steps
 * down the page, checks after every step, stops the moment the figure
 * appears, and puts the scroll position back where it found it. The caller
 * runs it once per page and only while the tax is missing: a window that
 * scrolls itself repeatedly under someone reading it is worse than a
 * missing escrow line.
 *
 * @returns {Promise<boolean>} whether a tax history exists at the end
 */
export async function revealTaxHistory(doc = document, win = window, { stepMs = 400 } = {}) {
  if (extractTaxHistory(doc)) return true;

  const wasAt = win.scrollY ?? 0;
  const pause = () => new Promise((resolve) => { win.setTimeout(resolve, stepMs); });
  let found = false;

  try {
    const heading = [...doc.querySelectorAll('h1,h2,h3,h4')]
      .find((h) => /tax history/i.test(h.textContent ?? ''));
    if (heading) {
      heading.scrollIntoView({ block: 'center' });
      await pause();
      found = !!extractTaxHistory(doc);
    }

    if (!found) {
      const height = doc.documentElement?.scrollHeight ?? 0;
      for (const fraction of [0.4, 0.6, 0.8, 0.95]) {
        win.scrollTo(0, height * fraction);
        await pause();
        if (extractTaxHistory(doc)) { found = true; break; }
      }
    }
  } catch { /* a hostile or torn-down document */ }

  try {
    win.scrollTo(0, wasAt);
  } catch { /* nothing to restore to */ }

  return found;
}

/**
 * The tax bill on its own, for a page whose value cannot be read.
 *
 * An off-market home, a listing with the estimate suppressed, a layout
 * change that breaks the value pattern — none of those are reasons to lose
 * a tax history that is sitting in plain sight. The address is still
 * required, because a tax figure attached to the wrong property is worse
 * than none, and the shape matches a valuation with a null value so the
 * panel needs no second code path.
 */
export function extractTaxOnly(doc = document, loc = location) {
  const site = valuationSite(loc?.hostname);
  if (!site) return null;

  const html = rawScripts(doc);
  const tax = extractTaxHistory(doc, html);
  if (!tax) return null;

  const address = extractAddress(doc, html);
  if (!address) return null;

  return {
    value: null,
    valueLabel: null,
    address,
    site: site.site,
    siteLabel: site.label,
    source: tax.source,
    url: loc?.href ?? null,
    isAvm: false,
    annualPropertyTax: tax.annualTax,
    taxYear: tax.year,
    taxAssessment: tax.assessment,
    taxSource: tax.source,
  };
}

/* ------------------------------------------------------------------ *
 * Public tax history
 * ------------------------------------------------------------------ */

/** A plausible annual property-tax bill. */
const TAX_RANGE = [50, 250000];

/**
 * The most recent year's property tax, off the listing page.
 *
 * Zillow renders a "Public tax history" table — year, property taxes, tax
 * assessment — and carries the same rows in its embedded payload. The
 * payload is tried first because it survives a markup change, and the table
 * is the fallback.
 *
 * Two rules, both learned from the shape of the failure rather than the
 * shape of the page. Only a row that actually has a tax figure counts: the
 * current year is often listed with the assessment filled in and the tax
 * blank, and reading that as a zero bill would knock six hundred dollars off
 * an escrow estimate. And the assessment is never accepted as the tax — the
 * two sit in adjacent columns and differ by a factor of a hundred and fifty,
 * which is the kind of mistake that looks fine until it closes.
 *
 * @returns {{ year: number, annualTax: number, assessment: number|null,
 *             source: string }|null}
 */
export function extractTaxHistory(doc = document, html = null) {
  const source = html ?? rawScripts(doc);
  return fromTaxJson(source) ?? fromTaxTable(doc);
}

function fromTaxJson(html) {
  if (!html) return null;

  // Both spellings, and this is the whole reason the escrow line was only
  // filling in now and then. Zillow does not put the property object in the
  // payload directly — it puts a JSON *string* in there, under
  // gdpClientCache, so on the real page every quote arrives backslashed:
  // \"taxPaid\":1733. A pattern looking for "taxPaid" matches the tidy
  // shape a fixture is written in and nothing at all on the live page, so
  // the only path that ever worked was the rendered table, which is why it
  // seemed to depend on how far the agent had scrolled.
  const rows = [];
  const unescaped = html.includes('\\"') ? unescapeJson(html) : null;
  for (const text of [html, unescaped]) {
    if (!text) continue;
    for (const match of text.matchAll(/\{[^{}]{0,400}?"taxPaid"\s*:[^{}]{0,400}?\}/g)) {
      let entry = null;
      try {
        entry = JSON.parse(match[0]);
      } catch {
        continue;
      }
      const annualTax = plausibleTax(entry.taxPaid);
      const year = yearOf(entry.time) ?? plausibleYear(entry.year);
      if (annualTax == null || year == null) continue;
      rows.push({
        year,
        annualTax,
        assessment: Number.isFinite(Number(entry.value)) ? Number(entry.value) : null,
        source: 'embedded-json',
      });
    }
    if (rows.length) break;
  }

  return newest(rows);
}



function fromTaxTable(doc) {
  try {
    for (const table of doc.querySelectorAll('table')) {
      // Any th in the table, not only one inside a thead: Zillow's own
      // markup puts the header row straight in the tbody on some pages, and
      // requiring the thead meant the fallback quietly found no table.
      const headers = [...table.querySelectorAll('th')]
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase());

      const yearAt = headers.findIndex((h) => /^year$/.test(h));
      const taxAt = headers.findIndex((h) => /propert(y|ies) tax|^taxes?$|tax paid/.test(h));
      // "Tax assessment" also contains the word tax, so the two columns are
      // told apart by name rather than by being the first match.
      const assessAt = headers.findIndex((h) => /assess/.test(h));
      if (yearAt < 0 || taxAt < 0 || taxAt === assessAt) continue;

      const rows = [];
      for (const row of table.querySelectorAll('tr')) {
        const cells = [...row.children].map(
          (cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
        );
        const year = plausibleYear(cells[yearAt]);
        const annualTax = plausibleTax(firstMoney(cells[taxAt]));
        if (year == null || annualTax == null) continue;
        rows.push({
          year,
          annualTax,
          assessment: assessAt >= 0 ? firstMoney(cells[assessAt]) : null,
          source: 'dom',
        });
      }

      const found = newest(rows);
      if (found) return found;
    }
  } catch { /* markup changed under us */ }
  return null;
}

const newest = (rows) => (rows.length
  ? rows.reduce((best, row) => (row.year > best.year ? row : best))
  : null);

/** "$1,733 0%" is a tax bill of 1733, not of 17330. */
function firstMoney(text) {
  if (!text) return null;
  const match = String(text).match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/);
  return match ? parseMoney(match[1]) : null;
}

function plausibleTax(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= TAX_RANGE[0] && n <= TAX_RANGE[1] ? n : null;
}

function plausibleYear(value) {
  const n = Number(String(value ?? '').match(/\b(19|20)\d{2}\b/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

/** Zillow stamps these in epoch milliseconds. */
function yearOf(time) {
  const n = Number(time);
  if (!Number.isFinite(n) || n <= 0) return null;
  const year = new Date(n > 1e12 ? n : n * 1000).getUTCFullYear();
  return year > 1900 && year < 2200 ? year : null;
}

/**
 * Concatenated text of inline scripts, where the structured data lives.
 *
 * Memoized: this can pull together megabytes of bundle text, and the caller
 * runs on a timer against a page that mutates constantly. The cache key is
 * the URL plus the script count, so a client-side navigation to another
 * property invalidates it while ordinary re-renders do not.
 */
let scriptCache = { key: null, text: '' };

function rawScripts(doc) {
  try {
    const scripts = doc.querySelectorAll('script:not([src])');
    // Keyed on total length, not the script count. A single-page app that
    // grows its payload in place — which is how the property data arrives
    // after first paint — leaves the count unchanged, and the memo would
    // then serve a snapshot taken before the tax history existed.
    let size = 0;
    for (const el of scripts) size += el.textContent?.length ?? 0;
    const key = `${doc.location?.href ?? ''}|${scripts.length}|${size}`;
    if (scriptCache.key === key) return scriptCache.text;

    const parts = [];
    for (const el of scripts) {
      const text = el.textContent;
      // Only scripts big enough to be a data blob, capped so a huge bundle
      // does not blow up the regex scan. The cap used to be 400k, which was
      // under half of Zillow's own payload — the tax history sits near the
      // end of it, so on a big listing the figure was being sliced off
      // before anything went looking for it.
      if (text && text.length > 200) parts.push(text.slice(0, 4000000));
      if (parts.length > 12) break;
    }

    scriptCache = { key, text: parts.join('\n') };
    return scriptCache.text;
  } catch {
    return '';
  }
}

/**
 * Zillow embeds the Zestimate in its Next.js payload; Redfin embeds an
 * "Redfin Estimate" / avmInfo value. Regex rather than structural traversal,
 * because the surrounding object shape changes far more often than the key.
 */
function fromEmbeddedJson(html) {
  if (!html) return null;

  const attempts = [
    { re: /"zestimate"\s*:\s*"?(\d{5,9})"?/i, label: 'Zestimate' },
    { re: /"zestimateValue"\s*:\s*"?(\d{5,9})"?/i, label: 'Zestimate' },
    { re: /"predictedValue"\s*:\s*"?(\d{5,9})"?/i, label: 'Redfin Estimate' },
    { re: /"avmValue"\s*:\s*"?(\d{5,9})"?/i, label: 'Estimate' },
  ];

  // The escaped copy as well, for the same reason the tax history needs it:
  // the property object arrives as a JSON string, so on the live page the
  // key reads \"zestimate\" and a pattern for "zestimate" never lands. The
  // rendered value was quietly carrying this path the whole time.
  const texts = html.includes('\\"') ? [html, unescapeJson(html)] : [html];

  for (const { re, label } of attempts) {
    for (const text of texts) {
      const m = text.match(re);
      if (!m) continue;
      const amount = Number(m[1]);
      if (Number.isFinite(amount) && amount >= VALUE_RANGE[0]) {
        return { amount, label, source: 'embedded-json' };
      }
    }
  }
  return null;
}

/**
 * Last resort: the generic label-driven detector, restricted to candidates
 * whose label marks them as a valuation.
 *
 * The restriction is the important part. A listing page is covered in other
 * large figures — the list price, the last sold price, a tax assessment — and
 * any of them read as a home value would be wrong in a way that looks
 * entirely plausible. A sold price from 2019 quietly driving a 100% LTV
 * screen is exactly the failure worth engineering against, so a figure is
 * only accepted here if it is labelled as an estimate.
 */
function fromDom(doc) {
  try {
    const candidates = collectCandidates(doc).filter((c) => c.isAvm);
    if (!candidates.length) return null;
    const entry = assignFields(candidates, ['propertyValue']).propertyValue;
    if (!entry) return null;
    const amount = parseMoney(entry.candidate.raw);
    if (amount == null) return null;
    return { amount, label: entry.candidate.label ?? 'Estimate', source: 'dom' };
  } catch {
    return null;
  }
}

/** The subject property's address. */
function extractAddress(doc, html) {
  // 1. Structured address fields in the embedded payload.
  const street = html.match(/"streetAddress"\s*:\s*"([^"]{4,80})"/)?.[1];
  if (street) {
    const city = html.match(/"addressLocality"\s*:\s*"([^"]{2,60})"/)?.[1]
      ?? html.match(/"city"\s*:\s*"([^"]{2,60})"/)?.[1];
    const region = html.match(/"addressRegion"\s*:\s*"([A-Za-z]{2})"/)?.[1]
      ?? html.match(/"state"\s*:\s*"([A-Za-z]{2})"/)?.[1];
    const zip = html.match(/"postalCode"\s*:\s*"?(\d{5})"?/)?.[1]
      ?? html.match(/"zipcode"\s*:\s*"?(\d{5})"?/)?.[1];
    const joined = [unescapeJson(street), [city, region].filter(Boolean).join(', '), zip]
      .filter(Boolean)
      .join(', ');
    if (looksLikeAddress(joined)) return joined;
  }

  // 2. og:title / twitter:title, usually "<address> | ... | Zillow".
  for (const sel of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
    const content = doc.querySelector(sel)?.getAttribute('content');
    const candidate = content?.split('|')[0]?.trim();
    if (looksLikeAddress(candidate)) return candidate;
  }

  // 3. The page heading.
  const h1 = doc.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
  if (looksLikeAddress(h1)) return h1;

  // 4. The document title.
  const title = doc.title?.split('|')[0]?.trim();
  if (looksLikeAddress(title)) return title;

  return null;
}

/** A house number, some words, and ideally a ZIP. */
function looksLikeAddress(text) {
  if (!text || text.length < 8 || text.length > 160) return false;
  if (!/^\d+[A-Za-z]?\s+\S/.test(text.trim())) return false;
  return /[A-Za-z]{2,}/.test(text);
}



/**
 * Unescape a JSON string that is itself sitting inside JSON.
 *
 * Memoized, because it now runs over the whole embedded payload rather than
 * a short field: Zillow nests the property object as a *string* under
 * gdpClientCache, so the only way to find anything in it with a pattern is
 * to undo one level of escaping first. Running JSON.parse over several
 * megabytes to reach one array would cost far more than this.
 */
let unescapeCache = { from: null, to: '' };

function unescapeJson(text) {
  const raw = String(text ?? '');
  if (!raw.includes('\\')) return raw;
  if (unescapeCache.from === raw) return unescapeCache.to;
  const out = raw.replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/');
  unescapeCache = { from: raw, to: out };
  return out;
}
