# Unit 3 — The Numbers

Every calculation you will ever need. Learn them in this order — each builds on the last.

**Method:** for each calculation — read it, do the worked example on paper, then do the
three practice problems at the end of the section without looking. Answers at the bottom
of the unit.

---

## 1. Monthly payment (P&I) — the one you use hourly

The real formula is ugly. Nobody uses it live. You use a **per-thousand factor**.

### The idea
Every rate has a number: what $1,000 of loan costs per month. Multiply by how many
thousands you're borrowing. Done.

### The table — MEMORIZE the bolded rows

**30-year fixed, monthly P&I per $1,000 borrowed:**

| Rate | Factor | Rate | Factor |
|---|---|---|---|
| 3.000% | 4.22 | 6.500% | 6.32 |
| 3.500% | 4.49 | **6.625%** | **6.40** |
| 4.000% | 4.77 | **6.750%** | **6.49** |
| 4.500% | 5.07 | **6.875%** | **6.57** |
| 5.000% | 5.37 | **7.000%** | **6.65** |
| 5.500% | 5.68 | **7.125%** | **6.74** |
| 6.000% | 6.00 | **7.250%** | **6.82** |
| 6.250% | 6.16 | 7.500% | 6.99 |
| | | 8.000% | 7.34 |

**15-year fixed, per $1,000:**

| Rate | Factor |
|---|---|
| 6.000% | 8.44 |
| 6.500% | 8.71 |
| 7.000% | 8.99 |

### The formula
```
P&I = (loan amount ÷ 1,000) × factor
```

### Worked example
$285,000 at 7.000%:
```
285,000 ÷ 1,000 = 285
285 × 6.65 = $1,895/month
```

### Two shortcuts worth owning
- **At 7%, the factor is 6.65** — so *"loan in thousands, times six-and-two-thirds."*
- **A 15-year payment runs ~35–40% higher** than a 30-year at the same rate.

### Practice
1. $412,000 at 6.875% — P&I?
2. $198,500 at 7.25% — P&I?
3. $300,000 at 6.5%, 15-year — P&I?

---

## 2. PITI — the payment that's actually real

P&I is not the payment. **PITI** is.

```
PITI = P&I + property taxes + homeowners insurance + mortgage insurance + HOA dues
        (all expressed monthly)
```

### Estimating the pieces when you don't have real numbers

| Piece | Estimate | Notes |
|---|---|---|
| **Property taxes** | 1.0%–1.5% of *value* per year | Wildly state-dependent. NJ/IL/TX high; HI/AL low. |
| **Homeowners insurance** | $1,200–$2,500/yr typical | Far higher in FL, coastal, CA wildfire zones |
| **PMI (conventional)** | 0.3%–1.5% of *loan* per year | Driven by FICO and LTV together |
| **FHA MIP** | ~0.55% of *loan* per year (typical) | Plus 1.75% financed upfront |
| **HOA** | Actual figure only | Never estimate — get the real number |

**Critical detail:** taxes are a % of **value**; MI is a % of **loan**. Mixing these up
is the most common beginner error.

### Worked example
$285,000 loan · $350,000 value · 7.000% · taxes 1.2% · insurance $1,800/yr · no MI

```
P&I         285 × 6.65                    = $1,895
Taxes       350,000 × 0.012 = 4,200 ÷ 12  = $  350
Insurance   1,800 ÷ 12                    = $  150
                                    PITI  = $2,395
```

### Practice
4. $240,000 loan, $300,000 value, 6.75%, taxes 1.35%, insurance $1,650/yr, PMI 0.5% of
   loan/yr. PITI?

---

## 3. LTV — Loan to Value

```
LTV = loan ÷ value
```

"Value" = appraised value, **except on a purchase, where it's the LOWER of appraised
value or purchase price.**

### Worked
$285,000 loan on a $350,000 home → 285,000 ÷ 350,000 = **81.4%**

### The thresholds — MEMORIZE

| LTV | What happens |
|---|---|
| **≤ 60%** | Best pricing tier on most grids |
| **78%** | Conventional PMI terminates **automatically** |
| **80%** | PMI cancellable on request; **conventional cash-out ceiling**; no-MI purchase threshold |
| **85%** | FHA cash-out ceiling |
| **90%** | Common second-lien CLTV ceiling |
| **95%** | Conventional 5%-down max |
| **96.5%** | FHA maximum (3.5% down) |
| **97%** | Conventional maximum (3% down programs) |
| **100%** | VA and USDA |

### Practice
5. $475,000 home, borrower puts down $52,000. LTV?

---

