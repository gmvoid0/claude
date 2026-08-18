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
│    ADVERTISED    │      TAKE-HOME        │
│     $129,100     │      $112,085         │
│ before fees/costs│ less $8,419 + $8,596  │
│         ABOVE $10,000 THRESHOLD          │
│  Now 67.7%  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░│ Cap 100% │
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

1. **A field you bound by clicking.** The *Bind value*, *Bind balance* and
   *Bind name* buttons let you click the exact element. Stored per page,
   survives reloads, and outranks everything below. This is the escape hatch
   when detection guesses wrong — if your screen labels the borrower's name
   something this has never seen, bind it once and it is solved for that
   page.
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

### When Zillow asks you to prove you're human

Call floors share one office IP, so "Press & Hold to confirm you are a
human" is a normal morning rather than an edge case. That used to fail
invisibly: a background lookup tab landed on the verification page, found no
value, and closed itself on the timeout — the panel just never got a number
and never said why.

Now the page is recognised and **the tab is brought to the front**, the
auto-close is called off so it can't vanish mid-verification, and the panel
says what happened. Hold the button for two seconds and the value arrives
through the ordinary path. If the preview window is the one that hit the
check, it flags for attention instead of yanking focus off the dialer.

Nothing here solves or works around the check. It is a human verification;
this puts it in front of the human.

### The preview window

A small browser window beside the dialer showing the lead's address —
photos, beds and baths, tax history, the things you get asked about
mid-call. It opens on its own as soon as a record has an address, so the
property is on screen before you think to ask for it, and it follows each
new call without taking focus. Its value flows into the panel through the
same path as any other Zillow tab.

**Preview on Zillow** / **Close preview** on the panel controls it. Close it
and it stays closed — it will not reopen on the next call until you press
the button again, because shutting it once should be enough. Both the button
and the automatic opening can be turned off under Behaviour in settings.

It is a real browser window rather than a frame embedded in the panel, and
that is not a shortcut. Zillow sends `X-Frame-Options: DENY` specifically so
its pages cannot be embedded; the only way to put one inside the panel is to
strip that header off the response on its way into your browser. That is a
security control belonging to someone else, and removing it to extract data
is a different act from reading a page you have open. A popup window is the
same navigation you make by hand today, with nothing bypassed, and it looks
the same.

## Two figures, not one

The headline is a pair, because on a call they are two different sentences.

**Advertised** is the raw number: the LTV ceiling against the payoff, before
the upfront fee is carved out and before a single cost comes off. It is what
gets said out loud, and it is blue.

**Take-home** is what the borrower actually receives. It is green, and it is
the one the verdict pill and the red zone are judged on.

Showing only the first is how a floor over-promises. Showing only the second
is how it under-quotes against everyone else. Both, side by side, with a line
naming exactly what came out between them — and both turn red the moment the
deal stops being worth having, because a big blue number next to a red one
would read as "there's still something here" when there isn't.

## Closing costs

The gap between those two figures is a closing-cost estimate, itemised per
program rather than rolled into one percentage. A flat "2% of the loan" is
easy to write and wrong in both directions: most of these charges are flat,
so one percentage overstates a $700,000 refinance and understates a
$150,000 one.

```
Origination            $3,916    1% of the loan (VA cap)
Appraisal                $800    VA-assigned appraiser
Credit report             $75
Flood certification       $20
Lender's title policy  $1,566    0.4% of the loan
Title search / exam      $325
Settlement / closing     $650
Recording                $175
Prepaid interest       $1,068    15 days at 6.5%, rate assumed
                       ──────
                       $8,596    2.2% of the loan
```

Program differences that are actually knowable are modelled:

- **VA** takes a flat 1% origination and no separate underwriting fee — the
  veteran cannot be charged both — and its appraisal costs more because VA
  assigns the appraiser.
- **FHA and Conventional** charge underwriting separately at a lower
  origination.
- **Texas** §50(a)(6) caps chargeable fees at 2% of the loan. The appraisal,
  the survey and the state base title premium sit outside the cap, so only
  the rest is held to it.

Hover the take-home figure for the full itemisation; it also lands in **Copy
summary**.

Every line is editable in Settings, and you should edit them. The defaults
are national mid-range figures; title premiums and recording fees are set
per state and no default can know yours.

