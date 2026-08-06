# Unit 5 — Pricing

How a rate is actually built, from the bond market down to the number you say out loud.
This unit is what separates people who *quote* rates from people who *understand* them.

---

## 1. The build-up — five layers

Every quoted rate is assembled in this order:

```
LAYER 1   Bond market sets base pricing for each rate/coupon
             ↓
LAYER 2   Lender adds margin, servicing value, operating costs  →  RATE SHEET
             ↓
LAYER 3   LLPAs adjust for this borrower's risk profile
             ↓
LAYER 4   Your compensation is accounted for
             ↓
LAYER 5   = The rate and cost you quote
```

You control none of Layer 1, none of Layer 2, and you *influence* Layer 3 only by how
you structure the file. Layer 4 is set by your company.

---

## 2. Reading a rate sheet

A rate sheet is a grid of **rate vs. price**. Price is a percentage of the loan amount.

**Example sheet — 30-year fixed, 30-day lock:**

| Rate | Price |
|---|---|
| 6.250 | 97.875 |
| 6.375 | 98.500 |
| 6.500 | 99.125 |
| 6.625 | 99.625 |
| **6.750** | **100.000** ← par |
| 6.875 | 100.375 |
| 7.000 | 100.875 |
| 7.125 | 101.250 |
| 7.250 | 101.750 |
| 7.500 | 102.375 |

### The three zones

| Price | Name | Meaning | Money flow |
|---|---|---|---|
| **> 100** | **Rebate / premium** | Higher rate than par | Lender pays OUT — covers comp and/or closing costs |
| **= 100** | **Par** | Neutral | Nothing paid, nothing received |
| **< 100** | **Discount** | Lower rate than par | Borrower pays IN — buying the rate down |

### Converting price to dollars

```
Dollars = loan amount × ((price − 100) ÷ 100)
```

On a $300,000 loan:

| Price | Math | Result |
|---|---|---|
| 101.750 | 300,000 × 1.75% | **$5,250 rebate** available |
| 100.000 | — | $0 — par |
| 98.500 | 300,000 × 1.50% | **$4,500 the borrower pays** |

### The rate/price trade — internalize this

**Rate up → price up → more money available.**
**Rate down → price down → borrower pays more.**

They're two sides of one dial. There is no free lunch: a lower rate is always paid for
by someone, and a "no cost" loan is always paid for with a higher rate.

---

## 3. LLPAs — the risk surcharges

**Loan-Level Price Adjustments** are add-ons set by Fannie and Freddie. They're expressed
in **price**, not rate — a "0.750 hit" means price gets 0.75 worse.

### The grid shape

LLPAs cross **FICO** against **LTV**. Illustrative shape (verify actual current grids
with your pricing engine — these move):

| FICO ↓ / LTV → | ≤60% | 60–70% | 70–75% | 75–80% | 80–85% | 85–90% | 90–95% |
|---|---|---|---|---|---|---|---|
| **740+** | 0.000 | 0.250 | 0.250 | 0.500 | 0.250 | 0.250 | 0.250 |
| **720–739** | 0.000 | 0.250 | 0.500 | 0.750 | 0.500 | 0.500 | 0.500 |
| **700–719** | 0.000 | 0.500 | 0.750 | 1.000 | 1.000 | 1.000 | 0.875 |
| **680–699** | 0.000 | 0.500 | 1.250 | 1.750 | 1.500 | 1.250 | 1.125 |
| **660–679** | 0.000 | 1.000 | 2.125 | 2.750 | 2.625 | 2.125 | 1.875 |
| **640–659** | 0.500 | 1.250 | 2.625 | 3.000 | 3.125 | 2.875 | 2.625 |
| **< 640** | 0.500 | 1.500 | 3.000 | 3.000 | 3.125 | 3.125 | 3.000 |

`[Illustrative structure only — pull live grids from your pricing engine.]`

**Read the shape, not the numbers.** Two lessons live in this table:

1. **The bottom-left is cheap, the middle-right is brutal.** Low FICO *with* high LTV is
   where pricing falls off a cliff.
2. **The jump from 680 to 660 at 75–80% LTV is enormous** — 1.750 to 2.750, a full point
   of cost. That's why the 20-point tiers matter so much.

### The other add-ons — these STACK on top

