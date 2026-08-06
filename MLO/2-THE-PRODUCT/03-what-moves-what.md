# Unit 4 — What Moves What

The correlation map. This is the unit that turns a list of formulas into actual
understanding — knowing that when *this* number moves, *those* numbers move with it,
and in which direction.

Master this and you can predict what a change does to a file before you run it.

---

## The master chain

Everything flows downhill in one direction. Memorize this shape:

```
BOND MARKET  ──►  BASE RATE  ──►  + LLPAs  ──►  + YOUR COMP  ──►  QUOTED RATE
                                     ▲
                                     │  driven by:
                        FICO · LTV · OCCUPANCY · PURPOSE
                        PRODUCT · PROPERTY TYPE · LOAN SIZE

QUOTED RATE  ──►  P&I  ──►  PITI  ──►  DTI  ──►  APPROVE / DECLINE
                             ▲
                             │  also fed by:
                    TAXES · INSURANCE · MI · HOA
```

Read it twice. Almost every question you'll ever get is somewhere on this chart.

---

## Part 1 — What moves the RATE

### Layer 1: the market (nobody at your company controls this)

| Input | Direction | Why |
|---|---|---|
| **Inflation ↑** | **Rates ↑** | Investors demand more yield when dollars are losing value. **The #1 driver.** |
| **10-year Treasury ↑** | **Rates ↑** | Mortgage rates track it with a spread on top |
| **Strong jobs report** | **Rates ↑** | Strong economy → inflation fear |
| **Recession fear / crisis** | **Rates ↓** | "Flight to safety" — investors buy bonds |
| **Fed buying MBS** | **Rates ↓** | Huge new buyer = higher bond prices = lower yields |
| **Fed cutting rates** | **either** | Indirect only. Can push mortgage rates UP if read as inflationary. |
| **Spread widening** | **Rates ↑** | Volatility makes investors demand more over Treasuries |

**The single most misunderstood relationship in the business:**

> **Bond PRICE up → bond YIELD down → mortgage RATES down.**
> Price and yield move in **opposite** directions. Always.

### Layer 2: the borrower (this is where you have influence)

These are the **LLPAs** — risk surcharges. Each one worsens *price*, which shows up as
either a higher rate or more cost.

| Factor | Direction | Roughly how much |
|---|---|---|
| **FICO ↓** | Rate ↑ | The biggest single lever. Priced in ~20-point tiers. |
| **LTV ↑** | Rate ↑ | More leverage = more risk |
| **Cash-out** (vs rate-and-term) | Rate ↑ | Meaningful add-on |
| **Investment property** | Rate ↑↑ | The largest occupancy hit |
| **Second home** | Rate ↑ | Moderate |
| **2–4 units** | Rate ↑ | |
| **Condo** (esp. >75% LTV) | Rate ↑ | |
| **Manufactured home** | Rate ↑ | |
| **Subordinate financing present** | Rate ↑ | A second behind your first |
| **Very small loan** | Rate ↑ | Fixed costs spread over less money |
| **ARM instead of fixed** | **Rate ↓** | Lender carries less long-term risk |
| **Shorter term (15-yr)** | **Rate ↓** | Less duration risk |
| **Buying points** | **Rate ↓** | Paying cash for a lower rate |
| **Taking lender credit** | Rate ↑ | The reverse trade |

### The compounding trap — LLPAs STACK

This is the most important insight in the unit.

**Borrower A:** 780 FICO · 60% LTV · primary · rate-and-term → almost no add-ons → best price

**Borrower B:** 660 FICO · 80% LTV · investment property · cash-out → **four separate
add-ons at once**, each one compounding on the others.

Borrower B isn't a little worse. Borrower B can be **1.5–2.5% higher in rate**, or
several points in cost. That is why "what's your rate?" is unanswerable without those
four data points — it's not evasion, it's arithmetic.

**MEMORIZE the four questions that determine a rate:**
```
1. What's your credit score?
2. How much equity / down payment?
3. Is it your primary home, second home, or a rental?
4. Purchase, rate-and-term refi, or cash-out?
```

---

## Part 2 — What FICO moves

FICO is the highest-leverage number on the file. Everything below moves when it moves.

```
FICO ↑  ──►  better LLPA tier   ──►  lower rate  ──►  lower payment  ──►  lower DTI
        ──►  cheaper MI          ──►  lower payment ──►  lower DTI
        ──►  more programs open  ──►  more options
        ──►  higher max LTV      ──►  less down payment needed
        ──►  higher max DTI allowed by AUS
```

One number improves and **five things get better simultaneously.**

### The tiers — MEMORIZE

| FICO | What it opens |
|---|---|
| **760+** | Best pricing available anywhere |
| 740–759 | Excellent |
| 720–739 | Very good |
| 700–719 | Good |
| **680–699** | Pricing starts to bite |
| 660–679 | Acceptable, costs real money |
| 640–659 | Limited options |
| **620** | Conventional floor |
| **580** | FHA floor at 3.5% down |
| **500** | FHA absolute floor — but needs **10% down** and almost no lender will do it |