**Escrow and reserve deposits are deliberately excluded** — they depend on
the tax bill, the insurance premium and the closing date, none of which are
on a lead screen. The panel says so rather than leaving the omission silent,
because a cost quietly left out flatters the take-home figure, and that is
the one direction this tool must never be wrong in. Set a figure in Settings
if your shop has a standard one.

## Assumptions

Every switch that moves the cash-out figure is on the panel, under
**Assumptions**, and every one of them is a standing assumption: change it
mid-call and it applies to this record immediately and to every call after
it. The same switches live in Settings, and the two stay in step.

| On the panel | What it does |
| --- | --- |
| Finance the upfront fee | VA funding fee or FHA UFMIP into the loan, or paid at closing out of the proceeds |
| VA funding fee waived | Service-connected disability. Raises cash-out, so it is off unless you mean it |
| VA subsequent use | The 3.3% tier rather than 2.15% first use |
| Value is an estimate | Applies the AVM haircut to hand-typed values too |

Under them is a line saying what the current combination actually charges
and where it comes from — financed into the loan, or due at closing.

The numbers these pair with — **LTV override**, **loan limit**, **closing
costs**, the AVM haircut, the screening threshold — stay in Settings. They
are typed once for a shop rather than adjusted per borrower, and nothing
appears in both places: two copies of one switch is two places to disagree
about which one is live.

## Saving an application

**Save** does two things: it keeps the application in the browser, and it
downloads it as a one-page PDF.

The application comes first and carries the most weight on the page —
whoever this is handed to opens it to find out who the borrower is, not to
read the sales figures. Below it: the two cash-out figures as the panel
shows them, the full calculation, and the itemised closing costs, with the
flags and the disclaimer attached so a number never travels without the
caveat that produced it. It is named
`SAM-RANDY-D-ROLLINS-20260817-1654.pdf`, which sorts by date and says whose
it is.

The PDF is written by the extension itself, in about four hundred lines,
rather than by pulling a PDF library into every tab. It uses the two built-in
Helvetica faces every reader has had since 1993, so nothing is embedded and
the file lands around 8 KB. Text is measured with the real font metrics, so
wrapping and alignment are exact rather than approximate, and the content
streams are left uncompressed so the file can be read with `strings` when
somebody asks what is in it.

Save the draft from a previous call and it is costed against *that* record's
figures, not whoever is on the phone by the time you press the button.

## Interface

The panel is styled in an iOS idiom — translucent materials over a backdrop
blur, hairline separators, grouped inset lists, and a single accent colour,
with the classic Apple gloss used only on the title bar and the primary
action so it reads as depth rather than decoration. Light and dark are both
supported and follow the system setting.

The one constraint that overrides aesthetics: this sits on top of a working
dialer screen and gets read between sentences, so it stays dense and
high-contrast. Polish is not allowed to cost legibility.

The panel can be moved by its title bar and resized from its left and bottom
edges, or the corner between them — dragging outward widens both columns
together, and the size is remembered per browser profile. The **–** button collapses it to a
chip showing just the record on the line, and restores it exactly as it was.

## Listening to the call

**Currently switched off at the panel.** The recogniser and its number
parsing are still here and still tested, but nothing in the interface starts
them; this section describes what turning it back on gets you.

S.A.M can transcribe the call and turn what it hears into application fields.
It uses the browser's own speech recognition — free, no account, no key — and
on Chrome 139 or newer it requests **on-device** recognition, so neither the
audio nor the transcript leaves the machine. The panel shows which mode is
active.

Nothing it hears is ever written to the form by itself. Each reading appears
as a chip with the words it came from, and takes a click to accept.
Recognition mishears numbers often enough that a silent wrong entry would be
worse than no listening at all.

It reads spoken figures the way people actually say them:

| Heard | Understood as |
| --- | --- |
| "my score's like seven twenty" | FICO 720 |
| "I owe about two hundred thousand" | Balance $200,000 |
| "it's worth four fifty" | Value $450,000 |
| "six and a half" | Rate 6.5% |
| "I make ninety six thousand a year" | Income $96,000 |
| "thirty percent service connected" | Disability 30% — which also waives the VA funding fee |

A figure is only proposed if it is plausible for its field, so a rate of 6.5
never becomes a $6,500 balance and a "score" of 12 is discarded rather than
offered.

### What it hears, and the workaround

This is the honest limit of the free route. Browser speech recognition reads
the **default input device** — the agent's microphone. The customer's voice
arrives through the softphone and out of the speakers, so it is not in that
stream. Every turn is therefore attributed to the agent, which is exact
rather than guessed.