## 4. CLTV — when there's more than one loan

```
CLTV = (first lien + second lien + any other liens) ÷ value
```

### Worked
Home worth $550,000 · first mortgage $108,000 · proposed second of $120,000
```
(108,000 + 120,000) ÷ 550,000 = 228,000 ÷ 550,000 = 41.5%
```
Very low → excellent second-lien pricing and easy approval.

**HCLTV note:** with a HELOC, lenders often use the **full credit line**, not the drawn
balance. A $50k line with $10k drawn counts as $50k.

### Practice
6. $400,000 home · $260,000 first · wants a $60,000 second. CLTV?

---

## 5. DTI — Debt to Income

```
DTI = total monthly debt payments ÷ gross monthly income
```

**Gross** = before taxes. Always.

### What counts as debt

✅ **Counts:** the new PITI · car loans · student loans (even deferred — a % of balance
is often used) · minimum credit card payments · personal loans · alimony · child support
· other property PITI · HOA dues

❌ **Does NOT count:** utilities · phone · cable · groceries · gas · insurance other than
homeowners · 401(k) contributions · taxes withheld · daycare

### Worked
Income $6,000/mo · new PITI $2,395 · car $450 · cards $200 min · student loan $180
```
Total debt = 2,395 + 450 + 200 + 180 = $3,225
DTI = 3,225 ÷ 6,000 = 53.75%   ← too high for conventional
```

### The limits

| Program | Typical max back-end DTI |
|---|---|
| Conventional | 45%, stretching to **50%** with strong AUS |
| FHA | 43% baseline, **higher** with compensating factors |
| VA | Flexible — **residual income** is the real test |
| USDA | 41% typical |
| Jumbo | Often capped ~43% |
| Non-QM | Varies widely, often 50%+ |

### Practice
7. Income $8,200/mo · proposed PITI $2,650 · car $520 · cards $310 · student $240. DTI?
   Conventional-eligible?

---

## 6. Reverse DTI — "how much can they afford?"

More useful than forward DTI, because it answers the question people actually ask.

```
Step 1:  Max total debt = gross monthly income × 0.45
Step 2:  Max PITI       = max total debt − existing monthly debts
Step 3:  Max P&I        = max PITI − taxes − insurance − MI − HOA
Step 4:  Max loan       = (max P&I ÷ factor) × 1,000
```

### Worked
Income $6,000/mo · existing debts $830 · est. taxes+insurance $500/mo · rate 7%
```
1)  6,000 × 0.45          = $2,700 max total debt
2)  2,700 − 830           = $1,870 max PITI
3)  1,870 − 500           = $1,370 max P&I
4)  (1,370 ÷ 6.65) × 1000 = $206,015 ≈ $206,000 max loan
```

**This is the single most useful calculation in the job.** Drill it until it's automatic.

### Practice
8. Income $9,500/mo · existing debts $1,100 · taxes+insurance est. $640/mo · rate 6.875%.
   Max loan?

---

## 7. Maximum cash-out

```
Max new loan = value × max LTV for the program
Cash to borrower = max new loan − current payoff − closing costs
```

Conventional cash-out ceiling on a primary residence = **80%**.

### Worked
Home $550,000 · owes $108,000 · closing costs ~$9,000
```
550,000 × 0.80 = $440,000 max loan
440,000 − 108,000 − 9,000 = $323,000 available
```

### Practice
9. Home $380,000 · owes $215,000 · costs $8,500 · conventional cash-out. Max cash?

---

## 8. Blended rate — the debt-consolidation calculation

When someone owes money in several places, the "rate" that matters is the **weighted
average across everything**, not any single loan's rate.

```
Blended rate = total annual interest ÷ total balance
```

### Worked

| Debt | Balance | Rate | Annual interest |
|---|---|---|---|
| Mortgage | $105,000 | 4.25% | $4,463 |
| Credit cards | $28,000 | 23% | $6,440 |
| Car | $22,000 | 11% | $2,420 |
| Personal loan | $12,000 | 16% | $1,920 |
| **Total** | **$167,000** | | **$15,243** |

```
Blended = 15,243 ÷ 167,000 = 9.13%
```

Consolidate all $167,000 into one mortgage at 7%:
```
167,000 × 0.07 = $11,690/yr
Savings = 15,243 − 11,690 = $3,553/yr
```

**The lesson:** the mortgage rate went UP (4.25% → 7%) and the borrower still came out
ahead, because the 23% and 16% debt disappeared. **Rate on one loan ≠ cost of the debt.**

