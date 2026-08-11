/**
 * The floating panel.
 *
 * Built once, then updated in place. Updating in place (rather than
 * re-rendering) matters because the page underneath refreshes constantly —
 * a full re-render would steal focus and wipe half-typed input every time a
 * value changed on the host page.
 */

import { formatMoney, formatPercent } from '../lib/money.js';
import { PANEL_CSS } from './styles.js';

const HOST_ID = '__equity_lens_host__';

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

      first: q('[data-in=firstLien]'),
      firstSrc: q('[data-src=firstLien]'),
      second: q('[data-in=secondLien]'),

      program: q('[data-in=program]'),
      programSrc: q('[data-src=program]'),
      state: q('[data-in=state]'),
      stateSrc: q('[data-src=state]'),

      closingCosts: q('[data-ov=closingCosts]'),
      ltvOverride: q('[data-ov=ltvOverride]'),
      loanLimit: q('[data-ov=loanLimit]'),
      feeExempt: q('[data-ov=feeExempt]'),
      subsequentUse: q('[data-ov=subsequentUse]'),
      financeFee: q('[data-ov=financeFee]'),
      valueIsAvm: q('[data-ov=valueIsAvm]'),

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
      btnCopy: q('[data-act=copy]'),
      btnPickValue: q('[data-act=pick-propertyValue]'),
      btnPickFirst: q('[data-act=pick-firstLien]'),
      btnReset: q('[data-act=reset]'),
    };
  }

  wireEvents() {
    const { els } = this;

    els.btnCollapse.addEventListener('click', () => this.toggleCollapse());
    els.btnClose.addEventListener('click', () => this.h.onClose?.());

    for (const key of ['propertyValue', 'firstLien', 'secondLien', 'program', 'state']) {
      const el = this.root.querySelector(`[data-in=${key}]`);
      if (!el) continue;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => this.h.onManualChange?.(key, el.value));
    }

    for (const key of ['closingCosts', 'ltvOverride', 'loanLimit']) {
      const el = this.root.querySelector(`[data-ov=${key}]`);
      el?.addEventListener('input', () => this.h.onOverrideChange?.(key, el.value));
    }
    for (const key of ['feeExempt', 'subsequentUse', 'financeFee', 'valueIsAvm']) {
      const el = this.root.querySelector(`[data-ov=${key}]`);
      el?.addEventListener('change', () => this.h.onOverrideChange?.(key, el.checked));
    }

    for (const el of [els.solvePayment, els.solveRate, els.solveYears]) {
      el?.addEventListener('input', () => this.h.onSolveChange?.(this.readSolver()));
    }
    els.btnUseSolved.addEventListener('click', () => this.h.onUseSolved?.(this.readSolver()));

    els.btnCopy.addEventListener('click', () => this.h.onCopy?.());
    els.btnReset.addEventListener('click', () => this.h.onReset?.());
    els.btnPickValue.addEventListener('click', () => this.h.onPick?.('propertyValue'));
    els.btnPickFirst.addEventListener('click', () => this.h.onPick?.('firstLien'));

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

  /** Set an input's value without disturbing the user if they're typing in it. */
  setInput(el, value) {
    if (!el) return;
    if (this.root.activeElement === el) return;
    const next = value == null ? '' : String(value);
    if (el.value !== next) el.value = next;
  }

  /* ---------------------------------------------------------------- */

  render(state) {
    if (!this.mounted) return;
    const { inputs, overrides, result, recordLabel, live, picking } = state;
    const { els } = this;

    els.dot.className = `dot ${live ? 'live' : 'stale'}`;
    els.who.textContent = recordLabel || 'No record detected';

    // --- inputs
    this.setInput(els.value, inputs.propertyValue?.value ?? '');
    this.setInput(els.first, inputs.firstLien?.value ?? '');
    this.setInput(els.second, inputs.secondLien?.value ?? '');
    this.setInput(els.program, inputs.program?.value ?? '');
    this.setInput(els.state, inputs.state?.value ?? '');

    els.value.classList.toggle('empty', !inputs.propertyValue?.value);
    els.first.classList.toggle('warnval', !!inputs.firstLien?.implausible);

    setSrc(els.valueSrc, inputs.propertyValue);
    setSrc(els.firstSrc, inputs.firstLien);
    setSrc(els.programSrc, inputs.program);
    setSrc(els.stateSrc, inputs.state);

    this.setInput(els.closingCosts, overrides.closingCosts ?? '');
    this.setInput(els.ltvOverride, overrides.ltvOverride ?? '');
    this.setInput(els.loanLimit, overrides.loanLimit ?? '');
    els.feeExempt.checked = !!overrides.feeExempt;
    els.subsequentUse.checked = !!overrides.subsequentUse;
    els.financeFee.checked = overrides.financeFee !== false;
    els.valueIsAvm.checked = !!overrides.valueIsAvm;

    els.btnPickValue.classList.toggle('picking', picking === 'propertyValue');
    els.btnPickFirst.classList.toggle('picking', picking === 'firstLien');

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

  renderLookup(state) {
    const { inputs, showLookupLinks } = state;
    const host = this.els.lookup;
    const street = inputs.street?.value;
    const city = inputs.city?.value;
    const st = inputs.state?.value;
    const zip = inputs.zip?.value;

    if (!showLookupLinks || !street) {
      host.style.display = 'none';
      return;
    }

    const full = [street, city, st, zip].filter(Boolean).join(', ');
    const sig = full;
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    host.style.display = '';
    host.textContent = '';
    const q = encodeURIComponent(full);
    const links = [
      ['Zillow', `https://www.zillow.com/homes/${q}_rb/`],
      ['Redfin', `https://www.redfin.com/search?query=${q}`],
      ['Search', `https://www.google.com/search?q=${q}+home+value`],
    ];
    for (const [text, href] of links) {
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
  const map = { auto: 'auto', manual: 'typed', bound: 'bound' };
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
  <span class="title">EQUITY</span>
  <span class="who"></span>
  <button data-act="collapse" title="Collapse (Alt+E)">—</button>
  <button data-act="close" title="Turn off for this site">×</button>
</div>

<div class="body">
  <div class="row">
    <label>Home value <span class="src" data-src="propertyValue"></span></label>
    <input type="text" class="hero" data-in="propertyValue" placeholder="$0" inputmode="decimal" />
    <div class="hint" data-hint="propertyValue"></div>
    <div class="lookup"></div>
  </div>

  <div class="two">
    <div class="row">
      <label>Mortgage balance <span class="src" data-src="firstLien"></span></label>
      <input type="text" data-in="firstLien" placeholder="$0" inputmode="decimal" />
    </div>
    <div class="row">
      <label>2nd / HELOC</label>
      <input type="text" data-in="secondLien" placeholder="$0" inputmode="decimal" />
    </div>
  </div>

  <div class="two">
    <div class="row">
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

  <div class="result">
    <div class="headline">
      <span class="num none" data-out="cash">—</span>
      <span class="cap">cash out</span>
    </div>
    <span class="pill idle" data-out="verdict">—</span>

    <div class="ltvbar">
      <div class="track">
        <div class="fill"></div>
        <div class="cap"></div>
      </div>
      <div class="lbl"><span data-bar="left"></span><span data-bar="right"></span></div>
    </div>

    <div class="grid">
      <div class="cell"><div class="k">Max loan</div><div class="v" data-out="maxLoan">—</div></div>
      <div class="cell"><div class="k">Gross equity</div><div class="v" data-out="equity">—</div></div>
      <div class="cell"><div class="k">Current LTV</div><div class="v sub" data-out="currentLtv">—</div></div>
      <div class="cell"><div class="k">Max LTV</div><div class="v sub" data-out="maxLtv">—</div></div>
      <div class="cell" data-row="fee"><div class="k">Fee</div><div class="v sub" data-out="fee">—</div></div>
      <div class="cell"><div class="k">Total loan</div><div class="v sub" data-out="total">—</div></div>
      <div class="cell"><div class="k">Program</div><div class="v sub" data-out="breakeven">—</div></div>
    </div>

    <div class="msgs"></div>
  </div>

  <details class="adv">
    <summary>Assumptions &amp; overrides</summary>
    <div class="three">
      <div class="row">
        <label>Closing costs</label>
        <input type="text" data-ov="closingCosts" placeholder="$0" inputmode="decimal" />
      </div>
      <div class="row">
        <label>LTV override</label>
        <input type="text" data-ov="ltvOverride" placeholder="auto" inputmode="decimal" />
      </div>
      <div class="row">
        <label>Loan limit</label>
        <input type="text" data-ov="loanLimit" placeholder="none" inputmode="decimal" />
      </div>
    </div>
    <label class="check"><input type="checkbox" data-ov="financeFee" /> Finance the upfront fee</label>
    <label class="check"><input type="checkbox" data-ov="feeExempt" /> VA funding fee exempt (disability)</label>
    <label class="check"><input type="checkbox" data-ov="subsequentUse" /> VA subsequent use</label>
    <label class="check"><input type="checkbox" data-ov="valueIsAvm" /> Value is an automated estimate</label>
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
    <div class="foot">
      <button class="btn" data-act="use-solved">Use as balance</button>
    </div>
    <div class="hint">
      Rough estimate from principal &amp; interest only. A payment that includes
      taxes and insurance will overstate the balance. Always confirm the real
      payoff.
    </div>
  </details>

  <div class="foot">
    <button class="btn primary" data-act="copy">Copy</button>
    <button class="btn" data-act="pick-propertyValue">Bind value</button>
    <button class="btn" data-act="pick-firstLien">Bind balance</button>
    <button class="btn" data-act="reset">Reset</button>
  </div>

  <div class="disclaimer">
    Estimate only. Models the LTV cap and financed upfront fee — not DTI, credit,
    residual income, seasoning, entitlement, occupancy, unit count, county loan
    limits or investor overlays. Not a quote, offer, or commitment to lend.
    Verify every figure before relying on it.
  </div>
</div>
`;
