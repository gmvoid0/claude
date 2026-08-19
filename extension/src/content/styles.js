/**
 * Panel styles.
 *
 * Injected into a shadow root, so the host page's CSS cannot reach in and
 * these cannot leak out. `:host { all: initial }` means nothing is inherited
 * either — every value here is declared deliberately.
 *
 * The idiom is iOS: system materials rather than flat cards. Translucent
 * surfaces over a backdrop blur, hairline separators, grouped inset lists,
 * continuous-looking corner radii, and a single accent colour. The gloss is
 * the classic Apple treatment — a top-weighted highlight over a vertical
 * gradient — used sparingly on the header and the primary action so it reads
 * as depth rather than decoration.
 *
 * One constraint shapes every spacing decision: this sits on top of a working
 * dialer screen and an agent reads it between sentences. It stays dense and
 * high-contrast; the polish is not allowed to cost legibility.
 */
export const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

/* Our own display rules outrank the user-agent [hidden] rule, so state it
   explicitly — otherwise hiding a styled element silently does nothing. */
[hidden] { display: none !important; }

.wrap {
  /* --- iOS system palette, light --- */
  --blue: #007AFF;
  --blue-hi: #4DA2FF;
  --blue-lo: #0062CC;
  --green: #34C759;
  --green-deep: #248A3D;
  --red: #FF3B30;
  --red-deep: #C9241B;
  --orange: #FF9500;
  --orange-deep: #B25E00;
  --purple: #AF52DE;

  --label: #000000;
  --label-2: rgba(60, 60, 67, .68);
  --label-3: rgba(60, 60, 67, .42);

  --surface: rgba(249, 249, 251, .78);
  --card: rgba(255, 255, 255, .92);
  --card-solid: #FFFFFF;
  --fill: rgba(118, 118, 128, .10);
  --fill-strong: rgba(118, 118, 128, .16);
  --separator: rgba(60, 60, 67, .13);
  --hairline: rgba(0, 0, 0, .10);

  --r-panel: 18px;
  --r-card: 13px;
  --r-field: 10px;
  --r-pill: 980px;

  position: fixed;
  z-index: 2147483600;
  --panel-w: 358px;
  --panel-h: 78vh;
  width: var(--panel-w);

  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
               "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.38;
  letter-spacing: -0.01em;
  color: var(--label);
  -webkit-font-smoothing: antialiased;

  background: var(--surface);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);

  border: 0.5px solid var(--hairline);
  border-radius: var(--r-panel);
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, .04),
    0 12px 36px rgba(0, 0, 0, .18),
    0 2px 8px rgba(0, 0, 0, .10);
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .wrap {
    --blue: #0A84FF;
    --blue-hi: #57ABFF;
    --blue-lo: #0064D2;
    --green: #30D158;
    --green-deep: #7DE297;
    --red: #FF453A;
    --red-deep: #FF8078;
    --orange: #FF9F0A;
    --orange-deep: #FFC062;
    --purple: #BF5AF2;

    --label: #FFFFFF;
    --label-2: rgba(235, 235, 245, .62);
    --label-3: rgba(235, 235, 245, .35);

    --surface: rgba(28, 28, 30, .78);
    --card: rgba(44, 44, 46, .88);
    --card-solid: #2C2C2E;
    --fill: rgba(118, 118, 128, .22);
    --fill-strong: rgba(118, 118, 128, .32);
    --separator: rgba(84, 84, 88, .60);
    --hairline: rgba(255, 255, 255, .12);

    box-shadow:
      0 0 0 0.5px rgba(255, 255, 255, .06),
      0 14px 40px rgba(0, 0, 0, .55);
  }
}

/* ------------------------------------------------------------------ *
 * Application drawer
 *
 * Sits alongside the panel rather than inside it, so the calculator stays
 * fully visible while the form is being filled. The panel is right-docked,
 * so the drawer opens to the left of it.
 * ------------------------------------------------------------------ */

/* Grid rather than flex: the two columns plus a full-width title bar are a
   fixed arrangement, and flex wrapping put the drawer above the calculator
   the moment a border pushed the row past its width. */
.wrap.with-drawer {
  display: grid;
  grid-template-columns: var(--panel-w) var(--panel-w);
  grid-template-areas:
    "hd     hd"
    "drawer body";
  width: calc(var(--panel-w) * 2);
}
.wrap.with-drawer .hd     { grid-area: hd; }
.wrap.with-drawer .drawer { grid-area: drawer; }
.wrap.with-drawer .body   { grid-area: body; width: 100%; }

