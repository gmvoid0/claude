/**
 * The floating panel.
 *
 * Built once, then updated in place. Updating in place (rather than
 * re-rendering) matters because the page underneath refreshes constantly —
 * a full re-render would steal focus and wipe half-typed input every time a
 * value changed on the host page.
 */

import { formatMoney, formatPercent } from '../lib/money.js';
import { APPLICATION_FIELDS, CO_BORROWER_FIELDS } from '../lib/application.js';
import { PANEL_CSS } from './styles.js';
import { PANEL_HOST_ID as HOST_ID } from '../lib/constants.js';

export class Panel {
  constructor(handlers = {}) {
    this.h = handlers;
    this.els = {};
    this.collapsed = false;
    this.mounted = false;
  }

  mount({ collapsed = false, pos = null } = {}) {
    if (this.mounted) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    // Keep the host itself out of layout flow entirely.
    host.style.cssText = 'all: initial; position: static;';
    (document.body ?? document.documentElement).appendChild(host);

    this.root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    this.root.appendChild(style);

    this.wrap = document.createElement('div');
    this.wrap.className = 'wrap';
    this.wrap.innerHTML = TEMPLATE;
    this.root.appendChild(this.wrap);

    this.hostEl = host;
    this.cacheEls();
    this.wireEvents();
    this.setPosition(pos ?? { right: 16, bottom: 16 });
    if (collapsed) this.toggleCollapse(true);

    this.mounted = true;
  }

  unmount() {
    this.hostEl?.remove();
    this.mounted = false;
  }

  cacheEls() {
    const q = (sel) => this.root.querySelector(sel);
    this.els = {
      dot: q('.dot'),
      who: q('.who'),
      btnCollapse: q('[data-act=collapse]'),
      btnClose: q('[data-act=close]'),

      value: q('[data-in=propertyValue]'),
      valueHint: q('[data-hint=propertyValue]'),
      valueSrc: q('[data-src=propertyValue]'),
      lookup: q('.lookup'),

      extRow: q('[data-ext=row]'),
      extBadge: q('[data-ext=badge]'),
      extValue: q('[data-ext=value]'),
      extAddr: q('[data-ext=addr]'),
      btnUseExt: q('[data-act=use-ext]'),

      first: q('[data-in=firstLien]'),
      firstSrc: q('[data-src=firstLien]'),
      second: q('[data-in=secondLien]'),

      program: q('[data-in=program]'),
      programSrc: q('[data-src=program]'),
      state: q('[data-in=state]'),
      stateSrc: q('[data-src=state]'),

      solvePayment: q('[data-solve=payment]'),
      solveRate: q('[data-solve=rate]'),
      solveYears: q('[data-solve=years]'),
      solveOut: q('[data-solve=out]'),
      btnUseSolved: q('[data-act=use-solved]'),

      cash: q('[data-out=cash]'),
      verdict: q('[data-out=verdict]'),
      maxLoan: q('[data-out=maxLoan]'),
      equity: q('[data-out=equity]'),
      currentLtv: q('[data-out=currentLtv]'),
      maxLtv: q('[data-out=maxLtv]'),
      fee: q('[data-out=fee]'),
      feeRow: q('[data-row=fee]'),
      total: q('[data-out=total]'),
      breakeven: q('[data-out=breakeven]'),

      barFill: q('.ltvbar .fill'),
      barCap: q('.ltvbar .cap'),
      barLeft: q('[data-bar=left]'),
      barRight: q('[data-bar=right]'),

      msgs: q('.msgs'),
      drawer: q('[data-app=drawer]'),
      appFields: q('[data-app=fields]'),
      appCount: q('[data-app=count]'),
      coFields: q('[data-app=co-fields]'),
      coNote: q('[data-app=co-note]'),
      coToggle: q('[data-act=co-toggle]'),
      btnApp: q('[data-act=app]'),
      btnAppSave: q('[data-act=app-save]'),
      btnAppCopy: q('[data-act=app-copy]'),
      btnAppSend: q('[data-act=app-send]'),
      handoff: q('[data-app=handoff]'),
      draft: q('[data-app=draft]'),
      draftText: q('[data-app=draft-text]'),
      btnDraftSave: q('[data-act=draft-save]'),
      btnDraftDiscard: q('[data-act=draft-discard]'),
      programRow: q('[data-field=program]'),
      resultBox: q('.result'),
      btnCopy: q('[data-act=copy]'),
      btnPickValue: q('[data-act=pick-propertyValue]'),
      btnPickFirst: q('[data-act=pick-firstLien]'),
      btnReset: q('[data-act=reset]'),
    };
  }