| Adjustment | Typical hit |
|---|---|
| **Cash-out refinance** | Significant — often the largest single non-FICO add |
| **Investment property** | Very large |
| **Second home** | Moderate |
| **2-unit** | Moderate · **3–4 unit** larger |
| **Condo above 75% LTV** | Moderate |
| **Manufactured home** | Large |
| **Subordinate financing present** | Moderate |
| **High-balance / super-conforming** | Moderate |
| **ARM** | Varies |

### Worked stacking example

$300,000 loan, base price at 7.000% = 100.875

| Item | Adjustment | Running price |
|---|---|---|
| Base at 7.000% | — | 100.875 |
| FICO 680 / LTV 80% | −1.750 | 99.125 |
| Cash-out | −0.750 | 98.375 |
| Condo > 75% LTV | −0.250 | **98.125** |

Final price 98.125 → the borrower pays **1.875 points = $5,625** — *or* the originator
goes up in rate until price returns to where it needs to be.

**This is why the same "7%" means completely different things to different borrowers.**

---

## 4. Where your compensation fits

Your comp is a **fixed percentage of the loan amount**, set by your company, identical on
every loan. Federal law (the LO Compensation Rule) prohibits it from varying by rate,
product, or anything except loan amount.

Two ways it gets paid:

### Lender-Paid Compensation (LPC)
The lender pays you out of the **rebate** built into the rate.

```
You need enough price above 100 to cover your comp.
Comp of 200 bps → you need price ≥ 102.000 (roughly, before other costs)
```
Borrower pays no origination fee to you; the cost lives in the rate.

### Borrower-Paid Compensation (BPC)
The borrower pays you directly at closing.

No rebate needed → you can quote a **lower rate**. Appears as an origination charge on
the Loan Estimate.

### Which is better — the rule

| Situation | Usually better | Why |
|---|---|---|
| Staying in the loan long-term | **BPC** | Lower rate pays off over years |
| Selling or refinancing in 2–3 years | **LPC** | Never recovers an upfront cost |
| Tight on cash to close | **LPC** | No check to write |
| Cash-out with plenty of proceeds | **BPC** often works | Cash is available |

**The question that decides it:** *how long will they keep this loan?*

---

## 5. Locks

A **rate lock** freezes the rate for a set number of days.

### Lock periods and cost

| Period | Relative cost |
|---|---|
| 15 days | Cheapest |
| **30 days** | Standard |
| 45 days | Slightly worse |
| 60 days | Worse |
| 90 days | Notably worse |

Longer lock = worse price. The lender is carrying market risk for you, and charging
for it.

### What you must know about locks

| Concept | Meaning |
|---|---|
| **Lock expiration** | The rate dies on this date. Closing must happen before it. |
| **Extension** | Buying more days when closing slips — costs price (often ~2–5 bps/day) |
| **Float** | Not locking; the borrower rides the market either direction |
| **Float-down** | An option (sometimes available, always costs something) to capture a lower rate if the market improves after locking |
| **Renegotiation** | Some lenders will improve a locked rate if the market moves a lot |
| **Worst-case pricing** | If a lock expires and you re-lock, many lenders give you the *worse* of the original or current market — the penalty for letting it lapse |

**Rule to live by:** never let a lock expire. Extensions cost money; worst-case pricing
costs much more.

### When to lock
- **Purchase with a contract date:** lock early. Certainty beats optimization.
- **Refinance with no deadline:** more discretion, but a borrower who floats and loses is
  a borrower who blames you.
- **Volatile market:** lock. Rate sheets can reprice multiple times in one day.

---

## 6. Intraday repricing

Rate sheets are published each morning. When the bond market moves enough during the day,
lenders issue a **reprice** — a mid-day revision.

- **Reprice for the worse** — the common one; the sheet gets more expensive
- **Reprice for the better** — happens, less often

In volatile stretches you can see two or three in a day. A quote given at 9am may not
exist at 3pm. This is real, verifiable urgency — and the reason quotes carry expiration.

---

## 7. The full worked quote — start to finish

**Scenario:** $420,000 purchase · 20% down ($336,000 loan) · 740 FICO · primary
residence · single-family · 30-year fixed · comp is LPC at 200 bps