.drawer {
  width: 100%;
  border-right: 0.5px solid var(--separator);
  background: var(--fill);
  max-height: var(--panel-h);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.drawer-hd {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 12px;
  border-bottom: 0.5px solid var(--separator);
  position: sticky; top: 0;
  background: var(--surface);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  z-index: 1;
}
.drawer-title { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
.drawer-count {
  font-size: 10px; font-weight: 600;
  color: var(--label-2);
  background: var(--fill-strong);
  padding: 2px 8px; border-radius: var(--r-pill);
  margin-right: auto;
  font-variant-numeric: tabular-nums;
}

.drawer-body { padding: 4px 12px 10px; }

.app-row {
  display: grid;
  grid-template-columns: 104px 1fr;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 0.5px solid var(--separator);
}
.app-row:last-child { border-bottom: none; }

/* The seven the answer depends on, on a darker ground.
   Deliberately not a colour: green already means "S.A.M filled this",
   orange means "read but implausible", and a third meaning would turn the
   form into a code the agent has to remember. Weight and ground, not hue.
   The bleed matches .drawer-body's 12px so the band runs edge to edge, and
   consecutive key fields read as one block rather than a stack of chips. */
.app-row.key {
  background: var(--fill-strong);
  margin: 0 -12px;
  padding-left: 12px;
  padding-right: 12px;
  border-bottom-color: transparent;
}
.app-row.key + .app-row.key { border-top: 0.5px solid var(--separator); }
.app-row.key .app-label { color: var(--label); }

.app-label { font-size: 11.5px; color: var(--label-2); font-weight: 600; }

.app-input {
  width: 100%;
  padding: 6px 9px;
  font-family: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--label);
  background: transparent;
  border: 0.5px solid transparent;
  border-radius: var(--r-field);
  -webkit-appearance: none;
  appearance: none;
}
.app-input:hover { background: var(--fill); }
.app-input:focus {
  outline: none;
  background: var(--card-solid);
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(0,122,255,.18);
}
/* Green marks what S.A.M filled in; anything typed reads as normal text. */
.app-row.auto.filled .app-input { color: var(--green-deep); font-weight: 600; }
/* Read off the page but outside a sane range — shown, but never in the
   colour that means "this is good". */
.app-row.suspect .app-input { color: var(--orange-deep); font-weight: 600; }
.app-row.suspect .app-label::after {
  content: " ?";
  color: var(--orange);
  font-weight: 700;
}

.co { border-top: 0.5px solid var(--separator); padding: 4px 12px 0; }
.co-toggle {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0;
  font-size: 12px; font-weight: 700;
  cursor: pointer;
}
.co-toggle input {
  all: unset;
  margin-left: auto;
  position: relative;
  width: 36px; height: 22px;
  border-radius: var(--r-pill);
  background: var(--fill-strong);
  cursor: pointer;
  flex: none;
  transition: background .22s cubic-bezier(.32,.72,0,1);
}
.co-toggle input::after {
  content: "";
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.24);
  transition: transform .22s cubic-bezier(.32,.72,0,1);
}
.co-toggle input:checked { background: var(--green); }
.co-toggle input:checked::after { transform: translateX(14px); }

.co-note { font-size: 10px; color: var(--label-3); padding: 2px 0 8px; line-height: 1.4; }

.handoff {
  margin: 10px 12px 0;
  padding: 9px 10px;
  border-radius: var(--r-field);
  font-size: 11.5px;
  line-height: 1.4;
}
.handoff.ok   { background: rgba(52,199,89,.13); color: var(--green-deep); }
.handoff.warn { background: rgba(255,149,0,.13); color: var(--orange-deep); }
.handoff.bad  { background: rgba(255,59,48,.12); color: var(--red-deep); }
.handoff.info { background: var(--fill); color: var(--label-2); }
.handoff-line { font-weight: 600; }
.handoff-detail { margin-top: 3px; opacity: .85; }

.drawer-note {
  padding: 4px 12px 12px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--label-3);
}

/* Unsaved work from the previous call. */
.draft {
  margin: 10px 12px 0;
  padding: 9px 10px;
  border-radius: var(--r-field);
  background: rgba(255,149,0,.13);
  border: 0.5px solid rgba(255,149,0,.34);
}
.draft-text { font-size: 11.5px; color: var(--orange-deep); line-height: 1.35; }
.draft-acts { display: flex; gap: 6px; margin-top: 8px; }
.draft-acts .btn { flex: 1; padding: 5px 9px; font-size: 11px; }
.draft-acts .btn.tiny { margin-left: 0; }