  wireEvents() {
    const { els } = this;

    els.btnCollapse?.addEventListener('click', () => this.toggleCollapse());
    els.btnClose?.addEventListener('click', () => this.h.onClose?.());

    for (const key of ['propertyValue', 'firstLien', 'secondLien', 'program', 'state']) {
      const el = this.root.querySelector(`[data-in=${key}]`);
      if (!el) continue;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => this.h.onManualChange?.(key, el.value));
    }

    for (const el of [els.solvePayment, els.solveRate, els.solveYears]) {
      el?.addEventListener('input', () => this.h.onSolveChange?.(this.readSolver()));
    }
    // Optional chaining throughout, deliberately. A control that is missing
    // from the template should cost that one button, not the whole panel —
    // this threw on a single absent element and took the calculator down with
    // it, mid-call, for the sake of a handoff button.
    els.btnUseSolved?.addEventListener('click', () => this.h.onUseSolved?.(this.readSolver()));

    els.btnApp?.addEventListener('click', () => this.toggleDrawer());
    els.btnAppSave?.addEventListener('click', () => this.h.onSaveApplication?.());
    els.btnAppCopy?.addEventListener('click', () => this.h.onCopyApplication?.());
    els.btnAppSend?.addEventListener('click', () => this.h.onSendToSalesforce?.());
    els.btnDraftSave?.addEventListener('click', () => this.h.onSaveDraft?.());
    els.btnDraftDiscard?.addEventListener('click', () => this.h.onDiscardDraft?.());
    els.coToggle?.addEventListener('change', () => this.h.onCoBorrowerToggle?.(els.coToggle.checked));
    els.btnUseExt?.addEventListener('click', () => this.h.onUseExternal?.());
    els.btnCopy?.addEventListener('click', () => this.h.onCopy?.());
    els.btnReset?.addEventListener('click', () => this.h.onReset?.());
    els.btnPickValue?.addEventListener('click', () => this.h.onPick?.('propertyValue'));
    els.btnPickFirst?.addEventListener('click', () => this.h.onPick?.('firstLien'));

