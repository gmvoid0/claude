# The Trigger Lead Ban

**Effective March 5, 2026.** This is the most important structural change to mortgage
lead generation in twenty years, and it happened five months before this system was
written. Almost every cold-calling script circulating in the industry predates it.

---

## 1. What a trigger lead was

When a lender pulls a consumer's credit for a mortgage, the credit bureaus record a
"hard inquiry" with an industry code identifying it as mortgage-related.

The bureaus — Experian, Equifax, TransUnion — then **sold that event**, in near real
time, as a lead. Buyers received the consumer's name, phone number, property address,
current mortgage balance, interest rate, loan type, and credit tier, typically within
**24 hours** of the inquiry.

The consumer never opted in, never heard of the buyer, and usually had no idea it was
even possible. They applied with one lender on Tuesday and got forty calls by Thursday.

This was legal under a provision of the Fair Credit Reporting Act permitting "firm
offers of credit" to be extended from prescreened lists.

### Why you need to understand this

**Because it explains the four transcripts in `07-teardowns/` completely.**

Look at what the originator knows before the borrower says anything:

> *"It showed me the current balance on the home right now is about 108."*
> *"It showed me your current payment is right around $1,550."*
> *"I'm just following up on a recent inquiry that was submitted."*
> *"We had received your information this morning from one of our correspondent lenders."*

He knows the balance, the payment, the property address, and the loan type. He did not
get that from a web form. That is a trigger lead, and "following up on your inquiry" is
the cover story built to explain how he got it without saying "the credit bureau sold me
your data twenty minutes ago."

That framing is why Paula in Call 2 reacts with such precision:

> *"I don't think that you received a correspondence from one of my 20-year lenders.
> Okay, you saw my credit score, that's all."*

**She knew exactly what had happened.** Consumers hated this practice, and the ones who
understood it found it genuinely invasive. That is why the law changed.

---

## 2. What the law does

The **Homebuyers Privacy Protection Act** (H.R. 2808, 119th Congress) was signed into
law on **September 5, 2025** and took effect **March 5, 2026**.

It amends the FCRA to prohibit consumer reporting agencies from furnishing trigger leads
to third parties, **except** in narrow circumstances. A recipient generally must have an
existing relationship with the consumer — specifically:

- The consumer has **expressly consented** to the solicitation, **or**
- The recipient **originated the current mortgage** on the property, **or**
- The recipient **services the current mortgage**, **or**
- The recipient is an **insured depository institution or credit union holding a current
  account** for the consumer

**Plain version:** if you have no pre-existing relationship with the consumer, you can no
longer buy their name off a credit-inquiry event. Their existing bank or servicer still
can.

---

## 3. What it did to the industry

- Some direct-to-consumer lenders and call centers had **10–30% of their pipeline**
  come from trigger leads. That vanished on a single day.
- **Internet lead costs rose roughly 45% year over year** as the buyers displaced from
  triggers piled into the remaining opt-in supply.
- Several state laws (Florida, Maine, and others) had already restricted trigger leads
  before the federal act; the federal law now sets a national floor.

**What this means for you personally:** your leads cost more than they did last year, and
so the tolerance for burning them is lower. A lead you dial twice and abandon is money
your broker spent. `06-cold-calling/35-aged-lead-playbook.md` and
`36-dialer-and-the-numbers.md` are about extracting full value from an expensive lead.

---

## 4. What is still legal

Plenty. The ban is narrow — it targets one specific data source.

| Source | Status | Notes |
|---|---|---|
| **Opt-in internet leads** | ✅ Legal | Consumer filled out a form. **Your primary source.** Keep the consent record. |
| **Aged internet leads** | ✅ Legal | Same origin, older. Watch DNC/EBR timing — see below. |
| **Your own past clients** | ✅ Legal | EBR runs **18 months** from last transaction. Your best asset. |
| **Your own database / sphere** | ✅ Legal | People who gave you their number |
| **Referral partners** | ✅ Legal | Realtors, CPAs, financial planners |
| **Public records / county data** | ✅ Legal, with care | Not a credit product — but still fully subject to DNC and mini-TCPA |
| **Inbound calls and web leads** | ✅ Legal | Consumer initiated |
| **Content, social, personal brand** | ✅ Legal | Slowest to build, best margins, cannot be banned |
| **Credit-bureau trigger leads** | ❌ **Banned** | Unless one of the four exceptions applies |
| **Prescreened "firm offer" mailing lists** | ⚠️ Narrowed | Still exists in limited form — **run any such program past compliance** |

---