.hd button.on { background: var(--blue); color: #fff; }

/* ------------------------------------------------------------------ *
 * Title bar — frosted, with the Apple gloss
 * ------------------------------------------------------------------ */

.hd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 9px 13px;
  cursor: grab;
  user-select: none;
  position: relative;
  background:
    linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.14) 52%, rgba(255,255,255,0) 100%),
    var(--fill);
  border-bottom: 0.5px solid var(--separator);
}
@media (prefers-color-scheme: dark) {
  .hd {
    background:
      linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.04) 52%, rgba(255,255,255,0) 100%),
      var(--fill);
  }
}
.hd:active { cursor: grabbing; }

.hd .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--label-3); flex: none;
  transition: background .2s, box-shadow .2s;
}
.hd .dot.live  { background: var(--green); box-shadow: 0 0 0 3px rgba(52,199,89,.20); }
.hd .dot.stale { background: var(--orange); box-shadow: 0 0 0 3px rgba(255,149,0,.18); }

.hd .brand { display: flex; flex-direction: column; gap: 1px; flex: none; min-width: 0; }
.hd .title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .04em;
  line-height: 1.1;
}
.hd .subtitle {
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: .055em;
  text-transform: uppercase;
  color: var(--label-3);
  line-height: 1.1;
  white-space: nowrap;
}

/* The record gets its own row. Competing with the brand for one line meant
   the name — the thing telling the agent who is on the phone — was the part
   that got truncated. */
.hd { flex-wrap: wrap; }
.hd .brand { margin-right: auto; }
.hd .who {
  order: 9;
  flex: 0 0 100%;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--label-2);
  padding-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hd .who:empty { display: none; }

.hd button {
  all: unset;
  cursor: pointer;
  width: 20px; height: 20px;
  display: grid; place-items: center;
  border-radius: 50%;
  font-size: 12px; line-height: 1;
  color: var(--label-2);
  background: var(--fill);
  flex: none;
  transition: background .15s, color .15s;
}
.hd button:hover { background: var(--fill-strong); color: var(--label); }
.hd button:active { transform: scale(.92); }

.body {
  padding: 12px;
  max-height: var(--panel-h);
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Resize handles, on the left and bottom edges — the panel docks right, so
   those are the edges it can grow from without going off-screen.

   Three handles rather than one corner. The corner alone was an 18px target
   sitting behind the drawer's scrollbar, which in practice meant the panel
   could not be resized at all. The edges are wide enough to hit without
   aiming, and sit above the scrollable columns. */
.rz {
  position: absolute;
  z-index: 5;
}
.rz-left {
  left: 0; top: 0; bottom: 18px;
  width: 8px;
  cursor: ew-resize;
}
.rz-bottom {
  left: 18px; right: 0; bottom: 0;
  height: 8px;
  cursor: ns-resize;
}
.grip {
  position: absolute;
  left: 0; bottom: 0;
  width: 22px; height: 22px;
  cursor: nesw-resize;
  z-index: 6;
}
.grip::before {
  content: "";
  position: absolute;
  left: 5px; bottom: 5px;
  width: 9px; height: 9px;
  border-left: 2px solid var(--label-3);
  border-bottom: 2px solid var(--label-3);
  border-bottom-left-radius: 3px;
  opacity: .75;
}

/* The edges are invisible until the pointer is near them, then they show a
   hairline so it is obvious what is about to happen. */
.rz:hover, .wrap.resizing .rz { background: var(--blue); opacity: .28; }
.grip:hover::before { opacity: 1; border-color: var(--blue); }
.wrap.resizing { user-select: none; }

/* ------------------------------------------------------------------ *
 * Collapsed — the title bar and nothing else
 *
 * Declared after the drawer and body rules deliberately: the with-drawer
 * rule carries the same specificity, so a collapse rule written above it lost.
 * When that happened,
 * the panel kept its two-column grid and its full width, the drawer stayed
 * on screen, and a 980px radius over a box that size drew the giant oval
 * that made minimising look like a freeze.
 *
 * Everything that can hold height is taken out, so what remains is bounded
 * by the header no matter what state the panel was in when it collapsed.
 * ------------------------------------------------------------------ */
.wrap.collapsed,
.wrap.collapsed.with-drawer {
  display: block;
  width: auto;
  max-width: min(340px, calc(100vw - 32px));
  border-radius: var(--r-panel);
}
.wrap.collapsed .body,
.wrap.collapsed .drawer,
.wrap.collapsed .rz,
.wrap.collapsed .grip { display: none !important; }
.wrap.collapsed .hd { border-bottom: none; }

/* ------------------------------------------------------------------ *
 * Grouped sections
 * ------------------------------------------------------------------ */

.group {
  background: var(--card);
  border: 0.5px solid var(--hairline);
  border-radius: var(--r-card);
  padding: 11px 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.group + .group { margin-top: 0; }

.row + .row { margin-top: 9px; }

.row label {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--label-2);
  margin-bottom: 5px;
  letter-spacing: -0.005em;
}

.row .src {
  font-weight: 500;
  font-size: 10px;
  color: var(--label-3);
  margin-left: auto;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 60%;
}
.row .src.auto     { color: var(--blue); }
.row .src.manual   { color: var(--orange-deep); }
.row .src.bound    { color: var(--purple); }
.row .src.external { color: var(--green-deep); }

/* --- fields --- */

input[type=text], input[type=number], select, textarea {
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--label);
  background: var(--fill);
  border: 0.5px solid transparent;
  border-radius: var(--r-field);
  transition: background .15s, border-color .15s, box-shadow .15s;
  -webkit-appearance: none;
  appearance: none;
}
input::placeholder { color: var(--label-3); }