    this.enableDrag(this.root.querySelector('.hd'));
  }

  enableDrag(handle) {
    let startX = 0, startY = 0, originLeft = 0, originTop = 0, dragging = false;

    const onDown = (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const r = this.wrap.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      originLeft = r.left; originTop = r.top;
      // Switch to left/top anchoring for the duration of the drag.
      this.setPosition({ left: originLeft, top: originTop });
      e.preventDefault();
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    };

    const onMove = (e) => {
      if (!dragging) return;
      const left = clamp(originLeft + (e.clientX - startX), 0, window.innerWidth - 60);
      const top = clamp(originTop + (e.clientY - startY), 0, window.innerHeight - 30);
      this.setPosition({ left, top });
    };

    const onUp = () => {
      dragging = false;
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      const r = this.wrap.getBoundingClientRect();
      this.h.onMove?.({ left: r.left, top: r.top });
    };

    handle.addEventListener('mousedown', onDown);
  }

  setPosition(pos) {
    const s = this.wrap.style;
    s.left = s.top = s.right = s.bottom = '';
    if (pos.left != null) s.left = `${pos.left}px`;
    if (pos.top != null) s.top = `${pos.top}px`;
    if (pos.right != null) s.right = `${pos.right}px`;
    if (pos.bottom != null) s.bottom = `${pos.bottom}px`;
  }

  toggleCollapse(force) {
    this.collapsed = force ?? !this.collapsed;
    this.wrap.classList.toggle('collapsed', this.collapsed);
    this.els.btnCollapse.textContent = this.collapsed ? '▣' : '—';
    this.h.onCollapse?.(this.collapsed);
  }

  /** Report what a handoff actually did, rather than claiming it worked. */
  setHandoffResult(report) {
    const host = this.els.handoff;
    if (!report) { host.hidden = true; return; }

    host.hidden = false;
    host.className = `handoff ${report.tone ?? 'info'}`;
    host.textContent = '';

    const line = document.createElement('div');
    line.className = 'handoff-line';
    line.textContent = report.text;
    host.appendChild(line);

    if (report.detail) {
      const detail = document.createElement('div');
      detail.className = 'handoff-detail';
      detail.textContent = report.detail;
      host.appendChild(detail);
    }
  }

  /** Show or hide the application drawer. */
  toggleDrawer(force) {
    this.drawerOpen = force ?? !this.drawerOpen;
    this.els.drawer.hidden = !this.drawerOpen;
    this.wrap.classList.toggle('with-drawer', this.drawerOpen);
    this.els.btnApp.classList.toggle('on', this.drawerOpen);
    if (this.drawerOpen && this.collapsed) this.toggleCollapse(false);
    this.h.onDrawerToggle?.(this.drawerOpen);
  }

  /**
   * Build the form once, then update values in place. Same reason as the main
   * panel: a full rebuild while an agent is typing would take the field out
   * from under them on the next scan.
   */
  buildApplicationFields() {
    if (this.appEls) return;
    this.appEls = {};
    this.buildFieldRows(APPLICATION_FIELDS, this.els.appFields);
    this.buildFieldRows(CO_BORROWER_FIELDS, this.els.coFields);
  }

  buildFieldRows(fields, host) {
    host.textContent = '';

    for (const field of fields) {
      const row = document.createElement('label');
      row.className = 'app-row';

      const label = document.createElement('span');
      label.className = 'app-label';
      label.textContent = field.label;

      let input;
      if (field.kind === 'choice') {
        input = document.createElement('select');
        for (const value of ['', ...field.options]) {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = value || '—';
          input.appendChild(opt);
        }
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '—';
        if (field.kind !== 'text') input.inputMode = 'decimal';
      }
      input.className = 'app-input';
      input.dataset.appField = field.key;

      const evt = field.kind === 'choice' ? 'change' : 'input';
      input.addEventListener(evt, () => this.h.onApplicationChange?.(field.key, input.value));

      row.append(label, input);
      host.appendChild(row);
      this.appEls[field.key] = { row, input };
    }
  }

  renderApplication({ application, filled, canSave, draft, force, coBorrower }) {
    this.buildApplicationFields();

    this.els.coToggle.checked = !!coBorrower;
    this.els.coFields.hidden = !coBorrower;
    this.els.coNote.hidden = !coBorrower;

    const shown = coBorrower ? [...APPLICATION_FIELDS, ...CO_BORROWER_FIELDS] : APPLICATION_FIELDS;
    for (const field of shown) {
      const cell = this.appEls[field.key];
      if (!cell) continue;
      const entry = application?.[field.key];
      this.setInput(cell.input, entry?.value ?? '', force);
      if (cell.input.tagName === 'INPUT') {
        cell.input.placeholder = entry?.placeholder || '—';
      }
      cell.row.classList.toggle('auto', entry?.source === 'auto');
      cell.row.classList.toggle('filled', !!String(entry?.value ?? '').trim());
      cell.row.classList.toggle('suspect', !!entry?.suspect);
    }

    const total = APPLICATION_FIELDS.length + (coBorrower ? CO_BORROWER_FIELDS.length : 0);
    this.els.appCount.textContent = `${filled} of ${total}`;
    this.els.btnAppSave.hidden = !canSave;

    this.els.draft.hidden = !draft;
    if (draft) {
      this.els.draftText.textContent =
        `Unsaved application for ${draft.label || 'the previous record'} — ${draft.filled} fields.`;
    }
  }

  focusValue() {
    if (this.collapsed) this.toggleCollapse(false);
    this.els.value?.focus();
    this.els.value?.select();
  }

  /** Current contents of the balance-from-payment solver. */
  readSolver() {
    return {
      payment: this.els.solvePayment?.value ?? '',
      rate: this.els.solveRate?.value ?? '',
      years: this.els.solveYears?.value ?? '',
    };
  }

  setSolverResult(text) {
    if (this.els.solveOut) this.els.solveOut.innerHTML = text;
  }

  /**
   * Set an input's value without disturbing the agent if they're typing in it.
   *
   * `force` overrides that guard and is used when the record changes. It has
   * to: the panel focuses the home value box on every new record, so the
   * guard would otherwise refuse to clear the one field most dangerous to
   * leave stale, and the box would keep showing the previous caller's value
   * while the calculation had already dropped it.
   */
  setInput(el, value, force = false) {
    if (!el) return;
    if (!force && this.root.activeElement === el) return;
    const next = value == null ? '' : String(value);
    if (el.value !== next) el.value = next;
  }

  /* ---------------------------------------------------------------- */

  render(state) {
    if (!this.mounted) return;
    const { inputs, overrides, result, recordLabel, live, picking } = state;
    // Set on the render that follows a record change: the previous caller's
    // entries must be cleared even out of a focused field.
    const force = !!state.forceInputs;
    const { els } = this;

    els.dot.className = `dot ${live ? 'live' : 'stale'}`;
    els.who.textContent = recordLabel || 'No record detected';

    // --- inputs
    this.setInput(els.value, inputs.propertyValue?.value ?? '', force);
    this.setInput(els.first, inputs.firstLien?.value ?? '', force);
    this.setInput(els.second, inputs.secondLien?.value ?? '', force);
    // The dropdown must show the program actually being used, not the raw
    // page text. Lead data carries "CV", "VA LOAN", and sometimes junk like
    // an agent ID; assigning that straight to a <select> silently blanks it
    // while the calculation carries on with the normalized program, which
    // reads as "the tool doesn't know the loan type" when it does.
    this.setInput(els.program, inputs.program?.normalized ?? '', force);
    this.setInput(els.state, inputs.state?.value ?? '', force);

    els.value.classList.toggle('empty', !inputs.propertyValue?.value);
    els.first.classList.toggle('warnval', !!inputs.firstLien?.implausible);

    setSrc(els.valueSrc, inputs.propertyValue);
    setSrc(els.firstSrc, inputs.firstLien);
    setSrc(els.programSrc, inputs.program);
    setSrc(els.stateSrc, inputs.state);

    els.btnPickValue.classList.toggle('picking', picking === 'propertyValue');
    els.btnPickFirst.classList.toggle('picking', picking === 'firstLien');

    // --- value read from a Zillow / Redfin tab
    this.renderExternal(state.external);

    // --- lookup links
    this.renderLookup(state);

    // --- results
    const hasValue = result?.propertyValue != null && result.propertyValue > 0;

    if (!hasValue) {
      els.cash.textContent = '—';
      els.cash.className = 'num none';
      els.verdict.textContent = 'Enter a home value';
      els.verdict.className = 'pill idle';
      els.valueHint.innerHTML = result?.totalLiens
        ? `Balance read as <b>${formatMoney(result.totalLiens)}</b>. Enter the home value to calculate.`
        : 'Not on the page — type it or bind a field.';
    } else {
      const cash = result.estimatedCashToBorrower;
      els.cash.textContent = formatMoney(cash);
      els.cash.className = `num ${cash > 0 ? 'good' : 'bad'}`;

      if (result.meetsThreshold) {
        els.verdict.textContent = `Above ${formatMoney(result.threshold)} threshold`;
        els.verdict.className = 'pill good';
      } else if (cash > 0) {
        els.verdict.textContent = `Below ${formatMoney(result.threshold)} threshold`;
        els.verdict.className = 'pill bad';
      } else {
        els.verdict.textContent = 'No cash available';
        els.verdict.className = 'pill bad';
      }

      const bits = [];
      // Show what the shorthand became, so an expansion is never a surprise.
      const typed = inputs.propertyValue?.value ?? '';
      if (typed && String(result.propertyValueEntered) !== typed.replace(/[$,\s]/g, '')) {
        bits.push(`= <b>${formatMoney(result.propertyValueEntered)}</b>`);
      }
      if (result.valueIsAvm) {
        bits.push(result.avmHaircut
          ? `Estimate — screening at <b>${formatMoney(result.propertyValue)}</b> (−${formatPercent(result.avmHaircut, 0)})`
          : 'Automated estimate, not an appraisal');
      }
      if (result.minValueToBreakEven) {
        bits.push(`Break-even <b>${formatMoney(result.minValueToBreakEven)}</b>`);
      }
      els.valueHint.innerHTML = bits.join(' · ');
    }

    els.maxLoan.textContent = formatMoney(result?.maxBaseLoan);

    els.equity.textContent = formatMoney(result?.grossEquity);

    // An assumed loan type is a question for the borrower, not a detail.
    els.programRow.classList.toggle('flagged', !!result?.programAssumed);
    els.currentLtv.textContent = result?.currentLtv != null ? formatPercent(result.currentLtv, 1) : '—';
    els.maxLtv.textContent = result?.maxLtv != null
      ? `${formatPercent(result.maxLtv, result.maxLtv * 100 % 1 === 0 ? 0 : 2)}`
      : '—';
    els.maxLtv.title = result?.ltvSource ?? '';

    const showFee = !!result?.financedFee;
    els.feeRow.style.display = showFee ? '' : 'none';
    if (showFee) {
      els.fee.textContent = formatMoney(result.financedFee);
      els.fee.previousElementSibling.textContent = result.feeLabel ?? 'Upfront fee';
    }
    els.total.textContent = formatMoney(result?.totalLoanAmount);
    els.breakeven.textContent = result?.programLabel ?? '—';

    els.resultBox.dataset.tone = !hasValue ? 'idle'
      : result.meetsThreshold ? 'good'
      : (result.estimatedCashToBorrower > 0 ? 'thin' : 'bad');

    this.renderApplication({
      application: state.application,
      filled: state.applicationFilled ?? 0,
      canSave: !!state.canSaveApplication,
      draft: state.draft,
      coBorrower: state.coBorrower,
      force,
    });

    this.renderBar(result);
    this.renderMessages(result);
  }

  renderBar(result) {
    const { els } = this;
    const cur = result?.currentLtv;
    const cap = result?.maxLtv;
    if (cur == null || cap == null || !cap) {
      els.barFill.style.width = '0%';
      els.barCap.style.left = '100%';
      els.barLeft.textContent = '';
      els.barRight.textContent = '';
      return;
    }
    // Scale the track to whichever is larger so both markers stay visible.
    const scale = Math.max(cap, cur, 0.01) * 1.05;
    els.barFill.style.width = `${Math.min(100, (cur / scale) * 100)}%`;
    els.barFill.classList.toggle('over', cur > cap);
    els.barCap.style.left = `${Math.min(100, (cap / scale) * 100)}%`;
    els.barLeft.textContent = `Now ${formatPercent(cur, 1)}`;
    els.barRight.textContent = `Cap ${formatPercent(cap, 0)}`;
  }

  renderMessages(result) {
    const msgs = result?.warnings ?? [];
    const host = this.els.msgs;
    const next = msgs.map((m) => `${m.level}::${m.text}`).join('|');
    if (host.dataset.sig === next) return;   // avoid pointless DOM churn
    host.dataset.sig = next;
    host.textContent = '';
    for (const m of msgs) {
      const div = document.createElement('div');
      div.className = `msg ${m.level}`;
      div.textContent = m.text;
      host.appendChild(div);
    }
  }

  /**
   * The value seen on a Zillow/Redfin tab.
   *
   * Whether it was applied or is merely on offer is the important thing to
   * communicate, so the address it belongs to is always visible and a
   * non-matching address is called out rather than quietly ignored.
   */
  renderExternal(external) {
    const { els } = this;
    if (!external?.value) {
      els.extRow.style.display = 'none';
      return;
    }

    els.extRow.style.display = '';

    const confidence = external.comparison?.confidence ?? 'none';
    const applied = !!external.applied;

    els.extValue.textContent = formatMoney(external.value);
    els.extAddr.textContent = external.address ?? '';
    els.btnUseExt.style.display = applied ? 'none' : '';

    if (applied) {
      els.extBadge.textContent = `${external.siteLabel} · matched`;
      els.extBadge.className = 'ext-badge ok';
      els.extRow.className = 'ext ok';
    } else if (confidence === 'likely') {
      els.extBadge.textContent = `${external.siteLabel} · check address`;
      els.extBadge.className = 'ext-badge warn';
      els.extRow.className = 'ext warn';
    } else {
      els.extBadge.textContent = `${external.siteLabel} · different address`;
      els.extBadge.className = 'ext-badge bad';
      els.extRow.className = 'ext bad';
    }
  }

  renderLookup(state) {
    const { showLookupLinks, lookupUrls } = state;
    const host = this.els.lookup;

    if (!showLookupLinks || !lookupUrls?.address) {
      host.style.display = 'none';
      // Clear the cache key too, otherwise coming back to the same address
      // short-circuits below and the links stay hidden for good.
      delete host.dataset.sig;
      return;
    }

    if (host.dataset.sig === lookupUrls.address) return;
    host.dataset.sig = lookupUrls.address;

    host.style.display = '';
    host.textContent = '';

    const links = [
      ['Open in Zillow', lookupUrls.zillow],
      ['Redfin', lookupUrls.redfin],
    ];
    for (const [text, href] of links) {
      if (!href) continue;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = text;
      host.appendChild(a);
    }
  }
}

