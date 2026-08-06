# Unit 9 — Scenarios

Twelve complete borrower situations worked end to end. Do them **before** reading the
answers — that's the whole point.

**For each one, work out:**
1. What product?
2. What are the numbers? (payment, DTI, LTV/CLTV)
3. What are the obstacles?
4. What do you need to ask or verify?

Answers follow each scenario. Cover them.

---

## Scenario 1 — The legacy-rate cash-out

Michael. Home worth $550,000. Owes $108,000 at **3.1% on a 30-year VA loan**. Wants
$120,000. Income $72,000 W-2, 30 years at the same employer. Veteran, receiving **10% VA
disability** (~$148/month). One 30-day mortgage late six months ago — his debit card on
autopay expired.

<details>
<summary>Work it, then open</summary>

**Product: a fixed second lien. Not a cash-out refinance.**

**Why:** refinancing replaces the $108,000 at 3.1% with a $228,000 loan at ~7%. He'd pay
market rate on money he already borrowed cheaply. A second leaves the 3.1% permanently
intact.

**The numbers:**
```
CLTV = (108,000 + 120,000) ÷ 550,000 = 41.5%   ← exceptionally low, great pricing
Income: 72,000 ÷ 12 = $6,000/mo
       + disability 148 × 1.25 (tax-free gross-up) = $185
       = $6,185/mo qualifying
First P&I (3.1%, unchanged) ≈ $538
Second, $120k at ~9% over 20 yrs ≈ $1,080
```

**Two VA facts most originators miss:**
1. **10% disability = exempt from the VA funding fee.** Thousands of dollars.
2. **VA disability is tax-free → grosses up 25%.**

**The obstacle: the 30-day mortgage late.** Many cash-out programs require 0x30 in the
last 12 months. **But the cause is documentable** — an expired card on autopay. Ask:
*"Do you have anything in writing from the bank or the card issuer showing the
expiration?"* A documented payment-method failure is a completely different conversation
than "I couldn't pay."

**Must ask:** what's the $120,000 for? Timeline? Anyone else on the decision?

**Bonus:** his VA loan is **assumable**. At 3.1% in a 6.8% market that's a real asset if
he ever sells.
</details>

---

## Scenario 2 — The self-employed borrower with no returns

Business owner, 22 years in trucking. Home worth $330,000, owes $188,000 at 4.5% FHA.
Wants $100,000 to expand the business. **Tax returns not filed yet.** Says business
"slowed down but is coming back." 30-day mortgage late last month — his account was
frozen after fraud.

<details>
<summary>Work it, then open</summary>

**Product: bank statement loan (non-QM).** Conventional is impossible until returns are
filed, and even then heavy write-offs will likely crush qualifying income.

**The gating question — ask it first:** *"When will your CPA actually file?"*

**The unlocking question:** *"Forget the returns. In a normal month, how much is
DEPOSITED into the business account? Gross deposits, not profit."*

**The numbers:**
```
CLTV = (188,000 + 100,000) ÷ 330,000 = 87%   ← tight for a second; may need a refi instead
Bank statement income = (deposits ÷ months) × 0.50
```

**Obstacles, ranked:**
1. **The 30-day mortgage late LAST MONTH** — the biggest problem. Very recent. But the
   cause (fraud-related account freeze) is **documentable**: ask for the bank's fraud
   letter and case number.
2. **Unfiled returns** — closes the conventional door entirely
3. **Declining income** — "slowed down" is exactly what underwriting scrutinizes hardest.
   If year 2 < year 1, the lower figure is generally used.
4. **87% CLTV** — tight

**Must ask:** entity type (sole prop / LLC / S-corp — changes everything) · separate
business account? · what's the $100k actually buying?

**Also note:** he's paying FHA MIP every month on that 4.5% loan. Worth knowing even
though he shouldn't refinance the first.

**Honest assessment:** this may not be doable today. The right answer is to say so,
name the two things that would change it (filed returns, documented fraud letter), and
set a timeline.
</details>

---

## Scenario 3 — The short-horizon buyer

Buying a $520,000 home, 20% down. Relocating for work in about **2.5 years**. Wants a
30-year fixed by default. 30-yr fixed = 6.875%; 5/6 ARM = 6.25%.

<details>
<summary>Work it, then open</summary>

**Product: 5/6 ARM with lender credits. No points.**