input:focus, select:focus {
  outline: none;
  background: var(--card-solid);
  border-color: var(--blue);
  box-shadow: 0 0 0 3.5px rgba(0,122,255,.18);
}

/* A drawn chevron rather than the platform arrow, so the control matches
   the rest of the panel on every OS. */
select {
  cursor: pointer;
  padding-right: 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' fill='none' stroke='%238E8E93' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-position: right 10px center;
  background-size: 10px 7px;
  background-repeat: no-repeat;
}
select:focus { background-color: var(--card-solid); }

/* The native dropdown list inherits colour from the select, so a red-tinted
   or dark-mode select produced unreadable options against the popup's own
   background. State both explicitly on the options themselves. */
select option {
  background-color: var(--card-solid);
  color: var(--label);
  font-weight: 500;
}
.row.flagged select { color: var(--label); }
.row.flagged select option { background-color: var(--card-solid); }

input.hero {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.025em;
  padding: 10px 12px;
  background: var(--card-solid);
  border-color: var(--separator);
}
input.hero:focus { border-color: var(--blue); }
input.hero.empty {
  background: rgba(255,149,0,.08);
  border-color: rgba(255,149,0,.45);
}
input.warnval {
  background: rgba(255,149,0,.10);
  border-color: rgba(255,149,0,.45);
}

.two   { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.two .row + .row, .three .row + .row { margin-top: 0; }
.two + .two, .three + .two, .two + .three { margin-top: 9px; }

.hint { font-size: 11px; color: var(--label-2); margin-top: 5px; }
.hint b { color: var(--label); font-weight: 600; }

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

.result {
  background: var(--card);
  transition: background .25s, border-color .25s;
  border: 0.5px solid var(--hairline);
  border-radius: var(--r-card);
  padding: 14px 12px 12px;
  margin-bottom: 10px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}

/* Two figures of equal weight: what gets quoted, and what is received.
   Neither is a footnote to the other. */
.heads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: start;
}
.heads .head { min-width: 0; }
.heads .head + .head { border-left: 0.5px solid var(--separator); padding-left: 10px; }

.head .cap {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--label-3);
  margin-bottom: 1px;
}
/* A step below the loan amount, which is 38px. These two answer "is there
   a deal here"; that one answers "what do I type", and only one of them can
   be the biggest thing on the panel. */
.head .num {
  display: block;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.head .sub {
  display: block;
  margin-top: 3px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--label-3);
  line-height: 1.3;
}

/* Blue is the number said out loud, green is the number received, and red
   overrides both the moment the deal stops being worth having. */
.head .num.adv  { color: var(--blue); }
.head .num.net  { color: var(--green-deep); }
.head .num.good { color: var(--green-deep); }
.head .num.bad  { color: var(--red-deep); }
.head .num.none { color: var(--label-3); }

