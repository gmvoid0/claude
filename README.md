# S.A.M

**Sales Assistance in Mortgages** — a Chrome/Edge extension that reads a
property value and lien balances off whatever page you're on and continuously
recomputes LTV, maximum loan amount and available cash-out for VA, FHA and
Conventional.

Built against a VICIdial agent screen with a separate AVM lookup panel, but
the detection is label-driven rather than site-specific, so it also works on
CRMs, LOS screens and listing pages.

```
╭──────────────────────────────────────────╮
│ ● S.A.M         RANDY D ROLLINS — TN     │
├──────────────────────────────────────────┤
│  Home value                       typed  │
│  ┌────────────────────────────────────┐  │
│  │ 400,000                            │  │
│  └────────────────────────────────────┘  │
│  Balance  270,900     Loan type  VA      │
├──────────────────────────────────────────┤
│                CASH OUT                  │
│               $120,681                   │
│         ABOVE $10,000 THRESHOLD          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░│                  │
│  Max loan                     $391,581   │
│  Gross equity                 $129,100   │
│  Current LTV                     67.7%   │
╰──────────────────────────────────────────╯
```

Everything above the Cash Out line is read off the page and recalculated on
every change; only the home value normally needs a human.

---

## Install

Not on the Chrome Web Store — load it unpacked.