### Practice
10. Mortgage $190,000 @ 5.5% · cards $34,000 @ 21% · car $18,000 @ 9%. Blended rate?

---

## 9. Break-even calculations

### On discount points
```
Break-even (months) = cost of points ÷ monthly savings
```
$300,000 loan · 1 point = $3,000 · saves $50/mo → 3,000 ÷ 50 = **60 months (5 years)**

Staying longer than break-even → points win. Shorter → they lose.

### On a refinance
```
Break-even (months) = total closing costs ÷ monthly savings
```
$8,000 costs · saves $220/mo → 8,000 ÷ 220 ≈ **36 months**

⚠️ **This tool is only valid for a rate-and-term refinance.** It does NOT apply cleanly
to a cash-out (borrower is also receiving capital) or a consolidation (use blended rate
instead).

### Practice
11. $420,000 loan · 2 points ($8,400) · drops payment $118/mo. Break-even?

---

## 10. Grossing up non-taxable income

Tax-free income counts for MORE than its face value, because the borrower keeps all of it.

```
Qualifying income = actual income × 1.25
```
(25% is the common factor; it varies by program — verify per file.)

**Applies to:** VA disability · much of Social Security · certain child support ·
some pension and retirement income

### Worked
$2,400/mo of VA disability → 2,400 × 1.25 = **$3,000/mo** for qualifying.
That's $600/mo of free DTI room — often the difference between approve and decline.

---

## 11. Self-employed income — bank statement method

```
Monthly qualifying income = (total deposits ÷ number of months) × (1 − expense factor)
```
Expense factor is commonly 50%; a CPA-prepared P&L can sometimes justify lower.

### Worked
24 months of business statements, $480,000 total deposits, 50% factor:
```
480,000 ÷ 24 = $20,000/mo gross deposits
20,000 × 0.50 = $10,000/mo qualifying income
```

**The question that unlocks this:** *"In a normal month, how much is DEPOSITED into the
business account?"* — gross deposits, not profit, not after write-offs.

---

## 12. Self-employed income — tax return method (add-backs)

Tax returns are engineered to MINIMIZE income. Underwriting adds back the deductions
that didn't actually cost cash.

```
Qualifying income = net profit + depreciation + depletion + amortization
                    + business use of home + documented one-time losses
```

### Worked — Schedule C sole proprietor
```
Net profit (line 31)          $48,000
+ Depreciation                 $22,000   ← usually the big one
+ Business use of home          $3,600
= Adjusted annual             $73,600
÷ 12                          $6,133/mo qualifying
```
Borrower says "I make $48,000." He qualifies on $73,600. **Depreciation is where the
money hides** — especially trucking, construction, and equipment-heavy businesses.

**By entity — where to look:**

| Entity | Form | Income lives at |
|---|---|---|
| Sole proprietor | Schedule C | Net profit, line 31 |
| Partnership | 1065 + K-1 | K-1 ordinary income + guaranteed payments |
| S-corp | 1120S + K-1 | K-1 income **+ W-2 wages the owner pays himself** |
| C-corp | 1120 | W-2 wages; dividends only with history |

### Practice
12. S-corp owner: W-2 wages $60,000 · K-1 ordinary income $41,000 · 1120S depreciation
    $28,000. Monthly qualifying income?

---

## 13. Rental income

```
Qualifying rental income = gross rent × 0.75
```
The 25% haircut covers vacancy and maintenance. $2,400 rent → $1,800 counts.

If Schedule E shows a **loss**, that loss counts as a **liability** against DTI.

---

## 14. DSCR — investor loans

```
DSCR = monthly rent ÷ monthly PITIA
```

| DSCR | Meaning |
|---|---|
| 1.25 | Rent covers payment with 25% cushion — strong |
| 1.00 | Breakeven — typical minimum |
| < 1.00 | Rent falls short — some lenders allow with more down |

### Worked
Rent $2,800 · PITIA $2,240 → 2,800 ÷ 2,240 = **1.25** ✓

---

## 15. Reserves

```
Reserves (in months) = liquid assets remaining AFTER closing ÷ monthly PITI
```

$85,000 left after closing · PITI $2,395 → 85,000 ÷ 2,395 = **35 months**

Retirement accounts usually count at a **discounted percentage** (often 60–70%) and only
if accessible. Reserves are the **most powerful compensating factor** in underwriting.

---

## 16. Basis points and compensation

**1 bps = 0.01%. 100 bps = 1%.**

```
Compensation dollars = loan amount × (bps ÷ 10,000)
```