Three things make that far less limiting than it sounds:

1. **Agents restate figures anyway.** "So your balance is about two hundred
   thousand, and your score's around 720?" is ordinary confirmation
   technique, and a restated figure is a confirmed one — arguably better
   evidence than the customer's first mumbled version.
2. **A loopback input device captures both sides.** If the machine's default
   recording device is set to one that mixes system audio with the
   microphone — Stereo Mix on Windows, or a free virtual audio cable — the
   recogniser hears the customer too. Nothing in S.A.M needs changing; it
   reads whatever the default device carries. The trade is that both voices
   arrive on one stream, so turns are no longer separable by source.
3. **Everything is a proposal.** Accuracy matters less when a human confirms
   each figure with one click.

Capturing the customer's side with proper speaker separation needs the tab's
audio and a streaming transcription service, which costs money per minute and
sends customer speech to a third party. That path is deliberately not built.

## Linking to Salesforce

There are two ways to get an application from S.A.M into Salesforce. The
second is the better integration; the first is the one that works without
asking anybody's permission.

### What is built: filling the rendered form

S.A.M finds each field on the LO Mortgage Application by its **visible
label** and types into it, exactly as a person would. Open the application in
another tab, press **To Salesforce** in the drawer, and it fills what it can.

Setting `.value` on a Salesforce field is not enough, and this is the part
that catches most attempts. Lightning components keep their own copy of the
field state, so a value assigned directly leaves the component unaware — the
box looks filled and submits empty. Values therefore go in through the native
property setter with the `input` and `change` events the framework listens
for, `composed` so they cross the shadow boundary.

**Fills automatically:** First Name, Last Name, Loan FICO, Phone, Street,
City, State/Province, Zip, Borrower Income, Disability % — and the same again
for the co-borrower.

**Never touched:** Email, Middle Name, Suffix, Employer, Length of
Employment, Title, Borrower DOB, SSN, Marital Status, Disability Income,
Other Income, SSI. S.A.M never captured them, and a blank is honest where a
guess is not.

### The lookups, which are the hard part

Lead, Loan Officer, Transfer Agent and Loan Officer Assistant are not text
boxes. They store a **record id**, and the text shown is only a label for
whatever was picked. Typing a name into one and walking away leaves a field
that looks complete and holds nothing — worse than leaving it empty, because
nobody re-checks a filled-looking field.

So S.A.M does what a person does: types the name, waits for the result list,
and clicks the matching row.

It is strict about "matching" on purpose. Searching *Richard* on a real org
returns Richard Howell, Richard Sasko, Richard Warren, Richard Brownell and
Richard Mendoza. Taking the first is not matching, it is guessing, and a
guess here attaches an application to somebody else's file. The rule is:

> **Exactly one** result must match the whole search term. Zero matches, or
> more than one, and the field is left for you with the reason shown.

Where each search term comes from:

| Lookup | Search term | Set where |
| --- | --- | --- |
| **Lead** | the borrower's name on the panel | nothing to configure |
| **Loan Officer** | a standing default | Settings → Salesforce |
| **Transfer Agent** | a standing default | Settings → Salesforce |
| **Loan Officer Assistant** | a standing default | Settings → Salesforce |

Set the three in **Settings → Salesforce**, typed exactly as Salesforce shows
them. Use full names — a first name alone is precisely the case that comes
back ambiguous and gets skipped. A lookup with no default configured is not
attempted at all.

After a send, the drawer reports what was linked, what was not, and why:
*"no record matched that name"*, *"several records matched — pick one
yourself"*, and so on. Nothing is claimed that did not happen.

### The other route: the REST API

Cleaner, and out of reach without help. It needs a Connected App in your
Salesforce org, an OAuth flow, and the API names of the custom fields behind
that form — all of which need a Salesforce administrator. If you can get one,
that version writes records directly and never depends on a form's markup. Say
the word and it is a contained piece of work; the field mapping already exists
in `lib/salesforce.js`.

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
waived** and the full 100% becomes available.

Switching **Finance the upfront fee** off does not make the fee disappear:
it is due at closing, comes out of the proceeds, and is deducted from the
cash figure. On a $400,000 VA cash-out that is $8,600 — the difference
between the two arrangements is real money, and both are quoted honestly.

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

- Credit score, reserves, or anything about the borrower's file beyond what
  you type into the take-home section
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