### The 20-point rule

**Pricing breaks in ~20-point bands.** A 698 and a 702 are in different buckets, and on
a $300,000 loan that gap can be worth thousands of dollars.

**Therefore:** whenever a borrower is within a few points of a boundary (698, 718, 738,
758), check whether paying down a credit card gets them across. A **rapid rescore** can
update the bureaus in days. This is one of the highest-value things you can do for
someone — and most originators never check.

### What moves FICO, and how fast

| Action | Effect | Speed |
|---|---|---|
| Pay revolving balances below 30% utilization | ↑↑ often 20–40 pts | **Next reporting cycle (~30 days), or days with rapid rescore** |
| Pay a card to a small balance (not zero) | ↑ slight | Same |
| **Close an old card** | **↓** | Immediate — shortens history, cuts available credit |
| New credit inquiry | ↓ small | Immediate |
| New account opened | ↓ | Immediate |
| 30-day late | ↓↓↓ | Immediate, lingers years |
| **30-day MORTGAGE late** | ↓↓↓ + program disqualification | Immediate |
| Collection paid | varies | Can even drop the score on some models |
| Time passing with clean payments | ↑ | Slow and steady |

**Counterintuitive one to remember:** closing a credit card usually *hurts*. Borrowers do
it thinking it helps.

---

## Part 3 — What LTV moves

```
LTV ↓  ──►  better LLPA tier      ──►  lower rate
       ──►  MI removed at 80%      ──►  lower payment ──►  lower DTI
       ──►  more programs eligible
       ──►  bigger cushion for the lender ──► more flexibility elsewhere
```

### The three ways LTV changes

1. **Larger down payment** (purchase) — borrower controls
2. **Higher appraised value** — nobody controls; independent by law
3. **Time + principal paydown + appreciation** (existing loan) — this is why PMI
   eventually drops off

### The PMI removal cascade — worth real money

A borrower who bought 3–4 years ago with 5% down, in a market that appreciated, is very
likely under 80% LTV **right now** and still paying PMI they no longer owe.

```
appreciation ──► LTV drops below 80% ──► PMI cancellable on request
                                     ──► payment drops $100–$300/mo
                                     ──► DTI improves
```

Checking this costs nothing and saves them real money.

---

## Part 4 — What moves DTI

DTI is the gate on approval. Two levers: the top of the fraction and the bottom.

```
DTI = total monthly debt ÷ gross monthly income
```

### Everything that pushes DTI UP (worse)

| Change | Why |
|---|---|
| Rate ↑ | Bigger P&I |
| Loan amount ↑ | Bigger P&I |
| **Property taxes ↑** | Bigger PITI — and this is why the *same* borrower qualifies for less house in a high-tax state |
| **Insurance ↑** | Bigger PITI — a live problem in FL, CA, coastal |
| MI added | Bigger PITI |
| HOA dues | Counts in full |
| **New car loan** | **The #1 deal-killer mid-process** |
| New credit card balance | Minimum payment counts |
| Co-signed debt | Counts against them unless 12 months of someone else paying is documented |
| Shorter term (15-yr) | Much bigger payment |

### Everything that pulls DTI DOWN (better)

| Change | Why |
|---|---|
| Rate ↓ | Smaller P&I |
| Larger down payment | Smaller loan + maybe no MI |
| **Paying off a small debt entirely** | ⭐ Often the single best move — see below |
| Longer term (30 vs 15) | Smaller payment |
| **Grossing up non-taxable income** | +25% on that portion |
| Adding a co-borrower with income | More income |
| Documenting bonus/overtime history | More usable income |
| Rental income counted | +75% of gross rent |
| Buying down the rate | Smaller P&I |
| Removing MI | Smaller PITI |

### ⭐ The highest-leverage DTI move

**Paying off a small debt with a big monthly payment.**

Underwriting counts the *monthly payment*, not the balance. A car loan with $3,000 left
but $520/month counts as **$520/month of debt**. Pay it off and DTI drops immediately.

```
Income $6,000 · debts $3,225 → DTI 53.75%   ✗
Pay off the $520 car ($3,000 balance)
Income $6,000 · debts $2,705 → DTI 45.1%    ✓ approvable
```

**$3,000 changed the answer from no to yes.** Always scan the credit report for
high-payment / low-balance debts.

---

## Part 5 — The domino chains

These are the sequences worth being able to recite.

### Chain 1: FICO drops 20 points mid-process
```
FICO 720 → 698
  → crosses an LLPA tier boundary
  → price worsens
  → rate goes up (say +0.25%)
  → P&I rises ~$50/mo on $300k
  → PITI rises
  → DTI rises
  → possibly re-run AUS
  → possibly a new approval condition, or a decline
```
**One number, six consequences.** This is why the "don't open new credit" rule exists.