**Why:** he's out in 2.5 years — well inside the 5-year fixed period, so he never sees an
adjustment. He'd be paying for rate insurance he will never use.

**The numbers:**
```
Loan = 520,000 × 0.80 = $416,000
30-yr fixed at 6.875%: 416 × 6.57 = $2,733
5/6 ARM at 6.25%:      416 × 6.16 = $2,563
Savings: $170/mo × 30 months ≈ $5,100
```

**Costs: take lender credits, not points.** He'd never recover an upfront cost in 30
months.

**What you must still do:** quote the **worst case**. With 2/1/5 caps starting at 6.25%,
the absolute lifetime ceiling is 11.25%. He should decide knowing the ceiling, not the
hope.

**Verify:** is the relocation firm? If it might not happen, the calculus changes.
</details>

---

## Scenario 4 — The debt consolidation

Home worth $340,000, owes $168,000 at **3.9%**. Income $78,000. Debts: cards $31,000 at
22–26% · car $19,000 at 12%. Overwhelmed by monthly payments.

<details>
<summary>Work it, then open</summary>

**Run the blended rate — that's the whole analysis.**

```
Mortgage  168,000 × 3.9%  = $6,552
Cards      31,000 × 24%   = $7,440
Car        19,000 × 12%   = $2,280
Total     218,000           $16,272

Blended = 16,272 ÷ 218,000 = 7.46%
```

**Two structures — price both:**

*Option A — cash-out refi at ~7%:*
```
218,000 × 7% = $15,260/yr → saves ~$1,000/yr
BUT destroys the 3.9% on the original $168,000
```

*Option B — second lien for $50,000 at ~9%:*
```
First stays at 3.9% on $168,000        = $6,552
Second $50,000 at 9%                   = $4,500
Total                                  = $11,052/yr
Saves ~$5,200/yr and preserves the 3.9%
```

**Option B wins clearly** — and it's not close.

```
CLTV = (168,000 + 50,000) ÷ 340,000 = 64%   ← comfortable
```

**The condition that must be stated:** this only works if the cards actually get closed.
If they get run back up, the borrower is worse off than before. That's not a technique —
it's true, and it protects them.
</details>

---

## Scenario 5 — The DTI failure

Wants a $340,000 purchase, 10% down. Income $6,800/mo. Existing debts: car $520 · cards
$390 · student loan $290. Taxes 1.3%, insurance $1,700/yr, rate 6.875%, PMI ~$140/mo.

<details>
<summary>Work it, then open</summary>

```
Loan = 340,000 × 0.90 = $306,000
P&I  = 306 × 6.57 = $2,010
Taxes = 340,000 × 0.013 ÷ 12 = $368
Insurance = 1,700 ÷ 12 = $142
PMI = $140
PITI = $2,660

Total debt = 2,660 + 520 + 390 + 290 = $3,860
DTI = 3,860 ÷ 6,800 = 56.8%   ✗ way over
```

**Not approvable as structured.** Now find the fixes:

| Fix | Effect |
|---|---|
| **Pay off the car** ($520/mo) | DTI → 49.1% — still high but in range with strong AUS |
| **Pay off car AND cards** | DTI → 43.4% ✓ |
| Larger down payment to 20% | Kills PMI (−$140) and shrinks P&I → DTI ~50% |
| Lower price point (~$280k) | DTI ~48% |
| Add a co-borrower with income | Depends — **but the lower middle FICO would govern** |

**The honest answer:** tell them today, not at week three. Give the specific path:
*"Pay off the car and the cards — about $X — and this works. Here's what that does to
the numbers."*

**Note the leverage:** the car has a $520 payment. Underwriting counts the *payment*, not
the balance. If only $3,000 is left on it, $3,000 changes the answer from no to yes.
</details>

---

## Scenario 6 — The investor

Owns 6 rental properties. Wants to buy a 7th for $310,000 with 25% down. Personal DTI is
impossible — too many mortgages. Target property rents for $2,650/month.

<details>
<summary>Work it, then open</summary>

**Product: DSCR.** Personal income isn't verified at all.

```
Loan = 310,000 × 0.75 = $232,500
P&I at ~7.5% (investor pricing) = 232.5 × 6.99 = $1,625
Taxes  310,000 × 1.2% ÷ 12 = $310
Insurance = $130
HOA = $0
PITIA = $2,065

DSCR = 2,650 ÷ 2,065 = 1.28   ✓ strong
```