function setSrc(el, field) {
  if (!el) return;
  if (!field || field.source === 'none') {
    el.textContent = '';
    el.className = 'src';
    return;
  }
  const map = { auto: 'auto', manual: 'typed', bound: 'bound', external: 'pulled' };
  el.textContent = field.sourceLabel
    ? `${map[field.source] ?? field.source} · ${field.sourceLabel}`
    : (map[field.source] ?? '');
  el.className = `src ${field.source}`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const TEMPLATE = `
<div class="hd">
  <span class="dot"></span>
  <span class="brand">
    <span class="title">S.A.M</span>
    <span class="subtitle">Sales Assistance in Mortgages</span>
  </span>
  <span class="who"></span>
  <button data-act="app" title="Application (Alt+A)">▤</button>
  <button data-act="collapse" title="Collapse (Alt+E)">–</button>
  <button data-act="close" title="Turn off for this site">✕</button>
</div>

<div class="drawer" data-app="drawer" hidden>
  <div class="drawer-hd">
    <span class="drawer-title">Application</span>
    <span class="drawer-count" data-app="count"></span>
    <button class="btn tiny" data-act="app-send">To Salesforce</button>
    <button class="btn tiny" data-act="app-copy">Copy</button>
    <button class="btn tiny" data-act="app-save" hidden>Save</button>
  </div>

  <div class="draft" data-app="draft" hidden>
    <div class="draft-text" data-app="draft-text"></div>
    <div class="draft-acts">
      <button class="btn tiny" data-act="draft-save">Save it</button>
      <button class="btn" data-act="draft-discard">Discard</button>
    </div>
  </div>

  <div class="drawer-body" data-app="fields"></div>

  <div class="co">
    <label class="co-toggle">
      <span>Co-borrower</span>
      <input type="checkbox" data-act="co-toggle" />
    </label>
    <div class="co-body" data-app="co-fields" hidden></div>
    <div class="co-note" data-app="co-note" hidden>
      Entered by hand — none of this appears on a lead screen.
    </div>
  </div>

  <div class="handoff" data-app="handoff" hidden></div>

  <div class="drawer-note">
    Clears with the record when the next call lands. Fill three or more and a
    Save option appears.
  </div>
</div>

<div class="body">

  <!-- The answer, first and largest. Everything below it is supporting work. -->
  <div class="result" data-tone="idle">
    <div class="headline">
      <span class="cap">Max cash out</span>
      <span class="num none" data-out="cash">—</span>
    </div>
    <span class="pill idle" data-out="verdict">—</span>

    <div class="ltvbar">
      <div class="track">
        <div class="fill"></div>
        <div class="cap"></div>
      </div>
      <div class="lbl"><span data-bar="left"></span><span data-bar="right"></span></div>
    </div>
  </div>

  <!-- Value and equity side by side: the two numbers that move the answer. -->
  <div class="pair">
    <div class="pair-cell">
      <label>Home value <span class="src" data-src="propertyValue"></span></label>
      <input type="text" class="hero" data-in="propertyValue" placeholder="$0" inputmode="decimal" />
    </div>
  </div>
  <div class="hint" data-hint="propertyValue"></div>

  <div class="ext" data-ext="row" style="display:none">
    <div class="ext-top">
      <span class="ext-badge" data-ext="badge"></span>
      <b data-ext="value"></b>
      <button class="btn tiny" data-act="use-ext">Use</button>
    </div>
    <div class="ext-addr" data-ext="addr"></div>
  </div>
  <div class="lookup"></div>

  <div class="group">
    <div class="two">
      <div class="row">
        <label>Balance <span class="src" data-src="firstLien"></span></label>
        <input type="text" data-in="firstLien" placeholder="$0" inputmode="decimal" />
      </div>
      <div class="row">
        <label>2nd / HELOC</label>
        <input type="text" data-in="secondLien" placeholder="$0" inputmode="decimal" />
      </div>
    </div>
    <div class="two">
      <div class="row" data-field="program">
        <label>Loan type <span class="src" data-src="program"></span></label>
        <select data-in="program">
          <option value="">—</option>
          <option value="VA">VA</option>
          <option value="FHA">FHA</option>
          <option value="CONV">Conventional</option>
          <option value="USDA">USDA</option>
        </select>
      </div>
      <div class="row">
        <label>State <span class="src" data-src="state"></span></label>
        <input type="text" data-in="state" placeholder="TN" maxlength="20" />
      </div>
    </div>
  </div>

  <div class="msgs"></div>

  <details class="adv">
    <summary>Detail</summary>
    <div class="grid">
      <div class="cell"><div class="k">Max loan</div><div class="v" data-out="maxLoan">—</div></div>
      <div class="cell"><div class="k">Gross equity</div><div class="v" data-out="equity">—</div></div>
      <div class="cell"><div class="k">Current LTV</div><div class="v sub" data-out="currentLtv">—</div></div>
      <div class="cell"><div class="k">Max LTV</div><div class="v sub" data-out="maxLtv">—</div></div>
      <div class="cell" data-row="fee"><div class="k">Fee</div><div class="v sub" data-out="fee">—</div></div>
      <div class="cell"><div class="k">Total loan</div><div class="v sub" data-out="total">—</div></div>
      <div class="cell"><div class="k">Program</div><div class="v sub" data-out="breakeven">—</div></div>
    </div>
  </details>

  <details class="adv">
    <summary>No balance on file? Estimate it</summary>
    <div class="three">
      <div class="row">
        <label>P&amp;I payment</label>
        <input type="text" data-solve="payment" placeholder="$0" inputmode="decimal" />
      </div>
      <div class="row">
        <label>Rate</label>
        <input type="text" data-solve="rate" placeholder="6.5%" inputmode="decimal" />
      </div>
      <div class="row">
        <label>Years left</label>
        <input type="text" data-solve="years" placeholder="25" inputmode="decimal" />
      </div>
    </div>
    <div class="hint" data-solve="out">Enter all three to estimate the remaining balance.</div>
    <div class="foot"><button class="btn wide" data-act="use-solved">Use as balance</button></div>
  </details>

  <div class="foot">
    <button class="btn primary" data-act="copy">Copy summary</button>
    <button class="btn" data-act="pick-propertyValue">Bind value</button>
    <button class="btn" data-act="pick-firstLien">Bind balance</button>
    <button class="btn wide" data-act="reset">Reset</button>
  </div>

  <div class="disclaimer">
    Estimate only — LTV cap and financed upfront fee. Not a quote, offer, or
    commitment to lend.
  </div>
</div>
`;
