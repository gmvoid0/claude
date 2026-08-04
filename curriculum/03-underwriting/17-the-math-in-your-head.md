# The Math You Do in Your Head

**Memorize this document.** These are the calculations you run live, on the phone, while
the borrower is talking. Being able to do them is most of the difference between sounding
like an advisor and sounding like someone reading off a screen.

---

## 1. Monthly payment (P&I)

The exact formula is impractical on a call. Use this.

### The per-thousand table

**Monthly principal + interest, per $1,000 borrowed, 30-year fixed:**

| Rate | Per $1,000 | Rate | Per $1,000 |
|---|---|---|---|
| 3.0% | $4.22 | 6.5% | $6.32 |
| 3.5% | $4.49 | **6.75%** | **$6.49** |
| 4.0% | $4.77 | **7.0%** | **$6.65** |
| 4.5% | $5.07 | 7.25% | $6.82 |
| 5.0% | $5.37 | 7.5% | $6.99 |
| 5.5% | $5.68 | 8.0% | $7.34 |
| 6.0% | $6.00 | 9.0% | $8.05 |

**Memorize the bolded rows.** They're today's market.

### How to use it

```
Payment = (Loan amount ÷ 1,000) × per-thousand factor
```

**$285,000 at 7%:**
```
285 × $6.65 = $1,895/month P&I
```

You can do that in your head in about two seconds. Practice until you can.

### 15-year, per $1,000

| Rate | Per $1,000 |
|---|---|
| 6.0% | $8.44 |
| 6.5% | $8.71 |
| 7.0% | $8.99 |

**The useful shortcut:** a 15-year payment runs roughly **35–40% higher** than a 30-year
at the same rate — but total interest is dramatically lower.

---

## 2. PITI — the real payment

P&I is not the payment. **PITI** is what they actually pay.

```
PITI = Principal + Interest + Taxes + Insurance (+ HOA + MI)
```

### Quick estimates when you don't have real numbers

| Component | Rough estimate |
|---|---|
| Property taxes | **1.0–1.5% of value annually** — varies enormously by state |
| Homeowners insurance | $1,200–$2,500/yr typical; **far higher** in FL, CA wildfire, coastal |
| PMI | 0.3–1.5% of loan annually, by FICO and LTV |
| FHA MIP | Annual percentage of balance, monthly |

### Worked example

$285,000 loan, $350,000 value, 7%, taxes 1.2%, insurance $1,800/yr:

```
P&I                285 × 6.65        = $1,895
Taxes              $350,000 × 1.2%   = $4,200/yr ÷ 12 = $350
Insurance          $1,800 ÷ 12                        = $150
                                              PITI    = $2,395
```

**Always quote PITI.** Quoting P&I and letting them discover taxes and insurance later is
how you get accused of hiding the ball.

---

## 3. DTI — Debt to Income

```
DTI = Total monthly debt payments ÷ Gross monthly income
```

### What counts as debt

✅ **Counts:** the new PITI, car loans, student loans, minimum credit card payments,
personal loans, alimony, child support, other mortgages, HOA dues

❌ **Doesn't count:** utilities, phone, insurance (other than homeowners), groceries,
401k contributions, taxes withheld

### Front-end vs. back-end

- **Front-end** = housing payment ÷ income
- **Back-end** = all debt ÷ income ← **this is the one that matters**

### The limits

| Program | Typical max back-end |
|---|---|
| Conventional | 45%, up to 50% with strong AUS |
| FHA | 43% baseline, higher with compensating factors |
| VA | Flexible — **residual income** governs |
| Non-QM | Varies widely |

### Worked example

$6,000/month gross. New PITI $2,395. Car $450. Cards $200. Student loan $180.

```
$2,395 + $450 + $200 + $180 = $3,225
$3,225 ÷ $6,000 = 53.75% DTI
```

**Too high.** Now you know it on the phone, in minute four — not at week three.

### The reverse calculation — more useful

**"How much house can they afford?"**

```
Max total debt = Gross income × 0.45
Max PITI       = Max total debt − existing debts
```

$6,000 income, $830 existing debts:
```
$6,000 × 0.45 = $2,700 max total debt
$2,700 − $830 = $1,870 max PITI
```

Then back into a loan amount: strip out taxes and insurance (say $500), leaving $1,370 P&I.

```
$1,370 ÷ $6.65 × 1,000 ≈ $206,000 loan
```

**You just pre-qualified someone in thirty seconds, live on the phone.** That's what
expertise sounds like.

---

## 4. LTV and CLTV

```
LTV  = Loan ÷ Value
CLTV = (All liens) ÷ Value
```

### The thresholds that matter

| LTV | Significance |
|---|---|
| 80% | PMI drops off; **cash-out ceiling** on conventional |
| 78% | Automatic PMI termination |
| 85–90% | Typical second-lien CLTV ceiling |
| 96.5% | FHA maximum |
| 97% | Conventional maximum (3% down) |
| 100% | VA and USDA |

### Maximum cash-out

```
Max loan     = Value × 0.80
Cash out     = Max loan − existing balance − closing costs
```

**Michael, Call 1:**
```
$550,000 × 0.80        = $440,000
$440,000 − $108,000    = $332,000
− closing costs (~$9k) ≈ $323,000 available
```

He wanted $120,000. **Enormous room** — worth telling him immediately, because it removes
his biggest unspoken worry.

---

## 5. Blended rate — the debt consolidation calculation

**The most important calculation in the 2026 market, and it was never run in any of the
four transcripts.**

Debt consolidation is not about the mortgage rate. It's about the **weighted average rate
across everything they owe.**

### The formula

