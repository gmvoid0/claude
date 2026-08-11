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
 * Site markup changes often, so extraction is layered from most to least
 * structured and degrades rather than breaking:
 *   1. structured JSON embedded in the page
 *   2. JSON-LD
 *   3. the generic label-based detector
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
    fromJsonLd(doc) ??
    fromDom(doc);

  if (value == null) return null;
  if (value.amount < VALUE_RANGE[0] || value.amount > VALUE_RANGE[1]) return null;

  const address = extractAddress(doc, html);
  if (!address) return null;   // without an address it cannot be matched safely

  return {
    value: value.amount,
    valueLabel: value.label,
    address,
    site: site.site,
    siteLabel: site.label,
    source: value.source,
    url: loc?.href ?? null,
    isAvm: true,
  };
}

/** Concatenated text of inline scripts, where the structured data lives. */
function rawScripts(doc) {
  try {
    const parts = [];
    for (const el of doc.querySelectorAll('script:not([src])')) {
      const text = el.textContent;
      // Only scripts big enough to be a data blob, capped so a huge bundle
      // does not blow up the regex scan.
      if (text && text.length > 200) parts.push(text.slice(0, 400000));
      if (parts.length > 12) break;
    }
    return parts.join('\n');
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

  for (const { re, label } of attempts) {
    const m = html.match(re);
    if (!m) continue;
    const amount = Number(m[1]);
    if (Number.isFinite(amount) && amount >= VALUE_RANGE[0]) {
      return { amount, label, source: 'embedded-json' };
    }
  }
  return null;
}

function fromJsonLd(doc) {
  try {
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
      const data = safeJson(el.textContent);
      for (const node of flatten(data)) {
        const offer = node?.offers?.price ?? node?.price;
        const amount = parseMoney(offer);
        if (amount != null && amount >= VALUE_RANGE[0] && amount <= VALUE_RANGE[1]) {
          return { amount, label: 'Listed price', source: 'json-ld' };
        }
      }
    }
  } catch { /* malformed JSON-LD is common; ignore */ }
  return null;
}

/** Last resort: the generic label-driven detector. */
function fromDom(doc) {
  try {
    const assigned = assignFields(collectCandidates(doc), ['propertyValue']);
    const entry = assigned.propertyValue;
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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Yield every object in a nested JSON-LD structure. */
function* flatten(node, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* flatten(item, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    yield node;
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') yield* flatten(value, depth + 1);
    }
  }
}

function unescapeJson(text) {
  return String(text).replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/');
}
