# S.A.M — handoff

Everything a fresh Claude session needs to pick this up. Read this first;
it is faster than reading the code, and it records decisions the code
cannot explain on its own.

---

## What it is

A Chrome/Edge MV3 extension for a mortgage sales floor running VICIdial.
It reads the dialer screen, takes the application while the agent talks,
and produces **the loan amount to type into UWM's Easy Qualifier**. EQ
hands back a payment; that payment comes back into the panel and says
whether the borrower can carry it.

It started as an equity calculator. It is not one any more — that pivot
matters, because the equity figures are still on the panel and are no
longer the point.

## The method, exactly as the floor runs it

Six lines, added, then grossed up:

| Line | Where it comes from |
| --- | --- |
| Escrows | Zillow's most recent property tax + $1,000 insurance, ÷ 2 (six months) |
| Title | $1,500 |
| Mortgage payoff | the application |
| Cash out | the application |
| Appraisal | $700 — waived on a VA IRRRL, which reuses the valuation |
| Underwriting | $2,000 |
| **Gross-up** | **the total × 1.035** |

Worked example: 1,366.50 + 1,500 + 270,900 + 96,000 + 700 + 2,000 =
372,466.50 × 1.035 = **$385,503**.

The panel shows the **monthly** escrow ($228) and uses **six months** of it
in the loan amount. The escrow figure is also the field — typing over it
overrides the Zillow reading, which is the only way to rescue a property
whose tax history cannot be read.

Every constant is a setting (`rules.sizing`). There is **one** set of fee
numbers in the tool: the take-home figure and the loan amount are built
from the same four charges, deliberately, because two models on one panel
disagreed in front of borrowers.

## Front-end DTI only

`PITI ÷ gross monthly income`, against VA 35, FHA 35, CONV 32, USDA 29
(`rules.dti`, all editable). Back-end was removed on instruction. A ratio
landing exactly on its limit passes, and the comparison is made on the
rounded percentage, so the figure shown is the figure that decided.

## Standing assumptions

Occupancy = Primary Residence. Property type = Single family residence.
VA Use Type = **Subsequent use**, which is worth 1.15 points of funding fee
(2.15% first use vs 3.30% after) and is therefore also the default for the
equity figures — a mismatch between the panel and EQ is thousands of
dollars in the flattering direction.

A VA disability rating does **not** waive the funding fee automatically.
That rule existed and was removed on instruction: a rating is not by itself
an exemption. The waiver is a switch in Settings.

## The bug that took four attempts

"The escrow only works 10% of the time." Four separate causes, all real:

1. Zillow nests the property object as a **JSON string** under
   `gdpClientCache`, so on the live page every quote is backslashed —
   `\"taxPaid\"`. A pattern for `"taxPaid"` matched the tidy shape a
   fixture is written in and nothing in production. The home value had the
   same bug; the rendered DOM was quietly carrying it.
2. The script scan was capped at 400,000 characters, under half of
   Zillow's payload, and the tax history sits near the end of it.
3. The reporter keyed a reading on **value + address only**. The value is
   readable immediately, the tax arrives later — so the first report went
   out with no tax and every later one was discarded as a duplicate.
4. **Zillow mounts the tax table on scroll.** On an unscrolled page it is
   not in the document at all. `revealTaxHistory()` scrolls the page,
   checks after each step, and restores the scroll position.

The lesson worth carrying: a fixture written in the tidy shape passed while
production failed. `test/fixtures/zillow-payload-tax.html` and
`zillow-lazy-tax.html` now reproduce the real shapes.

## Layout rules the panel follows

- **Uppercase means card heading and nothing else.** Every input and result
  label is sentence case at one size. Three label idioms in one column was
  what made the right side read as complicated.
- **One tinted surface, and it is the answer.** The loan-amount card is
  green; the equity card is neutral. A warning keeps its coloured ground.
- **A figure that has not arrived is a quiet bar**, not an em dash — at
  42px a dash reads as an error rather than a wait.
- **Seven fields carry a darker ground** on the application: full name,
  balance, FICO, cash-out, value, income (or SSI + pension), loan type.
- Picking **Retired** swaps the income box for **SSI** and **Pension**,
  which add up to one figure for the ratio.

## Traps

- `extension/src/content/styles.js` is **one template literal**. A backtick
  anywhere in it — including in a comment — ends it and the panel stops
  mounting entirely. There is a test.
- `input[type=text] { width: 100% }` is an attribute selector and outranks
  a single class. New input styles need two classes or they silently lose
  their width.
- `node_modules` is wiped by container restarts in this environment. Run
  `npm install` before trusting a green run — the browser tests **skip**
  rather than fail when Playwright is missing, so 250 passing can mean 70
  never ran.
- Unknown is never zero. A blank cash-out is not a rate-and-term
  refinance; blank income is not an income of nothing.

## Running it

```
npm install          # do this first, every time
npm test             # 325 tests, 0 should skip
```

Package for the browser:

```
cd extension && zip -r ../sam-extension.zip .
```

Then `chrome://extensions` → Developer mode → Load unpacked.

## What is built but not on the panel

`lib/eq-fields.js` builds the whole Easy Qualifier field list under EQ's own
names. It was removed from the panel on instruction and still goes on the
clipboard with Copy. `lib/salesforce.js` and `content/lookup.js` are a
complete Salesforce handoff, dormant and still tested.

## The one open item

**Easy Qualifier's dropdown wording is unconfirmed.** Only Loan Type came
back from a live capture (`0` Conventional, `1` Conventional ARM, `2` FHA,
`3` FHA ARM, `4` VA, `6` VA ARM, `5` USDA — note VA is 4 and VA ARM is 6,
so they are not in listed order). Occupancy, Property Type, Loan Purpose,
Refinance Purpose and VA Use Type are set to the strings believed correct
but never seen.

`tools/eq-probe.js` fixes this in about thirty seconds: the agent pastes it
into the console on EQ and presses **Read all dropdown lists**. See
`docs/EQ-Mapping-Steps.md`. `docs/EQ-Structure.md` records everything the
first capture taught us, including the ids that change with the programme
(`LoanTermIds` ⇄ `LoanTermIds40`, `MonthlyIncome` ⇄ `MonthlyIncomeOptional`).
