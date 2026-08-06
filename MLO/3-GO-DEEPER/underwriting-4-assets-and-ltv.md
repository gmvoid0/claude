# Assets, Reserves, and LTV

The "Capital" and "Collateral" Cs, in operational detail.

---

## What assets have to do

Three separate jobs:

1. **Cover the down payment**
2. **Cover closing costs and prepaids**
3. **Leave reserves** afterward

A borrower can have enough for the first two and fail on the third. That's the surprise
that kills jumbo files.

---

## Documentation

**Standard:** 2 months of statements, **all pages** — including the blank ones. Underwriting
requires the full document, and "page 3 of 5" gets returned every time.

**Retirement accounts:** most recent quarterly statement. Typically counted at a
discounted percentage, and only if genuinely accessible.

**What underwriting looks for:**
- Ending balances
- **Large or unusual deposits**
- NSF activity or overdrafts
- Undisclosed debts (recurring payments to a lender you haven't seen on the credit report)

That last one catches people. A $600/month payment leaving the account every month with no
matching tradeline generates a condition asking what it is.

---

## Sourcing and seasoning

### Seasoning

Funds sitting in the account **60+ days** are generally considered seasoned and don't
require sourcing.

**This is why the money-movement warning matters so much** — moving money resets the
paper trail and creates conditions.

### Sourcing

Any deposit that looks unusual relative to the borrower's income pattern will be
questioned.

| Source | Acceptable? | Documentation |
|---|---|---|
| Payroll | ✅ | Matches paystubs |
| Tax refund | ✅ | Return or IRS record |
| Asset sale | ✅ | Bill of sale, title transfer |
| **Gift** | ✅ | Gift letter + donor ability + transfer trail |
| Retirement withdrawal | ✅ | Statement showing withdrawal |
| Transfer between own accounts | ✅ | Statements for **both** accounts |
| Loan from family | ⚠️ | Counts as debt unless properly gifted |
| **Cash deposit** | ❌ | Generally unusable |

### The cash problem

**Undocumented cash cannot be used.** This devastates:
- Self-employed borrowers who deal in cash
- Tipped workers
- Anyone who has been "saving cash at home"

**Warn them early:**

> *"One thing that catches people out — if any of your down payment is cash you've been
> keeping at home, we can't use it. Underwriting can't source it. If that's part of the
> plan, get it into the bank now, because we need it seasoned for 60 days before it counts.
> The sooner it's deposited, the sooner it's usable."*

Telling someone this in week one instead of week three is a genuine service.

### Gift funds

Common and completely acceptable when papered correctly. Requires:

1. A **gift letter** — donor name, relationship, amount, property address, and an explicit
   statement that repayment is **not** expected
2. Evidence of the **donor's ability** to give (their bank statement)
3. A **paper trail** — the transfer out of the donor's account and into the borrower's

**FHA allows 100% of the down payment to be gifted.** Conventional allows gifts, with some
programs requiring a minimum borrower contribution at certain LTVs.

**The trap:** a "gift" that's actually a loan is occupancy-level fraud. If the donor
expects repayment, it must be disclosed as debt. Ask directly and don't coach the answer.

---

## Reserves

**Reserves** = liquid assets remaining **after** closing, expressed in months of PITI.

```
Reserves (months) = Liquid assets after closing ÷ Monthly PITI
```

### Typical requirements

| Scenario | Typical |
|---|---|
| Conventional, primary residence | 0–2 months |
| Second home | 2–6 months |
| Investment property | 6+ months |
| **Jumbo** | **6–12+ months** |
| Multiple financed properties | Escalating with each |

> `[Requirements vary substantially by program and lender overlay. Verify per file.]`

### Reserves are your best compensating factor

**This is the practical point.** A borrower with 12 months of reserves gets latitude on
DTI, credit, and employment history that a borrower with none never will.

**So ask about it, always:**

> *"After the down payment and closing costs, roughly what would you have left — savings,
> investments, retirement? I'm asking because reserves are one of the strongest things in
> a file. If DTI is tight, reserves are often what gets it approved."*

Most LOs never ask beyond "do you have enough to close." Asking about what's left over is
how you find the compensating factor that saves the deal.

---

## LTV and CLTV

```
LTV  = Loan ÷ Value
CLTV = All liens ÷ Value
```

**Value** = the **lesser** of appraised value or purchase price, on a purchase. On a
refinance, it's the appraised value.

That distinction matters: a borrower who negotiates a $380,000 purchase on a home that
appraises at $400,000 still has LTV calculated on $380,000. Their instant equity doesn't
reduce the down payment.

### The thresholds

| LTV | Significance |
|---|---|
| **78%** | Automatic PMI termination |
| **80%** | PMI cancellable on request; **conventional cash-out ceiling** |
| **85–90%** | Typical second-lien CLTV ceiling |
| **95%** | Conventional 5% down |
| **96.5%** | FHA maximum |
| **97%** | Conventional maximum |
| **100%** | VA and USDA |

### Maximum cash-out

```
Max loan = Value × 0.80
Cash out = Max loan − existing balance − closing costs
```

Worked examples for all four transcript borrowers in
`underwriting-5-math-in-your-head.md`.

### CLTV for second liens

```
CLTV = (First mortgage + second lien) ÷ Value
```

**Michael:** ($108,000 + $120,000) ÷ $550,000 = **41.5%** — exceptionally strong.
**Paula:** ($180,000 + $200,000) ÷ $950,000 = **40%** — exceptionally strong.

Both should have had excellent second-lien pricing and easy approval. Neither was told.

`product-6-second-liens-heloc.md`

---

## The appraisal

### What it establishes

Value, condition, and marketability. It's the number that determines LTV, which determines
pricing and eligibility.

### Appraiser independence

You **may not** attempt to influence value, suggest a target number, or select the
appraiser directly. This is federal law and violating it ends careers.

**You may** provide factual information — recent comparable sales, a list of improvements
— through the proper channel (usually the AMC or lender, not directly to the appraiser).

### Appraisal waivers

AUS sometimes grants an **appraisal waiver** (also called a PIW — property inspection
waiver) when the property and loan profile support it. Saves the borrower several hundred
dollars and about a week.

**Worth mentioning when you get one** — it's a tangible, immediate win.

### When value comes in low

In order of usefulness:

1. **Reconsideration of value (ROV)** with documented better comps — real, low success rate
2. **Increase down payment** to preserve LTV
3. **Reduce the loan amount**
4. **Renegotiate the price** (purchase only)
5. **Start over with a different lender** — borrower pays for a new appraisal

**Set expectations before it happens:**

> *"One thing neither of us controls is the appraisal — it's an independent third party by
> law, and I'm not permitted to influence it. Most come in where we expect. If it doesn't,
> here's what we'd do..."*

### Appraisal transfers

Appraisals can sometimes transfer between lenders. It's a real process, it requires
coordination, and **not every lender accepts a transfer**.

**Call 3 handled this badly** — asserting that the competitor would "try not to comply."
The honest version:

> *"Appraisals can transfer, though it takes coordination and not every lender takes one.
> Don't cancel anything on their side until we know my numbers actually beat theirs — I
> don't want you out an appraisal fee on a maybe."*

---

## Property types that complicate the file

| Type | Issue |
|---|---|
| **Condos** | Project must be warrantable — HOA finances, owner-occupancy ratio, litigation, single-entity ownership concentration |
| **Manufactured** | Permanent foundation required, HUD tags, limited lender pool |
| **Rural / acreage** | Hard comps; excess acreage may not be valued |
| **Mixed use** | Commercial portion creates eligibility problems |
| **Unique construction** | Log, dome, earth-sheltered — marketability concerns |
| **Poor condition** | FHA/VA minimum property standards |

**Ask about property type in discovery.** Discovering a non-warrantable condo at appraisal
is three wasted weeks and an angry realtor.

---

## What you must be able to do

- Explain sourcing and seasoning, and why cash is a problem
- Paper a gift correctly
- Calculate reserves and use them as a compensating factor
- Calculate LTV, CLTV, and maximum cash-out
- Explain appraiser independence and the low-value options
- Identify property types that need early attention

**Self-check:** Borrower is buying at $450,000 with 10% down. They have $52,000 in
checking — but $18,000 of it was deposited three weeks ago from "my dad." What's the
problem and what do you do?

> *Two problems. The $18,000 isn't seasoned (under 60 days) and it isn't sourced. If it's
> a gift, paper it properly — gift letter, proof of dad's ability to give, and the transfer
> trail from his account to theirs. If dad expects repayment, it's a loan and it counts as
> debt, which changes DTI. Ask directly and don't lead the answer. Also check what's left
> after closing: $45,000 down plus roughly $12,000 in costs leaves very little, so reserves
> could be tight. Better to find all of this out now than at week three.*

---

**Next:** `underwriting-6-aus-and-conditions.md`