**Above 1.25 — comfortable.** No paystubs, no tax returns, no DTI calculation.

**What to verify:** current lease or an appraiser's market rent analysis · reserves
(investors typically need 6+ months) · FICO (usually 620–680+ minimum) · whether this is
a portfolio he's growing (high lifetime value).
</details>

---

## Scenario 7 — The first-time buyer who thinks she can't

28 years old. Income $62,000. FICO 690. Has $8,000 saved. Believes she needs 20% down and
can't buy for years. Looking in a town of 15,000 about 40 minutes outside a metro.

<details>
<summary>Work it, then open</summary>

**First move: check the USDA eligibility map.** That town very likely qualifies, and
$62,000 is probably under the county income limit.

**If USDA works:**
```
$0 down · cheaper mortgage insurance than FHA · she buys now
```

**If USDA fails, the options in order:**

| Option | Down needed |
|---|---|
| Conventional 3% (HomeReady/Home Possible) | ~$7,500 on a $250k home — **she has it** |
| FHA 3.5% | ~$8,750 |
| Conventional 5% | $12,500 |

At 690 FICO, **conventional 3% likely beats FHA** — the PMI cancels and total cost over
time is lower.

**The correction she needs:** 20% down is not required and never was. It only avoids MI.

**Rough capacity:**
```
Income 62,000 ÷ 12 = $5,167/mo
Max debt = 5,167 × 0.45 = $2,325
Assume no other debts, taxes+insurance ~$350
Max P&I ≈ $1,975 → (1,975 ÷ 6.57) × 1000 ≈ $300,000 loan
```

She's in far better shape than she thinks.
</details>

---

## Scenario 8 — The elderly borrower with a low rate

79, widowed. Home worth $520,000, owes $95,000 at **2.6%**. Needs $40,000 for medical
bills. Mentions she may not be around much longer.

<details>
<summary>Work it, then open</summary>

**Under no circumstances refinance the 2.6%.** Replacing a $95,000 loan at 2.6% with a
$135,000 loan at ~7% to access $40,000 would be indefensible.

**Product: the smallest fixed second lien that solves the problem.**
```
CLTV = (95,000 + 40,000) ÷ 520,000 = 26%   ← trivial
```

**But before structuring anything, two questions that aren't about lending:**
1. Can the medical bills be negotiated or put on a payment plan? Hospitals routinely
   discount. **Sometimes the cheapest loan is no loan.**
2. Given her stated time horizon — is a 30-year term even appropriate? Is there family
   who'd inherit the house? A shorter term or a smaller amount may serve better.

**Structure the smallest loan that solves the problem, not the largest she qualifies
for.** This is the scenario where doing the right thing and doing the profitable thing
diverge, and how you handle it is who you are in this business.

Also worth checking: does she qualify for any assistance programs? Some states have
property tax relief for seniors that would free up monthly cash flow.
</details>

---

## Scenario 9 — The jumbo that fails

Buying $1,150,000 with 20% down ($920,000 loan). FICO 745. Income $340,000. DTI works out
to 38%. After down payment and closing costs he'll have **$40,000 left**.

<details>
<summary>Work it, then open</summary>

**The problem is reserves, not income or credit.**

```
P&I at ~7% = 920 × 6.65 = $6,118
Taxes 1,150,000 × 1.2% ÷ 12 = $1,150
Insurance ≈ $300
PITI ≈ $7,568

Reserves = 40,000 ÷ 7,568 = 5.3 months
```

**Jumbo investors typically want 6–12+ months.** He's short.

**Fixes:**
1. **Retirement accounts** — often count at a discounted percentage (60–70%). If he has a
   401(k), that may solve it entirely. **Ask.**
2. **Smaller down payment** (if the program allows) — keeps cash in reserves. Counterintuitive
   but sometimes correct.
3. **Shop the investor** — jumbo guidelines vary enormously. 6 months at one lender, 12 at
   another. This is where the broker channel is worth the most.
4. Gift funds for reserves, if permitted

**The lesson:** on any jumbo, ask about post-closing liquidity in the first conversation.
It's the #1 jumbo killer.
</details>

---

## Scenario 10 — The bonus income problem

