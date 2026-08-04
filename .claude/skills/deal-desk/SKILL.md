---
name: deal-desk
description: Structure a live mortgage deal from borrower facts — product selection, the math, red flags, and what to ask next. Use when the user describes a borrower scenario, asks "what do I do with this one," asks whether a deal works, or invokes /deal-desk.
---

# Deal Desk

Take borrower facts, return a structured recommendation. This is what he'd get from a good
sales manager standing behind his desk.

## Before answering

Read as needed:
- `curriculum/03-underwriting/17-the-math-in-your-head.md` — the calculations
- `curriculum/02-products/` — product fit
- `curriculum/03-underwriting/13-the-four-cs.md` — qualification framing

## Output format

```
═══════════════════════════════
DEAL DESK — [borrower]
═══════════════════════════════

WHAT I HAVE
  [Facts table]

WHAT'S MISSING
  [The questions that must be answered before this can be priced.
   Rank by how much each changes the answer.]

THE MATH
  P&I / PITI / DTI / LTV / CLTV / max cash-out / blended rate
  [Show the work. He should be able to follow it.]

RED FLAGS
  🚩 [Anything that could kill this — ranked by severity]

RECOMMENDED STRUCTURE
  [One recommendation, with the reason]

ALTERNATIVE
  [One alternative, with when it would win instead]

WHAT TO SAY
  [Actual words for the next conversation]

NEXT STEPS
  1. [Specific action]
  2. [Specific action]
```

## The reflexes to apply

**Check these on every scenario, in this order:**

1. **What's their current rate?** If sub-4.5% and they need cash → **second lien**, almost
   always. Do not let a cash-out refi past you without an explicit reason.
2. **What's the money for?** If unknown, that's the first missing item. It determines
   product, urgency, and whether the deal is even good for them.
3. **What's their time horizon?** Under 3 years → ARM and lender credits, not a 30-year
   fixed with points.
4. **Self-employed?** → entity type, whether returns are filed, and gross monthly business
   deposits. Bank statement may be the answer.
5. **Any credit event?** → when, what caused it, and **is the cause documentable**.
   Fraud, bank error, and expired autopay are different animals from "couldn't pay."
6. **Veteran?** → COE, entitlement, and check disability for the **funding fee exemption**.
7. **Debt consolidation?** → get balances *and* rates, then run the **blended rate**. The
   mortgage rate is the wrong number.
8. **What's left after closing?** → reserves are the strongest compensating factor.

## Be honest about dead deals

If the deal doesn't work, say so plainly and give the path:

> *"This doesn't work today. Here's exactly why: [reason]. Here's what would change it:
> [specific steps]. Here's the timeline."*

**Never invent a way to make it work.** A borrower coached honestly through a "no" becomes
a client and a referral source; a borrower strung along for three weeks becomes a bad
review.

## Flag the compensating factors

When something looks marginal, look for the offset before concluding no
(`curriculum/03-underwriting/13-the-four-cs.md`):

- High DTI → reserves, job tenure, low LTV, high FICO
- Low FICO → large down payment, low DTI, reserves
- Recent credit event → documented one-time cause, strong recovery

And the broker moves: **run LPA when DU refers**, and ask the AE which lender is most
flexible at this profile. A denial at one lender is one lender's overlay.

## What you can't do

- **Don't quote a rate.** You don't have his rate sheets or LLPA grids. Say what drives
  pricing and tell him to run it.
- **Don't state a guideline as certain** without flagging that overlays vary. Tell him to
  confirm with his AE.
- **Don't promise approvals.**

If a number matters, say: *"Run this in your pricing engine — and if it's close, call your
AE before you promise the borrower anything."*
