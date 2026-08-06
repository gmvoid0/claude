# Second Liens, HELOCs, and HELOANs

**The defining product of the 2026 market.** If you master one product document in this
system, make it this one.

It is also the product that was never mentioned in any of the four transcripts, across
roughly **$1.5 million** of combined borrower equity sitting behind legacy-rate first
mortgages.

---

## The problem this solves

**The situation:** a homeowner has a mortgage at 2.5%–4%. They need cash. The market is
~6.8%.

**The wrong answer** — cash-out refinance:
- Pays off the existing first mortgage
- Creates a new, larger loan at today's rate
- **The low rate is destroyed on the entire balance**

**The right answer, usually** — a second lien:
- Leaves the first mortgage **completely untouched**
- Adds a new, smaller loan behind it
- **Market rate applies only to the new money**

---

## The math that makes it obvious

Michael from Call 1: $108,000 balance at **3.1%**, wants **$120,000**.

### Option A — Cash-out refinance

| | |
|---|---|
| New loan | $228,000 |
| Rate | ~7% (all of it) |
| The 3.1% | **Gone** |
| P&I (30-yr) | ~$1,517 |

### Option B — Keep the first, add a second

| | |
|---|---|
| First mortgage | $108,000 @ **3.1% — untouched** |
| Second lien | $120,000 @ ~9% (seconds price above firsts) |
| First P&I | ~$538 (unchanged) |
| Second P&I (20-yr) | ~$1,080 |
| **Combined** | **~$1,618** |

> `[Illustrative. Second-lien pricing varies widely by lender, CLTV, FICO, and term. Run
> real numbers in your pricing engine.]`

### Read the comparison carefully

The monthly payment on Option B is **higher** — about $100 more. A naive comparison says
the refinance wins.

**But look at what's actually happening.** Under Option A, the borrower is paying ~7% on
the **entire** $228,000, including the $108,000 that was previously costing 3.1%. He's
paying an extra ~4 percentage points on money he'd already borrowed cheaply.

Under Option B, he pays a higher rate **only on the $120,000 that's actually new**.

**And critically:** Option B's second lien can be paid off, refinanced, or consolidated
later. Option A's destruction of the 3.1% is **permanent and irreversible**. That rate
does not come back.

### The correct framing on a call

> *"The refi payment is actually a little lower. But here's what it costs you: you'd be
> paying seven percent on the hundred and eight thousand you already borrowed at three
> point one. That's about $4,000 a year in extra interest on money you'd already financed
> cheaply — every year, for thirty years. The second costs you a bit more monthly, but
> your three-one stays alive on that balance forever. And when rates come down, we can
> consolidate. If we blow up the three-one today, it's never coming back."*

---

## The product types

### HELOAN — Home Equity Loan (fixed second)

| | |
|---|---|
| Structure | Lump sum, fixed rate, fixed payment |
| Term | Typically 10–30 years |
| Best for | A **known, one-time** amount |
| Advantage | Predictable payment, rate certainty |
| Disadvantage | Take it all at once; interest on the full balance from day one |

**Use for:** debt consolidation, a defined renovation, a business injection, a specific
purchase.

### HELOC — Home Equity Line of Credit

| | |
|---|---|
| Structure | Revolving line, like a credit card secured by the house |
| Rate | **Variable** — usually prime + margin |
| Draw period | Typically 10 years, often interest-only |
| Repayment period | Typically 10–20 years after |
| Best for | **Unknown or ongoing** needs |
| Advantage | Only pay interest on what you draw; reusable |
| Disadvantage | **Payment moves with rates.** Payment shock at the end of the draw period. |

**Use for:** ongoing renovations, business working capital, an emergency reserve, bridging
a purchase.

### Choosing between them

> *"Two flavors. A fixed second is a lump sum with a payment that never changes — best
> when you know the number. A HELOC is a line you draw on as you need it, but the rate
> floats, so the payment moves. Do you need a specific amount right now, or access to
> money over time?"*

**The honest caveat on HELOCs, which most LOs skip:**

> *"One thing about a HELOC I want you to hear. For the first ten years a lot of them are
> interest-only, so the payment is low and comfortable. Then it converts and you're
> repaying principal, and the payment can jump substantially. People get caught by that.
> If you're not going to pay it down inside the draw period, the fixed second is safer."*

---

## The mechanics

### CLTV — the governing number

Second liens are underwritten on **Combined Loan to Value**:

```
CLTV = (first mortgage + second lien) ÷ home value
```

**Typical maximums** (varies substantially by lender, FICO, and occupancy):

