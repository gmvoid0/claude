/**
 * S.A.M — UWM Easy Qualifier field probe
 * =====================================
 *
 * Paste this into the browser console while you are sitting on Easy
 * Qualifier. It reads the *shape* of the screen — which fields exist, what
 * they are called, what a dropdown offers — so S.A.M can learn where to put
 * an application. Then you press one button and paste the result back.
 *
 * What it reads:
 *   - field labels, names, ids, test ids, roles and types
 *   - the option lists inside dropdowns (VA / FHA / Conventional, occupancy,
 *     property type, and so on) — these are the map, and the whole point
 *   - whether a field is required, disabled, or already has something in it
 *
 * What it never reads:
 *   - anything you typed. Not the borrower's name, not an income figure,
 *     not a rate. Each field is reported as filled or empty, nothing more.
 *   - passwords. Those fields are skipped outright, along with file inputs.
 *   - cookies, tokens, localStorage, session storage, request headers, or
 *     anything else that could stand in for your login.
 *   - pricing. No rate, no fee, no result is captured or kept.
 *
 * What it never does:
 *   - send anything anywhere. There is no network call in this file at all.
 *     What it collects sits in this one browser tab until you press Copy,
 *     and dies when you close the tab.
 *   - change any field, click anything, or submit anything.
 *
 * You can read every line of it before you run it. That is the idea.
 */