| bps | On $250,000 | On $500,000 |
|---|---|---|
| 100 | $2,500 | $5,000 |
| 125 | $3,125 | $6,250 |
| **150** | **$3,750** | **$7,500** |
| 200 | $5,000 | $10,000 |
| 275 | $6,875 | $13,750 |

Compensation is a % of **loan amount** — never of rate, never of fees.

---

## 17. Price, points, and credits

Rate sheets quote **price**, expressed as a percentage of the loan.

```
Dollars = loan amount × ((price − 100) ÷ 100)
```

- **Price > 100** = rebate → money available for costs (**lender credit**)
- **Price = 100** = par → nothing paid, nothing received
- **Price < 100** = discount → borrower pays points

### Worked
$300,000 loan at price 101.500:
```
300,000 × (1.5 ÷ 100) = $4,500 rebate available
```
At price 98.750:
```
300,000 × (1.25 ÷ 100) = $3,750 the borrower must PAY
```

Full pricing mechanics in Unit 5.

---

## 18. The FHA MIP calculation

```
Upfront MIP (UFMIP) = base loan × 1.75%     ← almost always financed into the loan
Annual MIP          = loan × annual rate ÷ 12   ← monthly
```
`[Verify current MIP factors at HUD — they are periodically revised.]`

### Worked
$300,000 base loan:
```
UFMIP = 300,000 × 0.0175 = $5,250 → financed → total loan becomes $305,250
Annual MIP at ~0.55%: 305,250 × 0.0055 ÷ 12 ≈ $140/month
```

**Note the compounding detail:** the financed UFMIP increases the balance the annual MIP
is calculated on.

---

## 19. The VA funding fee

```
Funding fee = loan amount × applicable % (varies by purpose, down payment, first/subsequent use)
```
Financeable into the loan.

**MEMORIZE: borrowers receiving VA disability compensation are EXEMPT.** On a $300,000
loan that exemption is thousands of dollars.
`[Verify current fee table at VA.gov.]`

---

## Answers

1. 412 × 6.57 = **$2,707**
2. 198.5 × 6.82 = **$1,354**
3. 300 × 8.71 = **$2,613**
4. P&I 240 × 6.49 = $1,558 · taxes 300,000 × .0135 ÷ 12 = $338 · ins 1,650 ÷ 12 = $138 ·
   PMI 240,000 × .005 ÷ 12 = $100 → **PITI ≈ $2,134**
5. Loan = 475,000 − 52,000 = 423,000 → 423,000 ÷ 475,000 = **89.1%**
6. (260,000 + 60,000) ÷ 400,000 = **80%**
7. Total debt = 2,650 + 520 + 310 + 240 = 3,720 → 3,720 ÷ 8,200 = **45.4%** — right at
   the conventional edge; needs strong AUS, or pay down a debt.
8. 9,500 × .45 = 4,275 → −1,100 = 3,175 → −640 = 2,535 P&I →
   (2,535 ÷ 6.57) × 1000 = **$385,800**
9. 380,000 × .80 = 304,000 → −215,000 − 8,500 = **$80,500**
10. Interest: 10,450 + 7,140 + 1,620 = 19,210 · Balance: 242,000 →
    19,210 ÷ 242,000 = **7.94%**
11. 8,400 ÷ 118 = **71 months (~6 years)**
12. 60,000 + 41,000 + 28,000 = 129,000 ÷ 12 = **$10,750/mo**

---

## The one-page formula sheet — copy this by hand until it's memory

```
P&I           = (loan ÷ 1,000) × factor        [7%=6.65 · 6.875%=6.57 · 6.75%=6.49]
PITI          = P&I + taxes + insurance + MI + HOA
                taxes ≈ value × 1.0–1.5% ÷ 12
                PMI   ≈ loan  × 0.3–1.5% ÷ 12
LTV           = loan ÷ value
CLTV          = all liens ÷ value
DTI           = total monthly debt ÷ gross monthly income
Max loan      = ((income × .45 − debts − T&I) ÷ factor) × 1,000
Max cash-out  = (value × .80) − payoff − costs
Blended rate  = total annual interest ÷ total balance
Break-even    = cost ÷ monthly savings
Gross-up      = non-taxable × 1.25
Bank stmt     = (deposits ÷ months) × 0.50
SE add-backs  = net profit + depreciation + depletion + home office
Rental        = gross rent × 0.75
DSCR          = rent ÷ PITIA
Reserves      = assets after closing ÷ PITI
Comp $        = loan × (bps ÷ 10,000)
Price $       = loan × ((price − 100) ÷ 100)
UFMIP         = base loan × 1.75%
```

**Next: `04-what-moves-what.md`**