| Profile | Typical max CLTV |
|---|---|
| Strong credit, primary residence | 85–90%, occasionally higher |
| Moderate credit | 80–85% |
| Investment property | 70–75% |

### Michael's CLTV

```
($108,000 + $120,000) ÷ $550,000 = 41.5%
```

**Extremely low.** He's a lender's ideal second-lien borrower and should have excellent
pricing and easy approval. Nobody told him that.

### Paula's CLTV

```
($180,000 + $200,000) ÷ $950,000 = 40%
```

Also excellent. Also never mentioned.

### Why seconds price higher than firsts

The second lien is **subordinate** — in a foreclosure, the first lien is paid in full
before the second sees a dollar. More risk, more rate.

Expect seconds to run meaningfully above first-mortgage rates. Even so, the blended cost
is usually far better than destroying a legacy first.

---

## When a cash-out refi IS the right answer

Don't become dogmatic. The second lien is usually right, not always.

| Cash-out refi wins when | Why |
|---|---|
| Current rate is **near or above** market | Nothing to protect |
| Borrower needs a **very large** amount relative to the first | Second-lien CLTV caps bind |
| Current loan is **FHA with lifetime MIP** | Refinancing out of MIP can be worth real money |
| Borrower wants **one payment** and understands the cost | Legitimate preference |
| Second-lien pricing is genuinely bad for their profile | Run both, compare |

**The rule:** always price both. Then show the borrower both. Then recommend one and say
why.

That's what an advisor does. Presenting one option is what a salesperson does.

---

## Applying it to the transcripts

| Borrower | Equity | First-lien rate | Cash wanted | CLTV w/ second | Verdict |
|---|---|---|---|---|---|
| **Michael** | ~$442k | 3.1% VA | $120k | 41.5% | ✅ **Second, clearly** |
| **Paula** | ~$800k | 2.3% / 15-yr | $200k | 40% | ✅ **Second, clearly** |
| **Tyler** | ~$175k | 4.25% | $49k + $13k forbearance | ~60% | ⚠️ Complicated — forbearance may block a second; ARM on a refi may be better |
| **Fasani** | ~$142k | 4.5% FHA | $100k | ~87% | ⚠️ Tight CLTV, self-employed, needs bank-statement — likely a non-QM second or nothing |

**Two of four are clear-cut.** The other two are genuinely complex — which is exactly why
you price both and explain the tradeoff rather than defaulting to whatever's easiest.

---

## The scripts

### The reframe (memorize this)

> *"You've got a 2.9%. I can't beat that and neither can anyone else — the market's at
> about 6.8. So refinancing you would be the wrong move; you'd be paying today's rate on
> money you already borrowed cheaply. What we do instead is leave your first mortgage
> completely alone and put a second behind it just for the cash you need. Your 2.9% stays
> exactly where it is. Want me to price both so you can see the difference?"*

### The "wait for rates to drop" boomerang

> *"That's actually a good reason to do it this way rather than a reason to wait. If we do
> a second now, you get the money now, and when rates come down we consolidate the whole
> thing into one loan at the better rate. If we do a cash-out refi today, you've locked
> yourself into today's rate on everything. The second keeps your options open."*

### Explaining why the payment is higher

> *"Yes, the second's payment is a bit higher. Here's why I still recommend it. Under the
> refi you'd pay seven percent on the hundred and eight thousand you already have at three
> point one — that's roughly four thousand dollars a year, every year, in extra interest
> on old money. The second costs you a hundred a month more and keeps that three-one alive
> forever. And you can pay a second off early. You can't un-refinance."*

---

## What you must be able to do

- Explain why a second beats a cash-out for a legacy-rate borrower
- Calculate CLTV
- Distinguish HELOAN from HELOC and match each to a need
- State the HELOC payment-shock caveat honestly
- Identify when a cash-out refi is genuinely the better answer
- Deliver the reframe from memory

**Self-check:** Borrower has a $300,000 first at 3.25%, home worth $600,000, wants
$100,000 for a renovation over 18 months. What do you recommend and why?

> *A HELOC, probably. The 3.25% must be preserved — a cash-out would reprice $300k at ~7%
> to access $100k, which is indefensible. CLTV would be ($300k + $100k) ÷ $600k = 66.7%,
> comfortable. HELOC over HELOAN because the renovation spends over 18 months, so he only
> pays interest on what he's drawn rather than on the full $100k from day one. Flag the
> payment shock at the end of the draw period, and tell him we can convert to a fixed
> second or consolidate when rates come down.*

---

**Next:** `product-5-non-qm.md`
