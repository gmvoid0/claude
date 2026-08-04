# How a Mortgage Actually Works

Start here. Every term is defined. Nothing is assumed.

---

## What a mortgage is

A **mortgage** is two things bundled together:

1. A **note** — a promise to repay borrowed money on specific terms
2. A **security instrument** (a mortgage or deed of trust) — pledging the house as
   collateral, so the lender can foreclose if you don't pay

People say "mortgage" to mean the whole loan. Technically the note is the debt and the
mortgage is the lien.

---

## The vocabulary

| Term | Meaning |
|---|---|
| **Principal** | The amount borrowed |
| **Interest** | The cost of borrowing, as an annual % |
| **Note rate** | The actual interest rate on the loan |
| **APR** | Rate *plus* certain fees, expressed as a rate. Always higher than the note rate. Comparison tool. |
| **Term** | How long you have to repay — 30 years, 15 years |
| **Amortization** | The schedule of paying principal + interest to zero over the term |
| **PITI** | **P**rincipal, **I**nterest, **T**axes, **I**nsurance — the real monthly payment |
| **Escrow / impound** | An account the servicer holds to pay your taxes and insurance |
| **LTV** | **L**oan **t**o **V**alue — loan ÷ value. $200k on a $250k home = 80% |
| **CLTV** | Combined LTV — *all* liens ÷ value. Matters when there's a second. |
| **DTI** | **D**ebt **t**o **I**ncome — monthly debts ÷ monthly gross income |
| **FICO** | The credit score. 300–850. |
| **Equity** | Value minus what you owe |
| **Lien** | A legal claim on the property. First lien gets paid first in a foreclosure. |
| **Origination** | Creating the loan — your job |
| **Underwriting** | Deciding whether the loan gets approved |
| **Servicing** | Collecting payments after closing |
| **Points** | 1 point = 1% of the loan amount |
| **Lock** | Freezing the rate for a set number of days |

---

## Amortization — why the early years feel like nothing

Your payment is fixed, but its **composition changes** every month.

On a $200,000 loan at 7% for 30 years, the payment is about $1,331.

| | Interest | Principal |
|---|---|---|
| Month 1 | ~$1,167 | ~$164 |
| Year 10 | ~$1,000 | ~$331 |
| Year 25 | ~$400 | ~$931 |

Early on, almost everything goes to interest. This is why:

- **Refinancing resets you to the front of that curve.** A borrower ten years into a
  30-year who refinances into a new 30-year goes back to paying mostly interest. This is
  the argument behind the **swap-out close** (`../05-sales/30-closing.md`) — offer a
  25-year instead.
- **Paying extra principal early has outsized effect.**
- **The total interest number is shocking.** On that loan: ~$279,000 in interest over 30
  years. Be careful how you use this — it's true, and it's also true that money has time
  value.

---

## The loan lifecycle

Ten stages. You own the first three and stay involved throughout.

### 1. Application
Borrower provides information. The **six TRID elements** (name, income, SSN, property
address, estimated value, loan amount) trigger the application clock
(`../04-compliance/21-trid-and-disclosures.md`).

### 2. Disclosures
**Loan Estimate** within 3 business days. Borrower expresses **Intent to Proceed**.

### 3. Processing
A **processor** collects documents: paystubs, W-2s, tax returns, bank statements, ID.
They build the file for underwriting.

### 4. Credit
A **tri-merge** credit report from all three bureaus. The middle score usually governs;
on joint applications, typically the lower of the two borrowers' middle scores.

### 5. AUS
The file runs through an **Automated Underwriting System** — Fannie Mae's **DU** (Desktop
Underwriter) or Freddie Mac's **LPA** (Loan Product Advisor). It returns
Approve/Eligible, Approve/Ineligible, or Refer, plus a list of conditions.

### 6. Appraisal
A licensed appraiser determines value. Sometimes waived (a **PIW** / appraisal waiver)
when AUS allows.

### 7. Underwriting
A human underwriter reviews everything and issues a **conditional approval** — approved,
subject to a list of conditions.

### 8. Conditions
The file goes back and forth clearing conditions. **This is where most delays happen**
and where your expectation-setting on the sales call pays off or costs you.