```
STEP 1 — Base
  Rate sheet, 30-day lock, 7.000% = price 100.875

STEP 2 — LLPAs
  FICO 740 / LTV 80%           −0.500
  Primary residence             0.000
  Purchase (not cash-out)       0.000
  Single-family                 0.000
                       Total:  −0.500
  Adjusted price: 100.875 − 0.500 = 100.375

STEP 3 — Compensation
  LPC 200 bps requires 2.000 in rebate.
  At 7.000% we only have 0.375 above par. Not enough.
  Move up the sheet until rebate ≥ 2.000 + costs:

  7.500% → base 102.375 − 0.500 LLPA = 101.875   (1.875 rebate — close)
  7.625% → base 102.750 − 0.500 LLPA = 102.250   (2.250 rebate — works)

STEP 4 — Quote
  Rate 7.625%, lender-paid comp, no origination fee to the borrower.
  Rebate covers the 2.000 comp; the remaining 0.250 (~$840) offsets closing costs.

STEP 5 — Payment
  P&I = 336 × 6.99 ≈ $2,349
  + taxes (420,000 × 1.2% ÷ 12 = $420)
  + insurance ($150)
  = PITI ≈ $2,919
```

**Now the alternative — BPC:**
```
Borrower pays the 2.000 comp directly ($6,720 at closing)
No rebate needed → quote at or near par
Rate ≈ 6.875% → P&I = 336 × 6.57 ≈ $2,208
Monthly savings: $141
Break-even: 6,720 ÷ 141 ≈ 48 months
```

**The advisory answer:** staying more than 4 years → BPC. Less → LPC.

That comparison, run properly, is what product mastery looks like.

---

## 8. "No closing cost" loans — decoded

There is no such thing as free. The structure is:

```
Take a higher rate → generate a larger rebate → rebate pays the costs
```

| Option | Rate | Cash at closing | Monthly |
|---|---|---|---|
| Pay costs | 6.750% | $8,000 | $2,180 |
| No closing cost | 7.125% | $0 | $2,264 |

Costs $84/month to save $8,000 today. Break-even ≈ 95 months (~8 years).

**Short horizon → take the credit. Long horizon → pay the costs.** Same question as
always: *how long are they keeping it?*

---

## 9. APR vs. note rate

| | Note rate | APR |
|---|---|---|
| What it is | The actual interest rate | Rate + certain fees, expressed as a rate |
| Determines the payment | ✅ Yes | ❌ No |
| Used for comparison | Partially | That's its whole purpose |

APR is **always ≥ the note rate** (unless there are no finance charges at all). A big gap
between them signals heavy fees.

**Two things to know:**
- APR assumes the borrower keeps the loan the full term — misleading if they won't.
- Different lenders include fees slightly differently, so APR comparison is imperfect.
  **The Loan Estimate, page 2, section A, is the honest comparison.**

---

## 10. Why every lender's rate is similar (and why they still differ)

**Similar because:** they all sell into the same bond market, use the same GSE LLPA grids,
and face the same cost of capital.

**Different because:**

| Source of difference | Effect |
|---|---|
| **Overlays** | Stricter rules → some lenders won't touch a profile at all |
| Operating efficiency | Leaner lender can price sharper |
| Servicing valuation | Lenders who retain servicing may price better |
| Appetite | A lender wanting condo volume prices condos better |
| Niche specialization | Non-QM, VA, jumbo specialists beat generalists on their niche |
| Turn times | Not price, but real value on a deadline |

**This is the entire argument for the broker channel.** One lender says no; another says
yes at a good price — because the guideline is the same but the *overlay* isn't.

---

## Self-check

1. Price is 101.250 on a $400,000 loan. How many dollars, and to whom?
2. What does a "0.750 LLPA hit" actually change?
3. Borrower has 660 FICO at 80% LTV doing a cash-out on a condo. How many add-ons stack?
4. Explain LPC vs BPC and the one question that decides between them.
5. Why does a 60-day lock price worse than a 30-day lock?
6. A borrower says "the other guy quoted 6.5% and you said 7%." What are the first four
   things you check?

*(Answer to #6: their FICO tier, their LTV, the occupancy and purpose assumed in each
quote, and whether the 6.5% has discount points buried in it. Then compare Loan
Estimates, page 2, section A — not verbal quotes.)*

**Next: `06-product-cards.md`**