```
Blended rate = Total annual interest ÷ Total balance
```

### Worked example

| Debt | Balance | Rate | Annual interest |
|---|---|---|---|
| Mortgage | $105,000 | 4.25% | $4,463 |
| Credit cards | $28,000 | 23% | $6,440 |
| Car loan | $22,000 | 11% | $2,420 |
| Personal loan | $12,000 | 16% | $1,920 |
| **Total** | **$167,000** | | **$15,243** |

```
Blended rate = $15,243 ÷ $167,000 = 9.13%
```

**Now consolidate everything into one mortgage at 7%:**

```
$167,000 × 7% = $11,690/year
Annual saving = $15,243 − $11,690 = $3,553
```

### The conversation this enables

> *"Your mortgage rate is going to go up — 4.25 to 7, and I'm not going to hide that. But
> that's the wrong number to look at. Right now, across everything you owe, you're paying
> a blended 9.1%. If we consolidate, that drops to 7%. That's about $3,500 a year back in
> your pocket, and your total monthly outflow drops by roughly $600."*
>
> *"One condition, and I mean it: this only works if you actually close those cards. If
> you run them back up you'll be worse off than you are now, and I'd rather you didn't do
> this at all. Can you close them?"*

**This is Tyler's call in Call 3.** He said "pay off debt, pay off the car" and the
balances and rates were never collected. The entire argument for his loan was sitting
right there and nobody built it.

---

## 6. Break-even on points

```
Break-even (months) = Cost ÷ Monthly savings
```

$300,000 loan, 1 point = $3,000, saves $50/month:
```
$3,000 ÷ $50 = 60 months = 5 years
```

**Stay longer than 5 years → points win. Shorter → they lose.**

---

## 7. Break-even on a refinance

```
Break-even (months) = Total closing costs ÷ Monthly savings
```

$8,000 in costs, saves $220/month:
```
$8,000 ÷ $220 ≈ 36 months
```

**The honest advisor version:**

> *"Break-even is three years. If you're moving before then, this doesn't make sense and I'd
> tell you not to do it."*

**A word of caution on this calculation:** it's the right tool for a rate-and-term
refinance. It is **not** sufficient for a cash-out, where the borrower is also getting
capital, or for a debt consolidation, where the relevant comparison is blended rate and
total outflow. Don't misapply it.

---

## 8. Grossing up non-taxable income

Tax-free income can be grossed up for qualifying — commonly by **25%**, though the factor
varies by lender and program.

```
Qualifying income = Actual × 1.25
```

**Applies to:** VA disability, certain Social Security, some child support, some
retirement and pension income.

**Michael's $148/month disability** → roughly $185 for qualifying.

Small in his case. On $2,000/month of tax-free income it adds $500/month of qualifying
power, which routinely decides approvals.

---

## 9. Self-employed income — bank statement

```
Monthly qualifying = (Total deposits ÷ months) × (1 − expense factor)
```

24 months of statements, $480,000 total deposits, 50% expense factor:
```
$480,000 ÷ 24 = $20,000/month gross deposits
$20,000 × 0.50 = $10,000/month qualifying
```

**The question to ask** (`../02-products/10-non-qm.md`):

> *"In a normal month, how much is deposited into the business account? Just gross
> deposits — not profit, not after write-offs."*

---

## 10. Rental income

```
Qualifying rental income = Gross rent × 0.75
```

The 25% haircut covers vacancy and maintenance. $2,400/month rent → $1,800 counts.

---

## The one-page cheat sheet

```
P&I           = (Loan ÷ 1,000) × factor    [7% = 6.65, 6.75% = 6.49]
PITI          = P&I + taxes + insurance + MI + HOA
DTI           = Total monthly debt ÷ gross monthly income
Max PITI      = (Income × 0.45) − existing debts
LTV           = Loan ÷ Value
Max cash-out  = (Value × 0.80) − balance − costs
Blended rate  = Total annual interest ÷ Total balance
Break-even    = Cost ÷ Monthly savings
Gross-up      = Non-taxable income × 1.25
Bank stmt     = (Deposits ÷ months) × 0.50
Rental        = Gross rent × 0.75
```

**Tape this to your monitor. Run it until it's automatic.**

---

## The drill

Do this for ten minutes a day for two weeks.

Generate a random scenario — loan amount, rate, value, income, debts — and compute:
1. P&I
2. PITI
3. DTI
4. LTV
5. Max cash-out

Then check with a calculator. **When you can do all five in under sixty seconds without
writing anything down, you're ready to be trusted on a live call.**

---

## What you must be able to do

- Calculate P&I from the per-thousand table instantly
- Estimate PITI with taxes and insurance
- Calculate DTI and reverse it into a maximum loan amount
- Calculate maximum cash-out at 80% LTV
- **Calculate a blended rate and use it to sell consolidation**
- Compute break-even on points and on a refinance

**Self-check:** Borrower earns $7,500/month, has $900 in existing debts, wants to buy at
$400,000 with 10% down. Taxes 1.3%, insurance $1,700/yr, rate 6.875%, PMI ~$140/month.
Do they qualify?

> *Loan = $360,000. P&I ≈ 360 × 6.57 ≈ $2,365. Taxes = $400,000 × 1.3% ÷ 12 = $433.
> Insurance = $142. PMI = $140. **PITI ≈ $3,080.** Total debt = $3,080 + $900 = $3,980.
> DTI = $3,980 ÷ $7,500 = **53%.** Too high for conventional. Options: larger down payment
> to cut the loan and kill PMI, pay off some of the $900, look at a lower price point, or
> add a co-borrower. Tell them on the call — not at week three.*

---

**Next:** `13-the-four-cs.md`