### 9. Clear to Close
All conditions cleared. **Closing Disclosure** must be received by the borrower at least
**3 business days** before closing.

### 10. Closing and funding
Documents signed, funds wired, lien recorded. On a **primary residence refinance** the
borrower has a **3-business-day right of rescission** before funding.

**Typical timeline:** 21–45 days. Wholesale lenders are often faster than large
servicers — which is a legitimate selling point.

---

## Where the money comes from

This is the part almost no new LO understands, and it's what makes you credible.

**Your lender does not lend you their own money and hold it for 30 years.**

Here's the actual flow:

```
1. Lender funds your borrower's loan
2. Lender sells the loan (days or weeks later)
3. Buyer pools it with thousands of similar loans
4. The pool is securitized into a mortgage-backed security (MBS)
5. The MBS is sold to investors — pensions, funds, banks, foreign governments
6. Your borrower's monthly payment flows through to those investors
```

**Why this matters to you, on the phone:**

- Rates are set by **MBS market pricing**, not by your lender's opinion and **not directly
  by the Fed**
- This is why rates change daily, sometimes intraday
- This is why every lender's rates are broadly similar — they're all selling into the
  same market
- This is why guidelines are so rigid: the loan must be **saleable**. A loan nobody will
  buy is a loan nobody will make.

**The line that makes you sound like you know what you're doing:**

> *"Rates aren't really set by my company — they're set by the mortgage bond market. When
> investors buy more mortgage bonds, rates fall. Which is why the Fed cutting doesn't
> automatically mean your mortgage rate drops. They're related, but they're not the same
> thing."*

Full treatment in `02-follow-the-money.md`.

---

## The four questions underwriting asks

Everything in underwriting reduces to these — the **Four Cs**:

| | Question | What's examined |
|---|---|---|
| **Credit** | Do they pay people back? | FICO, history, derogatories |
| **Capacity** | Can they afford it? | Income, DTI, employment |
| **Capital** | Do they have money? | Down payment, reserves, assets |
| **Collateral** | Is the house worth it? | Appraisal, LTV, condition |

Every document requested maps to one of these. When a borrower asks "why do you need
this?", the answer is always one of the four.

`../03-underwriting/13-the-four-cs.md`

---

## Who's who

| Role | What they do |
|---|---|
| **Loan Officer (you)** | Find borrowers, structure loans, take applications |
| **LOA** | Loan officer assistant — admin support |
| **Processor** | Collects and organizes documents |
| **Underwriter** | Approves or denies |
| **Account Executive (AE)** | Your rep at each wholesale lender. **Your lifeline.** |
| **Appraiser** | Determines value. Independent by law. |
| **Title company** | Verifies ownership, handles closing |
| **Escrow officer** | Holds funds, coordinates closing |
| **Closer / funder** | Prepares final docs, wires money |
| **Servicer** | Collects payments after closing |

`04-cast-of-characters.md`

---

## The one thing to understand about your role

You are **not** the decision maker. You cannot approve a loan.

What you *can* do — and what separates good LOs from bad ones — is:

1. **Structure the file correctly from the start** so it can be approved
2. **Find the problems early**, on the phone, before three weeks are wasted
3. **Set expectations honestly** so nobody is surprised at week three
4. **Pick the right lender** for this specific borrower's profile

Every one of those happens during your sales conversation. **The sales call and the
underwriting outcome are the same event, separated by three weeks.**

---

## What you must be able to do

- Define every term in the vocabulary table
- Explain amortization and why refinancing resets the curve
- Walk a borrower through the ten stages
- Explain where mortgage money actually comes from
- Name the Four Cs and map any document request to one

**Self-check:** A borrower asks *"why did my rate go up when the Fed cut rates?"*

> *"Good question — they're related but they're not the same thing. Your mortgage rate is
> set by the mortgage bond market, not the Fed. The Fed sets the overnight rate banks
> lend to each other at. Mortgage rates track what investors will pay for mortgage bonds,
> and sometimes a Fed cut actually pushes those the other way if investors read it as
> inflationary. It's counterintuitive and it catches people out constantly."*

---

**Next:** `02-follow-the-money.md`
