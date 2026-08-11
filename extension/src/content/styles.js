/**
 * Panel styles, injected into a shadow root so the host page's CSS can't
 * reach them and they can't reach the host page.
 */
export const PANEL_CSS = `
:host { all: initial; }

* { box-sizing: border-box; }

.wrap {
  position: fixed;
  z-index: 2147483600;
  width: 340px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  box-shadow: 0 10px 34px rgba(15, 23, 42, .22);
  overflow: hidden;
}
.wrap.collapsed { width: auto; }

/* --- header --- */
.hd {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: #0f172a; color: #f8fafc;
  cursor: grab; user-select: none;
}
.hd:active { cursor: grabbing; }
.hd .dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; flex: none; }
.hd .dot.live { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
.hd .dot.stale { background: #f59e0b; }
.hd .title { font-weight: 600; font-size: 12px; letter-spacing: .02em; }
.hd .who {
  flex: 1; min-width: 0; font-size: 11px; color: #94a3b8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hd button {
  all: unset; cursor: pointer; padding: 2px 6px; border-radius: 4px;
  font-size: 13px; line-height: 1; color: #cbd5e1;
}
.hd button:hover { background: rgba(255,255,255,.14); color: #fff; }

.body { padding: 10px; max-height: 76vh; overflow-y: auto; }
.wrap.collapsed .body { display: none; }

/* --- inputs --- */
.row { margin-bottom: 8px; }
.row label {
  display: block; font-size: 10px; text-transform: uppercase;
  letter-spacing: .05em; color: #64748b; margin-bottom: 3px; font-weight: 600;
}
.row .src {
  font-weight: 400; text-transform: none; letter-spacing: 0;
  color: #94a3b8; font-size: 10px;
}
.row .src.auto { color: #0d9488; }
.row .src.manual { color: #c2410c; }
.row .src.bound { color: #7c3aed; }

input[type=text], input[type=number], select {
  width: 100%; padding: 6px 8px; font-size: 13px; font-family: inherit;
  border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #0f172a;
}
input:focus, select:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
input.hero {
  font-size: 20px; font-weight: 700; padding: 8px 10px;
  border: 2px solid #2563eb; background: #eff6ff;
}
input.hero.empty { border-color: #f59e0b; background: #fffbeb; }
input.warnval { border-color: #f59e0b; background: #fffbeb; }

.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

.hint { font-size: 10px; color: #64748b; margin-top: 3px; }
.hint b { color: #0f172a; }

/* --- results --- */
.result {
  margin: 10px -10px 0; padding: 10px; border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}
.headline { display: flex; align-items: baseline; gap: 8px; }
.headline .num { font-size: 26px; font-weight: 800; letter-spacing: -.02em; }
.headline .num.good { color: #15803d; }
.headline .num.bad  { color: #b91c1c; }
.headline .num.none { color: #94a3b8; }
.headline .cap { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 600; }

.pill {
  display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
}
.pill.good { background: #dcfce7; color: #15803d; }
.pill.bad  { background: #fee2e2; color: #b91c1c; }
.pill.idle { background: #e2e8f0; color: #475569; }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 10px; }
.cell .k { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 600; }
.cell .v { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cell .v.sub { font-size: 12px; font-weight: 500; color: #475569; }

.ltvbar { margin-top: 10px; }
.ltvbar .track { position: relative; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
.ltvbar .fill { position: absolute; inset: 0 auto 0 0; background: #0ea5e9; }
.ltvbar .fill.over { background: #ef4444; }
.ltvbar .cap { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #0f172a; }
.ltvbar .lbl { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; margin-top: 3px; }

/* --- messages --- */
.msgs { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.msg { font-size: 11px; padding: 5px 7px; border-radius: 5px; border-left: 3px solid; }
.msg.error { background: #fef2f2; border-color: #dc2626; color: #7f1d1d; }
.msg.warn  { background: #fffbeb; border-color: #f59e0b; color: #78350f; }
.msg.info  { background: #eff6ff; border-color: #3b82f6; color: #1e3a8a; }

/* --- footer --- */
.foot { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.btn {
  all: unset; cursor: pointer; padding: 5px 9px; border-radius: 6px;
  font-size: 11px; font-weight: 600; border: 1px solid #cbd5e1; color: #334155;
  background: #fff; text-align: center;
}
.btn:hover { background: #f1f5f9; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.primary:hover { background: #1d4ed8; }
.btn.picking { background: #7c3aed; border-color: #7c3aed; color: #fff; }
.btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

.lookup { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.lookup a {
  font-size: 10px; color: #2563eb; text-decoration: none;
  border: 1px solid #bfdbfe; background: #eff6ff; padding: 2px 6px; border-radius: 5px;
}
.lookup a:hover { text-decoration: underline; }

details.adv { margin-top: 8px; }
details.adv > summary {
  cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
  color: #64748b; font-weight: 600; list-style: none; padding: 4px 0;
}
details.adv > summary::-webkit-details-marker { display: none; }
details.adv > summary::before { content: "▸ "; }
details.adv[open] > summary::before { content: "▾ "; }

.check { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 6px; color: #334155; }
.check input { width: auto; }

.disclaimer {
  margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;
  font-size: 9px; color: #94a3b8; line-height: 1.35;
}

/* --- element picker overlay --- */
.pickhint {
  position: fixed; left: 50%; top: 14px; transform: translateX(-50%);
  z-index: 2147483647; background: #7c3aed; color: #fff;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 6px 20px rgba(0,0,0,.3);
}
`;

/** Highlight box used by the picker, injected into the *host* page. */
export const PICKER_CSS = `
.__eqlens_pick_hl {
  position: absolute; z-index: 2147483646; pointer-events: none;
  border: 2px solid #7c3aed; background: rgba(124,58,237,.14);
  border-radius: 3px; transition: all .04s linear;
}
`;