1. `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select the `extension/` folder
4. Open the page you want it on, click the toolbar icon, tick **Run on this
   site**, then reload the tab once

The extension does nothing at all until you enable it for a specific site.

### Shortcuts

| Key | Action |
| --- | --- |
| `Alt+E` | collapse / expand the panel |
| `Alt+V` | jump to the home value box |

Drag the panel by its header; it remembers where you put it.

---

## How it reads a page

Four strategies, tried in order, per field:

1. **A field you bound by clicking.** The *Bind value* / *Bind balance*
   buttons let you click the exact element. Stored per page, survives
   reloads. This is the escape hatch when detection guesses wrong.
2. **The visible label.** `<label for>`, ARIA, the adjacent table cell, or
   the preceding text. Visible labels always outrank the `name` attribute,
   which matters on VICIdial because relabelled fields keep their original
   names — the box displayed as "Mortgage Balance" is really
   `vendor_lead_code`, and "Mortgage Payment" is really `address2`.
3. **Position on screen.** When nothing in the DOM relates a label to its
   field, the nearest text to the left (or directly above) is used. This is
   what handles absolutely-positioned agent screens and AVM cards that
   render `Zestimate®` above `$661,400` as two unrelated elements.
4. **Open shadow roots and iframes.** Panels injected by *other* extensions
   are usually mounted in a shadow root; the detector traverses into open
   ones. Fields inside iframes are read by the copy of the content script
   running in that frame and relayed up to the panel.

Only one field can win each slot, so "Mortgage Balance" and "Mortgage
Payment" can't both be read as the balance.

### Why it polls

Dialers load the next call by assigning straight to `input.value`. That
fires no `input` event and mutates no attribute, so a `MutationObserver`
alone silently misses it and you'd calculate the new caller against the
previous caller's numbers. Events and mutations are used as fast paths, and
a 400 ms poll is the backstop that makes the refresh actually reliable.
Tunable (or disableable) in settings.

When the record changes, anything you typed for the previous one is
cleared — carrying a stale home value into the next call is the worst
failure this tool could have.

---

## Pulling the value from Zillow

Click **Open in Zillow** on the panel and it opens the lead's address. When
that tab loads, the value and the property address come back to the panel
automatically.

```
Home value  [ 661,400 ]  pulled · Zillow Zestimate
┌──────────────────────────────────────────────┐
│ ZILLOW · MATCHED   $661,400                  │
│ 809 SE 37th St, Battle Ground, WA 98604      │
└──────────────────────────────────────────────┘
```

**It only fills itself in on an exact address match.** House number and
street must agree, and if both sides carry a ZIP those must agree too.
Anything less is shown as a suggestion with the address visible and a **Use**
button, for you to accept. The house next door does not match. A different
lead does not match.

That restraint is the whole point. On a call floor you may have several
property tabs open, and silently attaching the last one's value to whoever is
on the line would produce a confident, wrong cash-out number — worse than no
number at all.

### What this deliberately isn't

It reads a page **you have open**, in your own session, rendered normally —
the same thing any browser extension does. It does not fetch, crawl, or
request anything from Zillow in the background. That restraint is not
squeamishness:

- Zillow retired its public Zestimate API, so there is no sanctioned
  programmatic route left.
- Their terms of use prohibit automated access.
- It wouldn't work anyway. Background requests carry no real session and hit
  bot protection within minutes; at call-centre volume that means CAPTCHAs
  and then a blocked office IP.

Reading a tab you opened yourself has none of those problems and gets you the
same number.

Redfin works the same way. Turn the whole behaviour off in settings if you
don't want it.

## Interface

The panel is styled in an iOS idiom — translucent materials over a backdrop
blur, hairline separators, grouped inset lists, and a single accent colour,
with the classic Apple gloss used only on the title bar and the primary
action so it reads as depth rather than decoration. Light and dark are both
supported and follow the system setting.

The one constraint that overrides aesthetics: this sits on top of a working
dialer screen and gets read between sentences, so it stays dense and
high-contrast. Polish is not allowed to cost legibility.

## The rules it encodes

Defaults for a **cash-out refinance, owner-occupied, one unit**:

| Program | Max LTV | Texas | Upfront fee | Fee vs. cap |
| --- | --- | --- | --- | --- |
| VA | 100% | 80% | 2.15% funding fee (3.3% subsequent use) | inside the cap |
| FHA | 80% | 80% | 1.75% UFMIP | stacks on top |
| Conventional | 80% | 80% | — | — |
| USDA | n/a | n/a | — | cash-out not permitted |

**"Fee vs. cap"** is the part that's easy to get wrong. On VA the funding fee
is financed *within* the 100% ceiling, so the base loan is reduced to make
room for it — at a $400,000 value the base loan is $391,581 and the fee
$8,419, totalling $400,000. On FHA the 1.75% UFMIP sits *above* the 80% base
loan, so the total loan legitimately exceeds 80% of value. Both behaviours
are toggleable per program in settings.

The funding fee is waived for veterans receiving or eligible for VA
compensation for a service-connected disability — tick **VA funding fee
exempt** and the full 100% becomes available.

Every number in that table is editable in **Rules & settings**. Treat the
defaults as a starting point to check against your own matrix, not as
authority.

### Rule sources

These are the commonly published agency maximums. Verify against the primary
sources before relying on them, and against your investor overlays, which are
frequently tighter:

- VA — Lender's Handbook M26-7, and the current funding fee schedule
  (statutory, and it has changed several times)
- FHA — Single Family Housing Policy Handbook 4000.1. The cash-out cap
  dropped from 85% to 80% on 1 September 2019
- Conventional — Fannie Mae Selling Guide B2-1.3-03 / Freddie Mac equivalent
- Texas — Texas Constitution Article XVI §50(a)(6)

---

## Limitations

Read this part.

### It cannot invent a home value

Nothing on a dialer lead screen is an appraised value. The value has to come
from the AVM panel, another tab, or your fingers. If the panel shows
"Enter a home value", that's not a bug.

### A Zestimate is not an appraisal

This is the biggest real-world risk in the whole tool. Automated valuations
carry meaningful error, off-market homes worse than on-market, and the error
is largest exactly where it hurts — unusual properties, thin comps, rural
areas. At 100% VA LTV a few percent of valuation error is the entire
difference between a deal and a wasted appraisal fee.

The extension flags any value it read from an AVM and can apply a haircut
(set it in settings; 5% is a reasonable starting point) so screening happens
below the headline figure. It cannot tell you what the property will actually
appraise for. Nothing can.

### Reading another extension's panel is not guaranteed

If you'd rather keep using MOF Assistant than open Zillow directly, whether
its value can be read depends on how that extension renders its panel:

| How it renders | Readable? |
| --- | --- |
| Open shadow root | yes — tested |
| Plain DOM in the page | yes |
| Same-page iframe (incl. cross-origin) | yes, via the frame relay |
| **Closed** shadow root | **no** — deliberately sealed by its author |
| Separate popup window | no |
| `<canvas>` / WebGL | no |

The first three cover the overwhelming majority of injected panels. If it
turns out to be a closed shadow root or a separate window, use **Open in
Zillow** instead — that path doesn't depend on another extension at all.

### Detection breaks when pages change

It's reading a user interface, not an API. A layout change can move a field
out from under its label. The panel always shows which label each number came
from so a wrong read is visible rather than silent, and click-to-bind fixes
it in a couple of seconds — but this needs occasional attention, and a change
on their side can break it without warning.

### Garbage in, garbage out

Both source screenshots this was built from contained bad lead data: a
mortgage payment of `6.06`, and a loan type of `190` (an agent ID that
landed in the wrong column). The extension range-checks what it reads and
warns on implausible figures, but it cannot know that a plausible-looking
number is the wrong one.

### It is not underwriting

It models the LTV cap and the financed upfront fee. It does **not** model:

- DTI, credit score, residual income, reserves
- Seasoning and payment-history requirements
- VA entitlement, prior use, or county loan limits (you can enter a limit
  manually, but nothing is looked up)
- Occupancy, unit count, property type, condition
- Subordinate liens you don't know about — a HELOC missing from lead data
  will overstate available cash
- Investor overlays, which are usually tighter than agency maximums
- State and local rules beyond the Texas cap. Texas §50(a)(6) in particular
  carries more than an LTV limit — fee caps, timing requirements,
  once-per-year restrictions and homestead-only applicability, none of which
  are modelled

Output is an internal screening estimate. It is not a quote, an offer, a
pre-approval, or a commitment to lend, and it shouldn't be read to a customer
as one.

### Environment

- Chromium only (Chrome, Edge, Brave). Manifest V3. A Firefox port is
  mostly manifest changes but isn't done.
- If the dialer is inside Citrix, a VDI session, or a desktop application, a
  browser extension cannot see it at all — it only reads pages in the browser
  it's installed in.
- Managed corporate machines often block unpacked extensions by policy. That
  is an IT conversation, not a code change.

### Privacy

Everything runs locally. No lead data is stored or transmitted; the only
things saved are your settings, per-site field bindings, and which sites
you've enabled. The extension declares broad host permissions because it
can't know in advance which site you'll use it on, but it stays completely
inert on every site until you explicitly enable that site.

Zillow and Redfin are the one qualified exception, and it is narrow: once
you've enabled at least one site, those two are read for a home value and a
property address and nothing else, only on property pages, and the value is
held in memory rather than written to disk. Turn it off in settings and they
are treated like any other site.

---

## Development

```bash
npm install          # playwright, for the browser-based tests
npm test             # everything
npm run test:unit    # calculation + parsing + scoring, no browser needed
npm run test:dom     # detection against real DOM fixtures in Chromium
npm run icons        # regenerate the PNGs
```

95 tests. The DOM tests run against fixtures reproducing the real screens: a
VICIdial form with deliberately misleading `name` attributes, an
absolutely-positioned layout with no attributes at all, an AVM card in a
shadow root, and a Zillow property page carrying a list price, a rent
estimate and a tax figure as decoys around the Zestimate.

The address matcher is tested hardest in the direction that matters — that a
neighbouring house, a same-named street in another state, and an unrelated
lead all fail to match.

A separate group boots the real content script against the agent-screen
fixture with a stubbed `chrome.*`, which is the only way to catch faults that
need detection, merging and rendering to be wrong *together* — a value box
that keeps the previous caller's figure, or the panel harvesting its own
output back in as page data.

```
extension/
  manifest.json
  src/
    lib/
      money.js      currency + percent parsing and formatting
      rules.js      LTV matrix, fees, program/state normalization
      equity.js     the calculation engine — pure, no DOM
      detect.js     field detection: pure scoring + DOM harvesting
      selector.js   stable selectors for click-to-bind
      address.js    address normalization and match confidence
      valuation.js  reading a value off a Zillow / Redfin tab
      merge.js      resolving each field from competing sources
      constants.js  ids shared between the panel and the detector
      settings.js   chrome.storage wrapper
    content/        panel, picker, orchestrator, styles
    background/     frame relay + settings broadcast
    popup/ options/
test/
  fixtures/         HTML replicas of the real screens
tools/make-icons.py
```

`equity.js` and `detect.js`'s scoring half are deliberately free of any DOM
or `chrome.*` reference so they can be tested directly in Node. The
calculation engine is the part that has to be right, so it's the part with
the most tests — including a check that the maximum loan can never round
*above* the LTV ceiling.