(() => {
  'use strict';

  const VERSION = 1;
  const MAX_SCREENS = 40;
  const MAX_OPTIONS = 80;

  if (window.__samEqProbe) {
    window.__samEqProbe.show();
    console.log('%cS.A.M probe is already running — look bottom-right.', 'color:#0a84ff;font-weight:600');
    return;
  }

  /* ================================================================== *
   * Reading the page
   * ================================================================== */

  const FIELD_SELECTOR = [
    'input:not([type=hidden])',
    'select',
    'textarea',
    '[role=combobox]',
    '[role=spinbutton]',
    '[role=switch]',
    '[contenteditable=true]',
  ].join(',');

  // Nothing useful lives in these, and a password box is not ours to look at.
  const SKIP_TYPES = new Set(['submit', 'button', 'reset', 'image', 'file', 'password']);

  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const trim = (s, n = 160) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  /** Ids that a framework invented this render are useless as selectors. */
  function looksGenerated(id) {
    return !id
      || /^(mui-|:r|radix-|headlessui-|react-aria-|ember|ng-|cdk-|__)/i.test(id)
      || /\d{4,}$/.test(id)
      || /^[a-f0-9]{8,}$/i.test(id)
      || id.length > 60;
  }

  function esc(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  /**
   * The label a person would say out loud for this box. Several sources are
   * tried in the order they are trustworthy; every one that hit is kept, so
   * a bad first guess is recoverable without asking you to run this again.
   */
  function labelsFor(el) {
    const found = [];
    const push = (source, value) => {
      const clean = (value ?? '').replace(/\s+/g, ' ').trim().replace(/[:*\u00a0]+$/, '').trim();
      if (clean && clean.length < 120) found.push({ source, text: clean });
    };

    if (el.id && !looksGenerated(el.id)) {
      for (const l of document.querySelectorAll(`label[for="${esc(el.id)}"]`)) push('for', text(l));
    }
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const parts = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
      if (parts.length) push('aria-labelledby', parts.map(text).join(' '));
    }
    push('aria-label', el.getAttribute('aria-label'));

    const wrap = el.closest('label');
    if (wrap) {
      const clone = wrap.cloneNode(true);
      for (const control of clone.querySelectorAll('input,select,textarea')) control.remove();
      push('wrapping-label', text(clone));
    }

    // A label sitting beside the box, which is how most of these are built.
    let node = el;
    for (let depth = 0; depth < 4 && node; depth += 1) {
      const prev = node.previousElementSibling;
      if (prev && !prev.querySelector(FIELD_SELECTOR)) {
        const t = text(prev);
        if (t && t.length < 80) { push(`sibling-${depth}`, t); break; }
      }
      node = node.parentElement;
    }

    push('placeholder', el.getAttribute('placeholder'));
    push('title', el.getAttribute('title'));

    // A table cell takes its meaning from the column header above it.
    const cell = el.closest('td,th');
    if (cell) {
      const row = cell.closest('tr');
      const table = cell.closest('table');
      const index = row ? [...row.children].indexOf(cell) : -1;
      const head = table?.querySelector('thead tr');
      if (head && index >= 0 && head.children[index]) push('column', text(head.children[index]));
    }

    return found;
  }

  /** The heading this field sits under — EQ is a wizard, sections matter. */
  function sectionFor(el) {
    let node = el;
    while (node && node !== document.body) {
      const container = node.parentElement;
      if (!container) break;
      for (const sibling of [...container.children]) {
        if (sibling === node) break;
        if (/^(H[1-6]|LEGEND)$/.test(sibling.tagName) || sibling.getAttribute?.('role') === 'heading') {
          const t = text(sibling);
          if (t) return trim(t, 80);
        }
      }
      node = container;
    }
    return null;
  }

  /** Every way we might find this element again, best first. */
  function selectorsFor(el) {
    const out = [];
    const tag = el.tagName.toLowerCase();
    if (el.id && !looksGenerated(el.id)) out.push(`#${esc(el.id)}`);
    const name = el.getAttribute('name');
    if (name) out.push(`${tag}[name="${name}"]`);
    for (const attr of ['data-testid', 'data-test', 'data-test-id', 'data-qa', 'data-cy',
      'data-automation-id', 'data-id', 'formcontrolname', 'ng-reflect-name', 'data-field']) {
      const v = el.getAttribute(attr);
      if (v && v.length < 80) out.push(`[${attr}="${v}"]`);
    }
    const aria = el.getAttribute('aria-label');
    if (aria && aria.length < 60) out.push(`${tag}[aria-label="${aria}"]`);
    // A positional path is a last resort — it breaks the moment the page
    // reflows — so it is only worth carrying when nothing better exists.
    if (!out.length) out.push(domPath(el));
    return [...new Set(out)];
  }

  function domPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 8 && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) { parts.unshift(tag); break; }
      const same = [...parent.children].filter((c) => c.tagName === node.tagName);
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  /**
   * What a dropdown offers. This is the part that matters most: S.A.M knows
   * a file is VA, but only EQ knows whether it calls that "VA", "Veterans
   * Affairs" or "3".
   */
  function optionsFor(el) {
    let list = null;

    if (el.tagName === 'SELECT') {
      list = [...el.options].map((o) => ({ value: o.value, text: text(o) }));
    } else {
      const owned = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
      const box = owned ? document.getElementById(owned) : null;
      const nodes = box ? [...box.querySelectorAll('[role=option]')] : [];
      if (nodes.length) {
        list = nodes.map((o) => ({
          value: o.getAttribute('data-value') ?? o.getAttribute('value') ?? null,
          text: text(o),
        }));
      }
    }

    if (!list || !list.length) return null;
    const total = list.length;
    const kept = list.slice(0, MAX_OPTIONS).map((o) => (o.value === o.text || o.value == null ? o.text : o));
    return total > MAX_OPTIONS ? { total, truncated: true, list: kept } : { total, list: kept };
  }

  /**
   * Whether the box formats what you type — a currency mask has to be filled
   * differently from a plain number box, and getting that wrong is the usual
   * reason an automated fill silently puts 400000 into a field that then
   * reads $4.00.
   *
   * This looks at the field's own value to decide, and reports only the
   * yes/no. The value itself never leaves the page.
   */
  function looksMasked(el) {
    const value = typeof el.value === 'string' ? el.value : '';
    if (/[$,%]/.test(value)) return true;
    const hint = `${el.className} ${el.getAttribute('data-mask') ?? ''}`;
    return /mask|currency|money|percent|numeral|cleave/i.test(hint);
  }

  function describe(el) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (SKIP_TYPES.has(type)) return null;

    const labels = labelsFor(el);
    const options = optionsFor(el);
    const value = typeof el.value === 'string' ? el.value : '';

    const record = {
      label: labels[0]?.text ?? null,
      labelSource: labels[0]?.source ?? null,
      // Only the ones that disagree with the first: a label found four ways
      // and agreeing four times is four times the paste for no information.
      otherLabels: labels.slice(1)
        .filter((l) => l.text !== labels[0]?.text)
        .slice(0, 3)
        .map((l) => `${l.source}: ${l.text}`),
      section: sectionFor(el),

      tag: el.tagName.toLowerCase(),
      type: type || null,
      role: el.getAttribute('role'),
      name: el.getAttribute('name'),
      id: el.id && !looksGenerated(el.id) ? el.id : null,
      selectors: selectorsFor(el),

      inputMode: el.getAttribute('inputmode'),
      pattern: el.getAttribute('pattern'),
      maxLength: el.maxLength > 0 && el.maxLength < 500 ? el.maxLength : null,
      min: el.getAttribute('min'),
      max: el.getAttribute('max'),
      step: el.getAttribute('step'),

      required: el.required || el.getAttribute('aria-required') === 'true' || null,
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true' || null,
      readOnly: el.readOnly || null,
      masked: looksMasked(el) || null,

      // State, never content.
      filled: value.trim().length > 0 || null,
      options,
    };

    return compact(record);
  }

  /** Radio buttons are one question, not five fields. */
  function groupRadios(elements) {
    const groups = new Map();
    const rest = [];
    for (const el of elements) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const name = el.getAttribute('name');
      if (type === 'radio' && name) {
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(el);
      } else {
        rest.push(el);
      }
    }
    return { groups, rest };
  }

  function describeRadioGroup(name, elements) {
    const first = elements[0];
    const labels = labelsFor(first);
    return compact({
      label: sectionFor(first) ?? labels[0]?.text ?? name,
      labelSource: 'radio-group',
      section: sectionFor(first),
      tag: 'input',
      type: 'radio',
      name,
      selectors: [`input[name="${name}"]`],
      options: {
        total: elements.length,
        list: elements.map((el) => {
          const own = labelsFor(el)[0]?.text ?? null;
          const value = el.getAttribute('value');
          return own && own !== value ? { value, text: own } : (value ?? own);
        }),
      },
      required: first.required || null,
    });
  }

  /**
   * Options belonging to a dropdown that is open right now but not wired to
   * its control with aria-controls. Recorded loose and stitched up later.
   */
  function looseOptions() {
    const boxes = [...document.querySelectorAll('[role=listbox],[role=menu]')].filter(visible);
    return boxes.map((box) => {
      const nodes = [...box.querySelectorAll('[role=option],[role=menuitem]')];
      return compact({
        listbox: box.id || box.className?.slice?.(0, 60) || null,
        near: trim(text(box.parentElement?.previousElementSibling ?? box.previousElementSibling), 60),
        options: nodes.slice(0, MAX_OPTIONS).map((o) => text(o)).filter(Boolean),
        total: nodes.length,
      });
    }).filter((b) => b.options?.length);
  }

  function framework() {
    const marks = [];
    const body = document.body;
    if (document.querySelector('[ng-version]')) {
      marks.push(`angular ${document.querySelector('[ng-version]').getAttribute('ng-version')}`);
    }
    if (Object.keys(body ?? {}).some((k) => k.startsWith('__react'))
      || document.querySelector('[data-reactroot]')
      || [...document.querySelectorAll('div')].slice(0, 40)
        .some((d) => Object.keys(d).some((k) => k.startsWith('__react')))) marks.push('react');
    if (document.querySelector('[data-v-app]') || window.__VUE__) marks.push('vue');
    if (window.jQuery) marks.push(`jquery ${window.jQuery.fn?.jquery ?? ''}`.trim());
    return marks.length ? marks : ['unknown'];
  }

  /* ================================================================== *
   * Capture
   * ================================================================== */

  const store = {
    version: VERSION,
    capturedAt: new Date().toISOString(),
    // Path only. Query *keys* are kept because they name the screen; their
    // values are dropped because they can carry a loan or borrower id.
    site: `${location.origin}${location.pathname}`,
    framework: framework(),
    screens: [],
  };

  function signature() {
    const parts = [];
    for (const el of document.querySelectorAll(FIELD_SELECTOR)) {
      if (!visible(el)) continue;
      parts.push(`${el.tagName}:${el.getAttribute('name') ?? ''}:${el.getAttribute('type') ?? ''}`);
    }
    return parts.sort().join('|');
  }

  let lastSignature = '';
  const seen = new Set();

  /**
   * What this screen is called. A wizard usually keeps one page-level h1 and
   * changes an h2 underneath it, so both are taken — the h1 alone would name
   * every step identically.
   */
  function headingFor() {
    const seen = [];
    for (const h of document.querySelectorAll('h1,h2,[role=heading],legend')) {
      if (!visible(h)) continue;
      const t = trim(text(h), 60);
      if (t && !seen.includes(t)) seen.push(t);
      if (seen.length === 2) break;
    }
    return seen.join(' — ') || null;
  }

  function capture(manual = false) {
    if (store.screens.length >= MAX_SCREENS) return { skipped: 'limit reached' };

    const sig = signature();
    if (!manual && sig === lastSignature) return { skipped: 'no change' };
    if (!sig && !manual) return { skipped: 'no fields' };
    lastSignature = sig;

    const all = [...document.querySelectorAll(FIELD_SELECTOR)].filter(visible);
    const { groups, rest } = groupRadios(all);

    const fields = rest.map(describe).filter(Boolean);
    for (const [name, elements] of groups) fields.push(describeRadioGroup(name, elements));

    const heading = headingFor();
    const screen = compact({
      screen: store.screens.length + 1,
      heading,
      path: location.pathname,
      queryKeys: [...new URLSearchParams(location.search).keys()],
      hash: location.hash ? location.hash.split('?')[0] : null,
      at: new Date().toISOString(),
      fieldCount: fields.length,
      fields,
      openLists: looseOptions(),
    });

    // The same screen captured twice with one more dropdown open is worth
    // keeping; the same screen captured twice unchanged is not.
    if (!manual && seen.has(sig)) return { skipped: 'seen' };
    seen.add(sig);

    store.screens.push(screen);
    render();
    return { captured: fields.length };
  }

  function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null || v === false || v === '') continue;
      if (Array.isArray(v) && !v.length) continue;
      out[k] = v;
    }
    return out;
  }

  /* ================================================================== *
   * The little box in the corner
   * ================================================================== */

  const host = document.createElement('div');
  host.id = '__sam_eq_probe';
  host.style.cssText = 'all: initial; position: static;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .box {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
        width: 268px; padding: 14px;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: #fff; background: #1c1c1e;
        border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
      }
      .t { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
      .s { color: #98989f; font-size: 11.5px; margin-bottom: 10px; }
      .n { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .n small { font-size: 12px; font-weight: 500; color: #98989f; }
      .list { margin: 8px 0 10px; max-height: 96px; overflow: auto; font-size: 11.5px; color: #c7c7cc; }
      .list div { padding: 2px 0; border-top: 1px solid #2c2c2e; }
      button {
        font: inherit; font-size: 12.5px; font-weight: 600;
        width: 100%; padding: 9px; margin-top: 6px;
        border: 0; border-radius: 9px; cursor: pointer;
        background: #2c2c2e; color: #fff;
      }
      button.p { background: #0a84ff; }
      button.q { background: transparent; color: #98989f; font-weight: 500; padding: 5px; }
      .ok { color: #30d158; font-size: 11.5px; min-height: 15px; margin-top: 6px; }
      textarea { width: 100%; height: 90px; margin-top: 8px; font-size: 10px; }
    </style>
    <div class="box">
      <div class="t">S.A.M — mapping Easy Qualifier</div>
      <div class="s">Reads field names only. Nothing you typed, nothing sent anywhere.</div>
      <div class="n" data-n>0 <small>screens</small></div>
      <div class="list" data-list></div>
      <button class="p" data-a="copy">Copy all &amp; finish</button>
      <button data-a="capture">Capture this screen</button>
      <button data-a="download">Save as a file</button>
      <div class="ok" data-ok></div>
      <button class="q" data-a="stop">close</button>
    </div>
  `;

  const $ = (sel) => shadow.querySelector(sel);

  function render() {
    const n = store.screens.length;
    const fields = store.screens.reduce((sum, s) => sum + (s.fieldCount ?? 0), 0);
    $('[data-n]').innerHTML = `${n} <small>screen${n === 1 ? '' : 's'}, ${fields} fields</small>`;
    $('[data-list]').innerHTML = store.screens
      .map((s) => `<div>${s.screen}. ${escapeHtml(s.heading ?? s.path)} — ${s.fieldCount}</div>`)
      .join('');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function say(message) {
    $('[data-ok]').textContent = message;
    setTimeout(() => { if ($('[data-ok]').textContent === message) $('[data-ok]').textContent = ''; }, 4000);
  }

  const json = () => JSON.stringify(store, null, 1);

  async function copyAll() {
    const payload = json();
    try {
      await navigator.clipboard.writeText(payload);
      say(`Copied ${Math.round(payload.length / 1024)}KB — paste it back to S.A.M.`);
      return;
    } catch { /* clipboard blocked; fall through */ }

    const area = document.createElement('textarea');
    area.value = payload;
    shadow.querySelector('.box').appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      say('Copied — paste it back to S.A.M.');
      area.remove();
    } catch {
      say('Select the text below and copy it by hand.');
    }
  }

  function download() {
    const blob = new Blob([json()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eq-map-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say('Saved to your Downloads folder.');
  }

  shadow.addEventListener('click', (event) => {
    const action = event.target?.dataset?.a;
    if (!action) return;
    if (action === 'copy') copyAll();
    if (action === 'download') download();
    if (action === 'capture') {
      const r = capture(true);
      say(r.captured ? `Captured ${r.captured} fields.` : `Nothing new here (${r.skipped}).`);
    }
    if (action === 'stop') stop();
  });

  /* ================================================================== *
   * Follow the wizard
   * ================================================================== */

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => capture(false), 900);
  });
  // Attributes as well as children: a wizard that shows a step by toggling a
  // class never touches the DOM tree, and watching only childList meant the
  // second screen of the test fixture was never seen.
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'aria-hidden'],
  });

  // A belt to go with those braces. Some portals render inside a canvas of
  // custom elements where neither kind of mutation reaches us; a cheap poll
  // costs nothing, because an unchanged signature returns immediately.
  const poll = setInterval(() => capture(false), 2500);

  function stop() {
    observer.disconnect();
    clearInterval(poll);
    clearTimeout(timer);
    host.remove();
    delete window.__samEqProbe;
    console.log('%cS.A.M probe stopped.', 'color:#98989f');
  }

  window.__samEqProbe = {
    store,
    capture: () => capture(true),
    copy: copyAll,
    json,
    stop,
    show: () => { host.style.display = ''; },
  };

  capture(true);
  render();
  console.log(
    '%cS.A.M probe running.%c Click through Easy Qualifier as normal — every screen '
    + 'is captured automatically. Press "Copy all & finish" when you are done.',
    'color:#0a84ff;font-weight:700', 'color:inherit',
  );
})();