### Chain 2: Borrower buys a car in week three
```
New $520/mo payment
  → DTI jumps ~8 points
  → blows the max DTI
  → approval invalidated
  → options: unwind the car, reduce loan amount, add a co-borrower, or dead
Plus: the hard inquiry and new account drop the FICO
  → possibly worse pricing on top
```
This is the most common way a live file dies.

### Chain 3: Appraisal comes in low on a purchase
```
Value $340k instead of expected $360k
  → LTV rises (loan unchanged, value smaller)
  → may cross above 80% → MI now required → payment ↑ → DTI ↑
  → may cross an LLPA boundary → rate ↑
  → may exceed program max LTV → ineligible
Options: more down payment · smaller loan · renegotiate price · ROV · new lender
```

### Chain 4: Homeowners insurance quote comes in double
```
Insurance $1,800 → $4,200/yr
  → escrow portion +$200/mo
  → PITI +$200
  → DTI up ~3 points
  → possibly over the limit
```
Live issue in Florida, coastal, and wildfire markets. **Ask about insurance early.**

### Chain 5: Rates drop 0.5% market-wide
```
Rate 7.0% → 6.5%
  → P&I on $300k falls from $1,995 to $1,896 (−$99/mo)
  → DTI improves → some previously-declined borrowers now qualify
  → more buyers enter the market → more competition for houses
  → refinances become viable for anyone above ~7%
```

### Chain 6: Borrower switches from primary to investment occupancy
```
Occupancy change
  → large LLPA hit → rate ↑ substantially
  → minimum down payment jumps (3–5% → 15–25%)
  → reserve requirement appears (often 6 months)
  → BUT rental income may now count (+75% of gross rent) → DTI could improve
```
The only one on this list where a "worse" change can help one number while hurting others.

---

## Part 6 — Inverse relationships to memorize

These pairs move in **opposite** directions. Getting one backwards is a classic beginner
error.

| When this goes UP | This goes DOWN |
|---|---|
| Bond price | Bond yield (and mortgage rates) |
| Rate | Price on the rate sheet (for a given loan) |
| Down payment | LTV, and often MI |
| Loan term (15→30) | Monthly payment (but total interest rises) |
| FICO | Rate, MI cost |
| Points paid | Rate |
| Lender credit taken | (rate goes UP — you're being paid to accept it) |
| Income | DTI |
| Home value | LTV |

---

## Part 7 — The independence rules

Equally important: knowing what does **NOT** affect what.

| This does NOT affect | That |
|---|---|
| Your compensation | The rate or product chosen (federally prohibited — it's a fixed % of loan amount) |
| The Fed's rate decision | Your borrower's mortgage rate, directly |
| Paying off a collection | Necessarily the FICO score (can even drop it) |
| A pre-qualification | Anything binding |
| The borrower's opinion of value | The appraisal |
| Loan amount | Your comp *percentage* (only the dollars change) |
| Rate | Total monthly payment alone — taxes/insurance/MI often matter more |

---

## Part 8 — The reflex table

Given a change, name the consequence instantly. Cover the right column and drill.

| Change | Immediate consequence |
|---|---|
| FICO −20 across a tier | Rate ↑, MI ↑, payment ↑, DTI ↑ |
| Down payment +5% | LTV ↓, maybe MI gone, rate ↓, payment ↓ |
| Cash-out instead of rate-and-term | Rate ↑, max LTV drops to 80% |
| Primary → investment | Rate ↑↑, down ↑↑, reserves required, rent may count |
| 30-yr → 15-yr | Rate ↓, **payment ↑ a lot**, total interest ↓↓ |
| Add a $500/mo car payment | DTI ↑ ~8 pts on a $6k income |
| Pay off a $500/mo debt | DTI ↓ ~8 pts |
| Appraisal comes in low | LTV ↑, maybe MI, maybe ineligible |
| Buy 1 point | Rate ↓ ~0.25%, cost = 1% of loan |
| Take a lender credit | Rate ↑, closing costs covered |
| Non-taxable income identified | Qualifying income ↑ 25% on that piece |
| Add a co-borrower with income | DTI ↓ — **but the lower middle FICO now governs** |
| Property taxes higher than estimated | PITI ↑, DTI ↑ |
| Second lien added behind the first | CLTV ↑, first-lien pricing may worsen |

That last one about co-borrowers catches people constantly: **adding someone with good
income but bad credit can improve DTI while destroying pricing.** Both effects are real
and you have to weigh them.

---

## Self-check

1. What are the four questions that determine a rate, and why those four?
2. Bond prices rise. What happens to mortgage rates, and why?
3. A borrower is at 704 FICO. Why might you care about getting to 720?
4. Name the highest-leverage way to fix a DTI that's 2 points too high.
5. Walk the full chain from "borrower buys a boat in week two" to "file dies."
6. Why can adding a co-borrower hurt a file?

**Next: `04-pricing.md`**