.pill {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 11px;
  border-radius: var(--r-pill);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.pill.good { background: rgba(52,199,89,.16);  color: var(--green-deep); }
.pill.bad  { background: rgba(255,59,48,.14);  color: var(--red-deep); }
.pill.idle { background: var(--fill);          color: var(--label-2); }

/* --- LTV meter --- */
.ltvbar { margin-top: 13px; }
.ltvbar .track {
  position: relative; height: 7px;
  background: var(--fill-strong);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.ltvbar .fill {
  position: absolute; inset: 0 auto 0 0;
  border-radius: var(--r-pill);
  background: linear-gradient(180deg, var(--blue-hi), var(--blue));
  transition: width .28s cubic-bezier(.32,.72,0,1), background .2s;
}
.ltvbar .fill.over { background: linear-gradient(180deg, #FF6961, var(--red)); }
.ltvbar .cap {
  position: absolute; top: -2px; bottom: -2px; width: 2px;
  border-radius: 1px;
  background: var(--label);
  opacity: .55;
  transition: left .28s cubic-bezier(.32,.72,0,1);
}
.ltvbar .lbl {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--label-3); margin-top: 5px;
  font-variant-numeric: tabular-nums;
}

/* --- inset grouped list, iOS Settings style --- */
.grid {
  margin-top: 12px;
  text-align: left;
  border-top: 0.5px solid var(--separator);
}
.cell {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  padding: 7px 0;
  border-bottom: 0.5px solid var(--separator);
}
.cell:last-child { border-bottom: none; padding-bottom: 0; }
.cell .k {
  font-size: 12px;
  color: var(--label-2);
  white-space: nowrap;
}
.cell .v {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  text-align: right;
}
.cell .v.sub { font-weight: 500; color: var(--label-2); }

/* ------------------------------------------------------------------ *
 * Headline pairing: the value being typed, next to what it produces
 * ------------------------------------------------------------------ */

.pair {
  display: block;
  background: var(--card);
  border: 0.5px solid var(--hairline);
  border-radius: var(--r-card);
  padding: 11px 12px;
  margin-bottom: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.pair-cell { min-width: 0; }
.pair-cell label {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--label-2);
  margin-bottom: 5px;
}
.bignum {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  padding: 10px 0 0;
  line-height: 1.1;
}
.bignum.good { color: var(--green-deep); }
.bignum.bad  { color: var(--red-deep); }
.bignum.none { color: var(--label-3); }

/* The result card takes a tint from the answer, so the verdict is legible
   from across a desk without reading the number. */
.result[data-tone="good"] {
  background: linear-gradient(180deg, rgba(52,199,89,.14), rgba(52,199,89,.06));
  border-color: rgba(52,199,89,.36);
}
.result[data-tone="bad"] {
  background: linear-gradient(180deg, rgba(255,59,48,.13), rgba(255,59,48,.05));
  border-color: rgba(255,59,48,.34);
}
.result[data-tone="thin"] {
  background: linear-gradient(180deg, rgba(255,149,0,.13), rgba(255,149,0,.05));
  border-color: rgba(255,149,0,.34);
}

/* A field the calculation had to assume. Red because it is a question for
   the borrower, not a preference. */
.row.flagged select,
.row.flagged input {
  border-color: var(--red);
  background: rgba(255,59,48,.09);
  box-shadow: 0 0 0 3px rgba(255,59,48,.12);
}
.row.flagged label { color: var(--red-deep); }
.row.flagged label::after {
  content: "confirm";
  margin-left: auto;
  font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em;
  color: #fff; background: var(--red);
  padding: 2px 7px; border-radius: var(--r-pill);
}

.msgs:empty { display: none; }
.body > .msgs { margin-top: 0; margin-bottom: 10px; }
.body > .hint { margin: 6px 2px 0; }
.body > .lookup { margin: 7px 2px 10px; }
.body > .ext { margin: 8px 0 10px; }

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

.msgs { margin-top: 11px; display: flex; flex-direction: column; gap: 6px; text-align: left; }
.msg {
  font-size: 11.5px;
  line-height: 1.35;
  padding: 8px 10px;
  border-radius: var(--r-field);
}
.msg.error { background: rgba(255,59,48,.11);  color: var(--red-deep); }
.msg.warn  { background: rgba(255,149,0,.13);  color: var(--orange-deep); }
.msg.info  { background: rgba(0,122,255,.10);  color: var(--blue); }

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

.foot { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 2px; }
.foot .btn.primary, .foot .btn.wide { grid-column: 1 / -1; }

.btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: block;
  padding: 8px 12px;
  border-radius: var(--r-field);
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  color: var(--blue);
  background: var(--fill);
  transition: background .15s, transform .08s, box-shadow .15s;
}
.btn:hover  { background: var(--fill-strong); }
.btn:active { transform: scale(.975); }
.btn:focus-visible { outline: none; box-shadow: 0 0 0 3.5px rgba(0,122,255,.30); }

/* The glossy primary: vertical gradient plus a top inner highlight. */
.btn.primary {
  color: #fff;
  background: linear-gradient(180deg, var(--blue-hi) 0%, var(--blue) 52%, var(--blue-lo) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.45),
    inset 0 -1px 0 rgba(0,0,0,.10),
    0 1px 2px rgba(0,0,0,.18);
}
.btn.primary:hover { filter: brightness(1.05); }

.btn.picking {
  color: #fff;
  background: linear-gradient(180deg, #C57BEA 0%, var(--purple) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.40), 0 1px 2px rgba(0,0,0,.18);
}

.btn.tiny {
  display: inline-block;
  margin-left: auto;
  padding: 4px 11px;
  font-size: 11px;
  border-radius: var(--r-pill);
  background: var(--blue);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.32);
}
.btn.tiny:hover { background: var(--blue-lo); }

/* ------------------------------------------------------------------ *
 * Value pulled from a Zillow / Redfin tab
 * ------------------------------------------------------------------ */

.ext {
  margin-top: 8px;
  padding: 9px 10px;
  border-radius: var(--r-field);
  background: var(--fill);
  border: 0.5px solid transparent;
}
.ext.ok   { background: rgba(52,199,89,.11);  border-color: rgba(52,199,89,.30); }
.ext.warn { background: rgba(255,149,0,.12);  border-color: rgba(255,149,0,.32); }
.ext.bad  { background: var(--fill);          border-color: var(--separator); }

.ext-top { display: flex; align-items: center; gap: 7px; }
.ext-top b {
  font-size: 16px; font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
}
.ext-badge {
  font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em;
  padding: 3px 8px; border-radius: var(--r-pill); flex: none;
}
.ext-badge.ok   { background: rgba(52,199,89,.20);   color: var(--green-deep); }
.ext-badge.warn { background: rgba(255,149,0,.22);   color: var(--orange-deep); }
.ext-badge.bad  { background: var(--fill-strong);    color: var(--label-2); }
.ext-addr {
  font-size: 10.5px; color: var(--label-2); margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.lookup { display: flex; align-items: center; gap: 6px; margin-top: 7px; flex-wrap: wrap; }
.lookup-links { display: contents; }

/* The mini browser. Reads as an action rather than a link, because it opens
   a window rather than navigating away from the call. */
.btn.mini {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  font-size: 11px;
  border-radius: var(--r-pill);
  background: var(--fill-strong);
  color: var(--blue);
}
.btn.mini::before {
  content: "";
  width: 9px; height: 8px;
  border: 1.5px solid currentColor;
  border-top-width: 3px;
  border-radius: 2px;
  flex: none;
}
.btn.mini.on {
  background: linear-gradient(180deg, var(--blue-hi) 0%, var(--blue) 52%, var(--blue-lo) 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.40), 0 1px 2px rgba(0,0,0,.18);
}

.lookup a {
  font-size: 11px; font-weight: 600;
  color: var(--blue);
  text-decoration: none;
  background: var(--fill);
  padding: 4px 10px;
  border-radius: var(--r-pill);
  transition: background .15s;
}
.lookup a:hover { background: var(--fill-strong); }

/* ------------------------------------------------------------------ *
 * Disclosure sections
 * ------------------------------------------------------------------ */

details.adv {
  background: var(--card);
  border: 0.5px solid var(--hairline);
  border-radius: var(--r-card);
  margin-bottom: 10px;
  overflow: hidden;
}
details.adv > summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--label);
  display: flex; align-items: center; gap: 6px;
  user-select: none;
}
details.adv > summary::-webkit-details-marker { display: none; }
details.adv > summary::after {
  content: "›";
  margin-left: auto;
  color: var(--label-3);
  font-size: 16px;
  line-height: 1;
  transform: rotate(90deg);
  transition: transform .2s cubic-bezier(.32,.72,0,1);
}
details.adv[open] > summary::after { transform: rotate(-90deg); }
details.adv > summary:hover { background: var(--fill); }
details.adv > *:not(summary) { padding-left: 12px; padding-right: 12px; }
details.adv .foot { margin-top: 10px; }
details.adv > *:not(summary):last-child { padding-bottom: 12px; }
details.adv[open] > summary { border-bottom: 0.5px solid var(--separator); margin-bottom: 11px; }

/* ------------------------------------------------------------------ *
 * Standing assumptions
 * ------------------------------------------------------------------ */

.asm-note {
  margin-left: auto;
  margin-right: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--label-3);
  white-space: nowrap;
}