W-2 employee. Base salary $63,500. With monthly bonuses, earns $79,000–$83,000. Took 12
weeks of **paternity leave** this year (6 paid, 6 unpaid), returned in September.

<details>
<summary>Work it, then open</summary>

**The issue:** bonus income requires a 2-year average, and this year's W-2 will be
suppressed by 12 weeks of leave. A naive 24-month average badly understates his real
earning power.

```
Naive average might qualify him on ~$63,500–$70,000
Properly handled, closer to $80,000
That's a ~$17,000 swing in qualifying income
```

**What to do:** protected parental leave is a documentable, non-recurring event — **not**
a job gap. Get an **HR letter** confirming:
- The leave dates
- That it was protected/approved leave
- That his compensation structure is unchanged
- His current base and bonus structure

There's a real case for annualizing around the leave rather than dragging the average
down. **Ask your AE how their underwriters treat it** — this varies, and it's exactly the
kind of question AEs exist for.

**The lesson:** when a borrower volunteers something that sounds like a complication,
that's often where the money is. Dig instead of moving on.
</details>

---

## Scenario 11 — The FHA borrower with equity

Bought 4 years ago with FHA, 3.5% down. Purchase price $280,000, now worth $370,000.
Owes $258,000 at 5.25%. Paying **MIP every month**. FICO now 730.

<details>
<summary>Work it, then open</summary>

```
Current LTV = 258,000 ÷ 370,000 = 69.7%
```

**He has 30% equity and is paying FHA MIP that will never fall off** — because on most
FHA loans with minimum down, annual MIP is for the life of the loan. The only escape is
refinancing out of FHA.

**But:** his rate is 5.25% and the market is ~6.8%. Refinancing raises the rate.

**Run the actual math:**
```
Current: P&I 258 × 5.52 = $1,424 + MIP ~$118 = $1,542
New conventional at 6.875%, no MI (69.7% LTV):
         P&I 258 × 6.57 = $1,695 + $0 MI = $1,695
```
**Costs $153/month more.** The MIP savings don't overcome the rate increase.

**Correct answer: don't refinance today.** But:
1. **Tell him what he's paying and why** — most FHA borrowers don't know MIP is permanent
2. **Put him on a rate-watch list.** If rates reach ~5.5–5.75%, refinancing into
   conventional eliminates the MIP and this becomes clearly worth doing
3. If he needs cash, a **second lien** preserves the 5.25%

**The lesson:** running the math and recommending *no action* is a legitimate — and
frequently correct — outcome.
</details>

---

## Scenario 12 — The credit event that isn't over

Foreclosed on a home in 2022. Assumes he can never buy again. Now has FICO 640, stable
W-2 income $71,000, $22,000 saved, no other derogatories since.

<details>
<summary>Work it, then open</summary>

**He's wrong, and he almost certainly doesn't know it.**

| Program | Waiting period | Eligible? |
|---|---|---|
| **FHA** | 3 years from foreclosure | ✅ **Yes — eligible now** |
| **VA** (if he served) | 2 years | ✅ Yes |
| Conventional | 7 years | ❌ Not until 2029 |

**Product: FHA.** 640 FICO clears the 580 threshold comfortably. 3.5% down.

```
Income 71,000 ÷ 12 = $5,917/mo
Max debt at 43% = $2,544
Assume modest existing debts, say $400 → max PITI ≈ $2,144
Less taxes/insurance/MIP ~$550 → P&I ≈ $1,594
Max loan ≈ (1,594 ÷ 6.57) × 1000 ≈ $242,000
With 3.5% down → ~$250,000 purchase price
```

**What to verify:** the exact foreclosure completion date (not the filing date — people
confuse these) · any deficiency judgment · that the credit has genuinely been clean since.

**The lesson:** waiting periods run from **completion/discharge**, not from filing. And a
large number of people who went through 2022-era credit events are eligible today and
have never been told.
</details>

---

## How to use this unit

**Round 1:** work all twelve on paper before opening any answer.

**Round 2 (a week later):** do them again, timed. Target: under 5 minutes each.

**Round 3:** cover the scenario *and* the answer. Just read the name — "the legacy-rate
cash-out," "the jumbo that fails" — and reconstruct the whole thing from memory.

When you can do Round 3 on all twelve, you understand this business at a level most
originators reach after two years.

**Next: `09-drills-and-exam.md`**