## 5. The trap: aged leads and the three-month EBR

This is where you are personally most likely to get hurt, because it is your actual lead
source.

An internet lead is an **inquiry**. Under the Telemarketing Sales Rule, an
inquiry-based Established Business Relationship lets you call a number on the National
DNC Registry for **three months**. Not twelve. Three.

So for an aged lead:

| Lead age | On National DNC? | Callable? |
|---|---|---|
| 3 weeks | Yes | ✅ Yes — inquiry EBR is live |
| 3 weeks | No | ✅ Yes |
| 8 months | **Yes** | ❌ **No** — EBR expired. You need valid, current express written consent. |
| 8 months | No | ✅ Yes — but mini-TCPA consent rules may still apply |

**The operational rule:** for any aged lead, you need to know two things before you dial —
*is this number on the DNC Registry*, and *do we hold express written consent that is
still valid*. If the answer to the first is yes and the second is no, that record is not
callable no matter how good the lead looks.

Your lead vendor's opt-in language is the document that decides this. **Get a copy of
it.** Most LOs have never read the consent language behind the leads they dial daily,
which is why so many of them end up as named defendants.

---

## 6. What to say now instead

The trigger-lead opening is gone. Full scripts are in
`06-cold-calling/34-the-opening-script-book.md`; here is the principle.

### The dead opening

> ❌ *"I'm just following up on a recent inquiry that was submitted. Were you looking to
> pull some cash out of your home or purchase a new one?"*

Two problems. The lead source no longer exists in that form. And if they didn't submit an
inquiry, it's a false statement of material fact — a UDAAP issue that was already a
problem before the ban.

### The honest opening that works better

For a **real opt-in lead**, tell the truth, with specificity:

> ✅ *"Hi Michael, this is [Name] with [Company], NMLS [ID] — I'm on a recorded line.
> You filled out a request on [site] about [cash-out / a purchase] back on [date]. I know
> that was a while ago, so I'm sure a lot has changed. Is that still something you're
> looking at, or has that ship sailed?"*

Why this outperforms the dishonest version:

1. **It's true**, so it survives the "I never filled anything out" challenge — which
   destroyed Call 2.
2. **The specificity is the credibility.** Naming the site and date proves you're not
   random.
3. **"Has that ship sailed?"** is a takeaway. It gives them permission to say no, which
   paradoxically makes them far more likely to engage. See
   `05-sales/29-objection-mastery.md`.
4. It **announces the sales purpose**, satisfying the TSR disclosure requirement.

---

## 7. The bigger lesson

The trigger-lead era rewarded speed and volume: get the data, dial it in an hour, out-hustle
forty other callers. It did not reward relationships, because the lead was going to be
worthless by tomorrow anyway.

That era is over. The economics now reward the opposite: fewer, more expensive leads
worked more carefully; databases that compound; referral relationships; a personal brand
that generates inbound.

**The LOs who were only good at the trigger-lead game are struggling right now. That is
your opening.** You have no bad habits from that era to unlearn. Build for the world that
exists.

---

## What you must be able to do

- Explain what a trigger lead was and how to spot one in a script
- State the effective date and the four exceptions
- Explain why the three-month inquiry EBR is the key rule for aged leads
- Deliver an honest opening that survives "I never filled anything out"

**Self-check:** Your manager hands you a list with balances, rates, and property addresses
for people who applied elsewhere this week, and says a vendor supplies it. What do you do?

> *Do not dial it. Ask, in writing, what the source is and which HPPA exception applies.
> If the answer is vague, escalate to compliance. "My manager told me to" has never
> protected anyone's license.*

---

**Next:** `24-the-never-say-list.md`

---

### Sources

- [H.R.2808 — Homebuyers Privacy Protection Act, 119th Congress](https://www.congress.gov/bill/119th-congress/house-bill/2808)
- [Seven years in the making: the trigger leads victory — Mortgage Professional America](https://www.mpamag.com/us/specialty/wholesale/seven-years-in-the-making-the-trigger-leads-victory-that-changes-everything-for-homebuyers/565998)
- [Trigger leads ban signed into law — Garris Horn LLP](https://www.garrishorn.com/blog/8pxsn7kkxv9r7nk2szy53yzq6ywg59)
- [Mortgage trigger lead ban 2026: what loan officers need to do now — Aged Lead Store](https://agedleadstore.com/mortgage-trigger-lead-ban-2026/)
- [RIP trigger leads: what comes next for loan officers — Homebot](https://homebot.ai/blog/rip-trigger-leads-heres-what-comes-next-for-loan-officers)