/* What the switches above actually charge. An output, not a control. */
/* --- Easy Qualifier -------------------------------------------------- *
   The output half of the panel, and the reason the tool exists. It gets the
   weight: the loan amount is set at display size against a quiet ground so
   an agent glancing over mid-sentence lands on it without hunting, and
   everything under it is deliberately smaller than the answer it explains.
   Sizes here run a little larger than the rest of the panel — this is the
   part that gets read out loud on a call. */
.eq {
  margin: 10px 0;
  padding: 15px 14px 14px;
  border-radius: var(--r-card);
  background: var(--card);
  border: 0.5px solid var(--hairline);
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.eq-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.eq-cap {
  flex: 1; min-width: 0;
  font-size: 10.5px; font-weight: 700;
  letter-spacing: .09em; text-transform: uppercase;
  color: var(--label-3);
}
.btn.tiny { padding: 5px 12px; font-size: 11.5px; width: auto; }
/* A secondary action sitting beside the answer. Solid blue there pulled the
   eye off the figure it is meant to be next to. */
.btn.quiet {
  background: var(--fill);
  color: var(--blue);
  box-shadow: none;
  border: none;
}
.btn.quiet:hover { background: var(--fill-strong); }

.eq-final {
  font-size: 38px; font-weight: 700;
  letter-spacing: -0.028em;
  font-variant-numeric: tabular-nums;
  line-height: 1.02;
  color: var(--green-deep);
}
.eq-final.none { color: var(--label-3); font-weight: 600; font-size: 30px; }
.eq-note { font-size: 12px; color: var(--label-2); margin-top: 5px; }

/* The loan is larger than the programme will write. Loud, because the two
   halves of this panel are disagreeing and the agent must not be the one
   who has to notice. */
.eq-over {
  margin-top: 10px; padding: 9px 11px;
  border-radius: var(--r-field);
  background: rgba(255,59,48,.12);
  color: var(--red-deep);
  font-size: 12px; line-height: 1.4;
}
.eq-over:empty { display: none; }

/* The working. A grouped inset list, the way the rest of the panel does
   lists, rather than a run of loose rows. */
.eq-rows {
  margin-top: 11px;
  border-radius: var(--r-field);
  background: var(--fill);
  padding: 3px 11px;
}
.eq-rg { border-bottom: 0.5px solid var(--separator); padding: 6px 0; }
.eq-rg:last-child { border-bottom: none; }
.eq-row {
  display: flex; align-items: baseline; gap: 10px;
  font-size: 12.5px;
  color: var(--label);
}
.eq-row span { flex: 1; min-width: 0; }
.eq-row b { font-weight: 600; font-variant-numeric: tabular-nums; }
.eq-row.gap { color: var(--orange-deep); }
.eq-row.sum { padding-top: 2px; }
.eq-row.total { font-weight: 700; color: var(--green-deep); }
.eq-row.total b { font-weight: 700; }
.eq-why {
  font-size: 10.5px; color: var(--label-3);
  margin-top: 2px; line-height: 1.35;
}

/* --- the rest of EQ's form ------------------------------------------- */
.eq-map { margin-top: 13px; }
/* The rule belongs to the field, not the row: a note is part of the field
   above it, and a border between the two read as text struck through. */
.eq-fg { border-bottom: 0.5px solid var(--separator); padding: 5px 0; }
.eq-fg:last-of-type { border-bottom: none; }
.eq-f {
  display: flex; align-items: baseline; gap: 10px;
  font-size: 12.5px;
}
.eq-fn { flex: 1; min-width: 0; color: var(--label-2); }
.eq-fn em { font-style: normal; color: var(--red); margin: 0 1px 0 2px; }
.eq-fv {
  font-weight: 600; color: var(--label);
  font-variant-numeric: tabular-nums;
  text-align: right; max-width: 60%;
  overflow-wrap: anywhere;
}
.eq-f.gap .eq-fv { color: var(--label-3); font-weight: 500; }
.eq-f.need .eq-fv { color: var(--orange-deep); }
.eq-fm {
  font-size: 10.5px; color: var(--label-3);
  margin-top: 2px; padding-left: 13px; line-height: 1.35;
}

/* A dot, not a badge. Seven pill-shaped labels down a fifteen-row list
   turned the sheet into something to decode instead of read, so the
   meaning moved to a legend that is stated once. */
.mk {
  display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  margin-right: 7px; vertical-align: 1px;
  background: var(--label-3);
}
.mk.calc { background: var(--green); }
.mk.asm  { background: var(--orange); }
.mk.chk {
  width: auto; height: auto; border-radius: 0; background: none;
  margin: 0 0 0 4px; vertical-align: baseline;
  font-style: normal; font-weight: 700; font-size: 11px;
  color: var(--label-3); cursor: help;
}
.eq-key {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  margin-top: 10px; padding-top: 9px;
  border-top: 0.5px solid var(--separator);
  font-size: 10.5px; color: var(--label-3);
}
.eq-key .mk { margin-right: 5px; }

/* --- debt-to-income --------------------------------------------------- */
.dti { margin-top: 14px; padding-top: 12px; border-top: 0.5px solid var(--separator); }
.dti-rows { margin-top: 9px; }
/* Sentence case, like every other label in this card. Only the card header
   is uppercase — three label idioms in one column was most of why the
   right-hand side read as complicated. */
.dti-cap {
  font-size: 11px; font-weight: 600;
  color: var(--label-2);
  margin-bottom: 4px;
}
.dti-row {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 9px;
}
.dti-row b {
  font-size: 27px; font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.dti-row b small { font-size: 15px; font-weight: 600; margin-left: 1px; }
.dti-row i {
  flex: 0 0 100%; order: 3;
  font-style: normal; font-size: 11px; color: var(--label-3);
  margin-top: 3px; line-height: 1.35;
}
.dti-pill {
  font-size: 10.5px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase;
  padding: 3px 9px; border-radius: var(--r-pill);
}
.dti-row.ok b { color: var(--green-deep); }
.dti-row.ok .dti-pill { background: rgba(52,199,89,.16); color: var(--green-deep); }
.dti-row.no b { color: var(--red-deep); }
.dti-row.no .dti-pill { background: rgba(255,59,48,.13); color: var(--red-deep); }
.dti-row.none b, .dti-row.idle b { color: var(--label-3); }
.dti-none { font-size: 12px; color: var(--label-3); padding: 4px 0; line-height: 1.4; }
.dti-warn { font-size: 11px; color: var(--label-3); margin-top: 8px; line-height: 1.4; }
.dti-warn.hot { color: var(--orange-deep); }

.eq-tax { display: block; margin: 13px 0 4px; }
.eq-tax span {
  display: block;
  font-size: 11px; font-weight: 600;
  color: var(--label-2);
  margin-bottom: 5px;
}
.eq-tax i {
  font-style: normal; font-weight: 500;
  text-transform: none; letter-spacing: 0; color: var(--label-3);
}
.eq-tax input { width: 100%; }

/* The all-in cost of closing, under the two headline figures. Sized to be
   read at a glance without competing with them. */
.costline {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 0.5px solid var(--separator);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.costline:empty { display: none; }
.costline b { display: block; font-size: 12.5px; font-weight: 600; color: var(--label); }
.costline span { display: block; margin-top: 2px; font-size: 10.5px; color: var(--label-3); }

.asm-fee {
  margin-top: 9px;
  padding: 8px 10px;
  border-radius: var(--r-field);
  background: var(--fill);
  font-size: 11.5px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  color: var(--label-2);
}
.asm-fee:empty { display: none; }
/* Paid at closing rather than financed: it comes out of the borrower's
   proceeds, so it is coloured like something that costs them. */
.asm-fee.out { background: rgba(255,149,0,.13); color: var(--orange-deep); }

details.asm .check:first-of-type { margin-top: 4px; }
details.asm .check span { flex: 1; min-width: 0; }

/* --- iOS switch --- */
.check {
  display: flex; align-items: center; gap: 10px;
  font-size: 12.5px;
  color: var(--label);
  padding: 7px 0;
  border-top: 0.5px solid var(--separator);
  cursor: pointer;
}
.check input {
  all: unset;
  flex: none;
  order: 2;
  margin-left: auto;
  position: relative;
  width: 40px; height: 24px;
  border-radius: var(--r-pill);
  background: var(--fill-strong);
  cursor: pointer;
  transition: background .22s cubic-bezier(.32,.72,0,1);
}
.check input::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.24), 0 0 0 0.5px rgba(0,0,0,.04);
  transition: transform .22s cubic-bezier(.32,.72,0,1);
}
.check input:checked { background: var(--green); }
.check input:checked::after { transform: translateX(16px); }
.check input:focus-visible { box-shadow: 0 0 0 3.5px rgba(0,122,255,.30); }

.disclaimer {
  margin-top: 4px;
  padding: 10px 2px 2px;
  font-size: 10px;
  line-height: 1.42;
  color: var(--label-3);
  text-align: center;
}
`;

/** Highlight box used by the picker, injected into the *host* page. */
export const PICKER_CSS = `
.__sam_pick_hl {
  position: absolute;
  z-index: 2147483646;
  pointer-events: none;
  border: 2px solid #AF52DE;
  background: rgba(175, 82, 222, .14);
  border-radius: 6px;
  box-shadow: 0 0 0 4px rgba(175, 82, 222, .16);
  transition: all .05s linear;
}
`;
