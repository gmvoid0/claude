/**
 * The floating panel.
 *
 * Built once, then updated in place. Updating in place (rather than
 * re-rendering) matters because the page underneath refreshes constantly —
 * a full re-render would steal focus and wipe half-typed input every time a
 * value changed on the host page.
 */

import { formatMoney, formatPercent } from '../lib/money.js';
import { APPLICATION_FIELDS, CO_BORROWER_FIELDS, KEY_FIELDS } from '../lib/application.js';
import { missingLabels } from '../lib/eq-fields.js';
import { PANEL_CSS } from './styles.js';
import { PANEL_HOST_ID as HOST_ID } from '../lib/constants.js';

/** Matches `--panel-w` in the stylesheet; one column's width. */
const DEFAULT_WIDTH = 358;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 240;

export class Panel {
  constructor(handlers = {}) {
    this.h = handlers;
    this.els = {};
    this.collapsed = false;
    this.mounted = false;
  }

  mount({ collapsed = false, pos = null, size = null } = {}) {
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
    this.width = DEFAULT_WIDTH;
    this.bodyHeight = null;
    this.setSize(size ?? {});
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
      lookupLinks: q('.lookup-links'),
      btnMini: q('[data-act=mini]'),

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

      cash: q('[data-out=cash]'),
      cashNote: q('[data-out=cashNote]'),
      costLine: q('[data-out=costLine]'),

      eqFinal: q('[data-eq=final]'),
      eqNote: q('[data-eq=note]'),
      eqOver: q('[data-eq=over]'),
      eqRows: q('[data-eq=rows]'),
      eqTaxSrc: q('[data-eq=taxsrc]'),
      dtiRows: q('[data-dti=rows]'),
      dtiSrc: q('[data-dti=src]'),
      btnCopyEq: q('[data-act=copy-eq]'),
      advertised: q('[data-out=advertised]'),
      verdict: q('[data-out=verdict]'),


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
      // The Salesforce handoff button is gone from the drawer, but the code
      // behind it is intact and tested — this shop went to UWM instead, and
      // the next one may not have.
      btnAppSend: q('[data-act=app-send]'),
      handoff: q('[data-app=handoff]'),
      draft: q('[data-app=draft]'),
      draftText: q('[data-app=draft-text]'),
      btnDraftSave: q('[data-act=draft-save]'),
      btnDraftDiscard: q('[data-act=draft-discard]'),
      programRow: q('[data-field=program]'),
      resultBox: q('.result'),
      grip: q('[data-act=resize]'),
      btnCopy: q('[data-act=copy]'),
      btnPickValue: q('[data-act=pick-propertyValue]'),
      btnPickFirst: q('[data-act=pick-firstLien]'),
      btnPickName: q('[data-act=pick-fullName]'),
      btnReset: q('[data-act=reset]'),
    };
  }

  wireEvents() {
    const { els } = this;

    els.btnCollapse?.addEventListener('click', () => this.toggleCollapse());
    els.btnClose?.addEventListener('click', () => this.h.onClose?.());

    for (const key of ['propertyValue', 'firstLien', 'secondLien', 'program', 'state',
      'annualPropertyTax', 'piti']) {
      const el = this.root.querySelector(`[data-in=${key}]`);
      if (!el) continue;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => this.h.onManualChange?.(key, el.value));
    }

    // The four standing assumptions moved to Settings; they are a shop's
    // policy, not a per-borrower choice, and the handler stays wired for
    // anything else that ever needs it.

    els.btnApp?.addEventListener('click', () => this.toggleDrawer());
    els.btnAppSave?.addEventListener('click', () => this.h.onSaveApplication?.());
    els.btnAppCopy?.addEventListener('click', () => this.h.onCopyApplication?.());
    els.btnAppSend?.addEventListener('click', () => this.h.onSendToSalesforce?.());
    els.btnDraftSave?.addEventListener('click', () => this.h.onSaveDraft?.());
    els.btnDraftDiscard?.addEventListener('click', () => this.h.onDiscardDraft?.());
    els.coToggle?.addEventListener('change', () => this.h.onCoBorrowerToggle?.(els.coToggle.checked));
    els.btnUseExt?.addEventListener('click', () => this.h.onUseExternal?.());
    els.btnMini?.addEventListener('click', () => this.h.onMiniBrowser?.());
    els.btnCopy?.addEventListener('click', () => this.h.onCopy?.());
    els.btnCopyEq?.addEventListener('click', () => this.h.onCopyEq?.());
    els.btnReset?.addEventListener('click', () => this.h.onReset?.());
    els.btnPickValue?.addEventListener('click', () => this.h.onPick?.('propertyValue'));
    els.btnPickFirst?.addEventListener('click', () => this.h.onPick?.('firstLien'));
    els.btnPickName?.addEventListener('click', () => this.h.onPick?.('fullName'));

    this.enableDrag(this.root.querySelector('.hd'));
    for (const handle of this.root.querySelectorAll('[data-act=resize]')) {
      this.enableResize(handle);
    }
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

  /**
   * Drag-to-resize from the bottom-left corner.
   *
   * Bottom-left because the panel is docked to the right of the screen: a
   * grip on that edge grows the panel into the space it has, rather than
   * pushing it off-screen.
   *
   * One width governs both columns. Two independent widths sounds more
   * flexible and in practice just gives an agent two ways to make the layout
   * lopsided mid-call.
   */
  enableResize(handle) {
    if (!handle) return;
    const axis = handle.dataset.axis ?? 'xy';

    let startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;

    const onDown = (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = this.width;
      startH = this.bodyHeight
        ?? this.root.querySelector('.body')?.getBoundingClientRect().height
        ?? 0;
      e.preventDefault();
      e.stopPropagation();
      // The host page may be listening on the window with capture; while a
      // drag is in flight the panel owns the pointer.
      this.wrap.classList.add('resizing');
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    };

    const onMove = (e) => {
      if (!resizing) return;
      const next = {};
      // Dragging left widens: the handles are on the left edge, because the
      // panel is docked right and has nowhere to grow on that side.
      if (axis.includes('x')) next.width = startW - (e.clientX - startX);
      if (axis.includes('y')) next.height = startH + (e.clientY - startY);
      this.setSize(next);
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      this.wrap.classList.remove('resizing');
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      this.h.onResize?.({ width: this.width, height: this.bodyHeight });
    };

    handle.addEventListener('mousedown', onDown);
  }

  /**
   * Apply a size, clamped to something usable.
   *
   * The width is one column: with the drawer open the panel occupies twice
   * it, which is why the ceiling halves. Both bounds are checked against the
   * live window rather than the size stored last time, so a panel sized on a
   * large monitor still fits when the same profile opens on a laptop.
   */
  setSize({ width, height } = {}) {
    const columns = this.drawerOpen ? 2 : 1;
    const maxWidth = Math.max(MIN_WIDTH, Math.floor((window.innerWidth - 24) / columns));
    const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 120);

    if (width != null) {
      this.width = Math.round(clamp(width, MIN_WIDTH, maxWidth));
      this.wrap.style.setProperty('--panel-w', `${this.width}px`);
    }
    if (height != null) {
      this.bodyHeight = Math.round(clamp(height, MIN_HEIGHT, maxHeight));
      this.wrap.style.setProperty('--panel-h', `${this.bodyHeight}px`);
    }
  }

  setPosition(pos) {
    const s = this.wrap.style;
    s.left = s.top = s.right = s.bottom = '';
    if (pos.left != null) s.left = `${pos.left}px`;
    if (pos.top != null) s.top = `${pos.top}px`;
    if (pos.right != null) s.right = `${pos.right}px`;
    if (pos.bottom != null) s.bottom = `${pos.bottom}px`;
  }

  /**
   * Collapse to the title bar, or restore.
   *
   * The drawer's open/closed state is deliberately left alone: collapsing is
   * "get out of my way for a second", not "close my application". The CSS
   * hides the drawer while collapsed and it comes back exactly as it was.
   */
  toggleCollapse(force) {
    this.collapsed = force ?? !this.collapsed;
    this.wrap.classList.toggle('collapsed', this.collapsed);
    if (this.els.btnCollapse) {
      this.els.btnCollapse.textContent = this.collapsed ? '▣' : '–';
      this.els.btnCollapse.title = this.collapsed ? 'Expand (Alt+E)' : 'Collapse (Alt+E)';
    }
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
    // Opening the drawer doubles the width the panel occupies, so a width
    // that fitted one column may not fit two. Re-clamp rather than let the
    // panel run off the side of the screen.
    this.setSize({ width: this.width });
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
      // The seven that decide the answer sit on a darker ground, so an agent
      // scanning a sixteen-row form sees which blanks actually stop a quote.
      row.className = `app-row${KEY_FIELDS.has(field.key) ? ' key' : ''}`;

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
    els.btnPickName?.classList.toggle('picking', picking === 'fullName');

    // --- the Easy Qualifier loan amount
    this.setInput(els.eqTax ?? this.root.querySelector('[data-in=annualPropertyTax]'),
      state.tax?.source === 'typed' ? String(state.tax.amount) : '', force);
    this.renderSizing(state.sizing, state.tax);
    this.renderCeiling(state.sizing);
    this.renderDti(state.dti);

    // --- value read from a Zillow / Redfin tab
    this.renderExternal(state.external);

    // --- lookup links
    this.renderLookup(state);

    // --- results
    const hasValue = result?.propertyValue != null && result.propertyValue > 0;

    if (!hasValue) {
      els.cash.textContent = '—';
      els.cash.className = 'num none net';
      els.advertised.textContent = '—';
      els.advertised.className = 'num none adv';
      els.cashNote.textContent = 'after fees & costs';
      els.costLine.textContent = '';
      els.verdict.textContent = 'Enter a home value';
      els.verdict.className = 'pill idle';
      els.valueHint.innerHTML = result?.totalLiens
        ? `Balance read as <b>${formatMoney(result.totalLiens)}</b>. Enter the home value to calculate.`
        : 'Not on the page — type it or bind a field.';
    } else {
      const cash = result.estimatedCashToBorrower;
      // The red zone is one verdict on the deal, so both figures carry it.
      // A big blue number beside a red one would read as "there is still
      // something here", which is exactly what there is not.
      const red = !result.meetsThreshold;

      els.cash.textContent = formatMoney(cash);
      els.cash.className = `num net ${red ? 'bad' : 'good'}`;

      els.advertised.textContent = formatMoney(result.advertisedCashOut);
      els.advertised.className = `num adv ${red ? 'bad' : ''}`.trim();

      // Say what came out between the two figures, so the gap is never a
      // mystery the agent has to take on trust.
      const fee = result.financedFee || result.unfinancedFee || 0;
      const allIn = result.totalCostToClose || 0;
      els.cashNote.textContent = allIn
        ? `after ${formatMoney(allIn)} in fees & costs`
        : 'no fees or costs';
      els.cashNote.title = closingBreakdown(result);

      // The financed fee never comes out of cash-out — it is added to the
      // loan — so saying so here stops the split from reading as arithmetic
      // that does not add up against the take-home figure.
      const split = [];
      if (fee) split.push(`${formatMoney(fee)} ${(result.feeLabel ?? 'fee').toLowerCase()}`);
      if (result.closingCosts) split.push(`${formatMoney(result.closingCosts)} closing costs`);
      els.costLine.textContent = allIn
        ? `Cost to close ${formatMoney(allIn)}`
          + (split.length > 1 ? ` — ${split.join(' + ')}` : '')
          + (result.financedFee ? ', fee financed into the loan' : '')
        : '';
      els.costLine.title = closingBreakdown(result);

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

    // An assumed loan type is a question for the borrower, not a detail.
    els.programRow.classList.toggle('flagged', !!result?.programAssumed);


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

  /**
   * The loan amount, and the six lines it is made of.
   *
   * The itemisation is not decoration. An agent quoting a figure they cannot
   * break down is an agent who backs off the moment a borrower pushes, and
   * the escrow line in particular is the one that gets questioned — so it
   * carries the tax year and the site it was read from.
   */
  renderSizing(sizing, tax) {
    const { els } = this;
    if (!els.eqFinal) return;

    els.eqTaxSrc.textContent = tax?.source === 'typed' ? 'entered by hand'
      : tax ? `${tax.year ?? ''} ${tax.source ?? ''}`.trim()
        : 'not read yet';

    if (!sizing?.items?.length) {
      els.eqFinal.textContent = '—';
      els.eqFinal.className = 'eq-final none';
      els.eqNote.textContent = 'Needs the payoff, the cash-out and the tax bill.';
      els.eqRows.textContent = '';
      return;
    }

    // One line where the whole itemisation used to be. The six charges are
    // still added and still grossed up — the loan amount above is built the
    // same way — but reading them back at an agent who set the constants
    // once in Settings was six rows saying the same thing every call. The
    // full working is still a keystroke away on Copy.
    const escrow = sizing.escrowDetail;
    els.eqRows.innerHTML = escrow
      ? '<div class="eq-rg">'
        + '<div class="eq-row"><span>Monthly escrow payment</span>'
        + `<b>${formatMoney(escrow.monthly)}</b></div>`
        + `<div class="eq-why">${formatMoney(escrow.annualPropertyTax)} tax + `
        + `${formatMoney(escrow.insuranceAllowance)} insurance, over 12 months`
        + `&nbsp;&middot;&nbsp; ${escrow.months} collected at closing</div>`
        + '</div>'
      : '<div class="eq-rg"><div class="eq-row gap"><span>Monthly escrow payment</span>'
        + '<b>&mdash;</b></div>'
        + '<div class="eq-why">needs the property tax from Zillow</div></div>';

    if (sizing.finalLoan == null) {
      els.eqFinal.textContent = '—';
      els.eqFinal.className = 'eq-final none';
      els.eqNote.textContent = `Waiting on ${missingLabels(sizing.missing)}.`;
      return;
    }

    els.eqFinal.textContent = formatMoney(sizing.finalLoanRounded);
    els.eqFinal.className = 'eq-final';
    els.eqNote.textContent = 'Type this into Loan Amount.';
  }

  /** The loan is bigger than the programme will write. Said out loud. */
  renderCeiling(sizing) {
    const el = this.els.eqOver;
    if (!el) return;
    const over = sizing?.overCeiling;
    if (!over) { el.textContent = ''; return; }
    el.textContent = `Over the ${formatPercent(over.maxLtv, 0)} cap of `
      + `${formatMoney(over.ceiling)} by ${formatMoney(over.over)} — this cannot be `
      + 'written as sized. Cut the cash-out or raise the value.';
  }

  /**
   * The ratio, against the limit for whichever programme is on the file.
   *
   * A limit set to null shows the number and passes no judgement, because a
   * red flag against something nobody underwrites to kills files that would
   * otherwise sail through.
   */
  renderDti(dti) {
    const { els } = this;
    if (!els.dtiRows) return;

    els.dtiSrc.textContent = dti?.program
      ? `${dti.program} — ${pctLimit(dti.limit)} front-end`
      : 'no programme set';

    if (!dti || dti.front.percent == null) {
      els.dtiRows.innerHTML = `<div class="dti-none">${escapeHtml(dtiGap(dti))}</div>`;
      return;
    }

    els.dtiRows.innerHTML = dtiRow(dti) + (dti.warnings ?? [])
      .map((w) => `<div class="dti-warn ${w.level === 'warn' ? 'hot' : ''}">${
        escapeHtml(w.text)}</div>`).join('');
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
    this.renderMessageList(this.els.msgs, result?.warnings ?? []);
  }

  renderMessageList(host, msgs) {
    if (!host) return;
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
    const { showLookupLinks, showMiniBrowser, lookupUrls } = state;
    const host = this.els.lookup;
    const links = this.els.lookupLinks;
    const address = lookupUrls?.address;

    const wantMini = !!address && showMiniBrowser !== false;
    const wantLinks = !!address && showLookupLinks !== false;

    if (this.els.btnMini) this.els.btnMini.hidden = !wantMini;
    host.style.display = wantMini || wantLinks ? '' : 'none';

    if (!wantLinks) {
      links.textContent = '';
      // Clear the cache key too, otherwise coming back to the same address
      // short-circuits below and the links stay hidden for good.
      delete links.dataset.sig;
      return;
    }

    if (links.dataset.sig === address) return;
    links.dataset.sig = address;
    links.textContent = '';

    for (const [text, href] of [
      ['Open in Zillow', lookupUrls.zillow],
      ['Redfin', lookupUrls.redfin],
    ]) {
      if (!href) continue;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = text;
      links.appendChild(a);
    }
  }

  /** Keep the mini-browser button honest about what is actually open. */
  setMiniOpen(open) {
    const btn = this.els.btnMini;
    if (!btn) return;
    btn.classList.toggle('on', !!open);
    btn.textContent = open ? 'Close preview' : 'Preview on Zillow';
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

/** The itemised costs, as hover text on the figure they came out of. */
/**
 * The ratio, the limit it was judged by, and what to do about it.
 *
 * A failing file gets the payment that would have cleared instead of a bare
 * red number: "over 32%" ends the call, "needs a payment under $2,368" is
 * the next sentence of it.
 */
function dtiRow(dti) {
  const part = dti.front;
  const verdict = part.pass == null ? 'none' : (part.pass ? 'ok' : 'no');

  let note;
  if (part.limit == null) {
    note = 'no limit set for this programme';
  } else if (part.pass) {
    note = `under ${pctLimit(part.limit)}, ${part.headroom.toFixed(2)} pts of room`;
  } else {
    note = `over ${pctLimit(part.limit)}`
      + (dti.maxPayment ? ` — needs a payment under ${formatMoney(dti.maxPayment)}` : '');
  }

  const pill = part.pass == null ? '' : (part.pass ? 'Qualifies' : 'Over');
  return `<div class="dti-row ${verdict}">`
    + `<b>${part.percent.toFixed(2)}<small>%</small></b>`
    + (pill ? `<span class="dti-pill">${pill}</span>` : '')
    + `<i>${escapeHtml(note)}</i></div>`;
}

const pctLimit = (limit) => (limit == null ? 'none' : `${(limit * 100).toFixed(0)}%`);

/** Which half of the input is missing, said as an instruction. */
function dtiGap(dti) {
  const missing = dti?.missing ?? ['piti', 'monthlyIncome'];
  if (missing.includes('piti') && missing.includes('monthlyIncome')) {
    return 'Enter the PITI from Easy Qualifier and the monthly income on the application.';
  }
  if (missing.includes('piti')) return 'Enter the PITI Easy Qualifier came back with.';
  return 'Enter the gross monthly income on the application.';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function closingBreakdown(result) {
  const estimate = result?.closingEstimate;
  if (!estimate?.items?.length) return '';
  const lines = estimate.items.map((item) => `${item.label}  ${formatMoney(item.amount)}`);
  lines.push(`Total  ${formatMoney(estimate.total)}`);
  for (const warning of estimate.warnings ?? []) lines.push(`\n${warning.text}`);
  return lines.join('\n');
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

  <!--
    The answer, first and largest — as two figures, because on a call they
    are two different sentences. The blue one is what gets said out loud:
    the raw LTV ceiling against the payoff, before any fee or cost. The
    green one is what the borrower actually receives. Showing only the
    first is how a floor over-promises; showing only the second is how it
    under-quotes against everyone else. Both, side by side, is the honest
    version of the same conversation.
  -->
  <div class="result" data-tone="idle">
    <div class="heads">
      <div class="head">
        <span class="cap">Advertised</span>
        <span class="num none adv" data-out="advertised">—</span>
        <span class="sub">before fees &amp; costs</span>
      </div>
      <div class="head">
        <span class="cap">Take-home</span>
        <span class="num none net" data-out="cash">—</span>
        <span class="sub" data-out="cashNote">after fees &amp; costs</span>
      </div>
    </div>

    <!--
      The gap between the two figures, stated once and out loud. A manager
      asked what closing runs on these files answers with one all-in number
      including the funding fee, so that is the number shown first, with the
      split behind it. Hidden when there is nothing to explain.
    -->
    <div class="costline" data-out="costLine"></div>

    <span class="pill idle" data-out="verdict">—</span>

    <div class="ltvbar">
      <div class="track">
        <div class="fill"></div>
        <div class="cap"></div>
      </div>
      <div class="lbl"><span data-bar="left"></span><span data-bar="right"></span></div>
    </div>
  </div>

  <!--
    What actually gets typed into Easy Qualifier.

    The equity figures above answer "is there a deal here". This answers
    "what do I put in the box", which is the question an agent has on the
    call, and it is built the way the floor builds it: six months of escrow,
    the flat charges, the payoff, the cash, grossed up. Every line is shown
    because every line is arguable, and an agent who cannot see where the
    escrow number came from will not trust the total.
  -->
  <section class="eq">
    <div class="eq-hd">
      <span class="eq-cap">Easy Qualifier &mdash; Loan Amount</span>
      <button class="btn tiny" data-act="copy-eq">Copy</button>
    </div>
    <div class="eq-final" data-eq="final">&mdash;</div>
    <div class="eq-note" data-eq="note">Needs the payoff, the cash-out and the tax bill.</div>
    <div class="eq-over" data-eq="over"></div>

    <!--
      The tax bill sits directly above the working it feeds rather than at
      the foot of the panel. It is the one input to this calculation that is
      not on the record, and an agent correcting it should be watching the
      escrow line move as they type.
    -->
    <label class="eq-tax">
      <span>Annual property tax <i data-eq="taxsrc"></i></span>
      <input type="text" data-in="annualPropertyTax" placeholder="from Zillow" inputmode="decimal" />
    </label>

    <div class="eq-rows" data-eq="rows"></div>

    <!--
      The rest of Easy Qualifier's fields used to be listed here, under EQ's
      own names. It was fourteen rows between the loan amount and the debt
      ratio, and it made the panel something to scroll rather than read. The
      list still exists and still goes on the clipboard with Copy — it just
      no longer sits between the agent and the two figures that matter.
    -->

    <!--
      Debt-to-income, the other direction. Easy Qualifier gives back a
      payment; that payment comes back here and says whether the borrower
      can carry it. Front-end only: it is the cheap early answer, and a file
      that fails the house on its own is finished before the liabilities
      are even worth asking about.
    -->
    <div class="dti">
      <label class="eq-tax">
        <span>PITI from Easy Qualifier <i data-dti="src"></i></span>
        <input type="text" data-in="piti" placeholder="monthly payment" inputmode="decimal" />
      </label>
      <div class="dti-rows" data-dti="rows"></div>
    </div>
  </section>

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
  <div class="lookup">
    <button class="btn mini" data-act="mini" hidden>Preview on Zillow</button>
    <span class="lookup-links"></span>
  </div>

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

  <!--
    The standing assumptions — finance the fee, waive it, subsequent use,
    treat the value as an estimate — moved to Settings. They are a shop's
    policy rather than a per-borrower choice, and four switches nobody
    touches during a call were four rows of panel earning nothing.
  -->

  <div class="foot">
    <button class="btn primary" data-act="copy">Copy summary</button>
    <button class="btn" data-act="pick-propertyValue">Bind value</button>
    <button class="btn" data-act="pick-firstLien">Bind balance</button>
    <button class="btn wide" data-act="pick-fullName">Bind name</button>
    <button class="btn wide" data-act="reset">Reset</button>
  </div>

  <div class="disclaimer">
    Estimate only — LTV cap and financed upfront fee. Not a quote, offer, or
    commitment to lend.
  </div>
</div>

<!--
  Resize handles. Three of them rather than one corner: the corner alone was
  an 18px target hidden behind the drawer's scrollbar, and a control nobody
  can hit is a control that does not exist.
-->
<div class="rz rz-left" data-act="resize" data-axis="x" title="Drag to resize"></div>
<div class="rz rz-bottom" data-act="resize" data-axis="y" title="Drag to resize"></div>
<div class="grip" data-act="resize" data-axis="xy" title="Drag to resize"></div>
`;
