# Cold Calling Law

**Status: as of August 2026.** Telemarketing law moves fast. Re-verify before you change
your dialing practices, and run anything structural past your compliance officer.

This is the document that keeps you employed and licensed. Read it twice.

---

## Why this matters more to you than to almost anyone else

Telemarketing violations are **per-call** and **statutory**. That means the plaintiff
does not have to prove they were harmed — they just have to prove you called. Federal
TCPA damages run **$500 per call**, trebled to **$1,500** for willful violations. State
mini-TCPA statutes range **$500 to $20,000 per violation**.

Do the math on a dialer that makes 300 calls a day. A single systematic mistake — a bad
list, a missed scrub, calling an hour too early in the wrong state — is not a
"compliance issue." It is a company-ending event, and there is an entire plaintiff's bar
whose full-time job is finding it.

There are also two mechanisms that reach *you personally*, not just your company:

1. **Your NMLS license.** State regulators discipline originators for deceptive
   solicitation. A revocation follows you across every state and effectively ends the
   career.
2. **Individual liability.** Courts have held individual callers and their supervisors
   personally liable under the TCPA in some circumstances.

Your broker's E&O policy is not a force field. Act accordingly.

---

## The four separate bodies of law

Beginners think of this as one rule. It's four, and you have to clear all of them.

| # | Body of law | Who enforces | What it governs |
|---|---|---|---|
| 1 | **TCPA** (federal) | FCC + private lawsuits | Consent, autodialers, prerecorded calls, revocation |
| 2 | **TSR / Do Not Call** (federal) | FTC | The National DNC Registry, calling hours, disclosures |
| 3 | **State mini-TCPA** | State AGs + private suits | Stricter hours, call caps, consent — **often stricter than federal** |
| 4 | **UDAAP + state MLO rules** | CFPB, state regulators | Whether what you *said* was deceptive |

Clearing federal law and failing state law is the most common way brokers get hurt.
**The rule that applies is the strictest one that touches the call.**

---

## 1. TCPA — where it stands right now

### The one-to-one consent rule is dead

In December 2023 the FCC adopted a rule requiring "one-to-one" consent — a consumer
would have had to consent to each specific seller by name, killing the lead-generation
model where one form authorizes dozens of "marketing partners."

On **January 24, 2025**, the Eleventh Circuit **vacated** that rule in *Insurance
Marketing Coalition v. FCC*, holding the FCC exceeded its statutory authority. The FCC
formally removed the nullified rule in **July 2025**.

**What that means for you:** the consent standard reverted to the pre-2023 status quo —
**prior express written consent**, without the one-to-one constraint. The bundled
"marketing partners" consent that most internet lead vendors use is, at the federal
level, viable again.

**Do not read this as "consent doesn't matter."** It reverted to the old standard; it
did not disappear. And several states have their own one-to-one requirements that the
Eleventh Circuit ruling does not touch.

### The revocation rules

This is the part most likely to bite you personally, because it happens in conversation.

The FCC's rules require that you honor a revocation of consent made through **any
reasonable means**. There is no magic word. All of these are revocations:

> "I'm not interested."
> "Take me off your list."
> "Stop calling me."
> "Remove my number."
> "I don't want these messages."
> "Don't text me."

The broader **"revocation-all"** requirement — that revoking consent for one type of
message revokes it across *all* messages from that sender — was scheduled for April 2026
but the FCC **delayed it to January 31, 2027**. Assume it is coming, and build the habit
now.

**Operational rules:**
- Revocation must be honored **within 10 business days**.
- You may send **one** confirmation message. That's it.
- You may **not** require a specific keyword, a specific channel, or a form.
- Log every revocation in your CRM **the moment it happens**, with a timestamp.

### The line you must not cross in conversation

This is where the transcripts in `07-teardowns/` go badly wrong.

In Call 2, the borrower says **"I'm not interested"** in the first ten seconds. She then
says it two more times, plus "I don't need anything," "I don't want a mortgage from you
guys," and "Listen to what I'm saying." The originator keeps pitching and eventually
converts her into full discovery.

Commercially, that's impressive. Legally, it is the most dangerous thing in all four
transcripts.

**The workable standard:**

- **One** reframe after an initial soft "not interested" is generally defensible. A
  reflexive brush-off is not always a considered revocation, and asking one clarifying
  question is normal commercial behavior.
- After a **second** clear refusal, you stop. Not "pivot." Stop.
- If they use words about the *list* or the *calling itself* — "take me off," "stop
  calling," "remove me" — you stop **immediately**, at the first instance. That is
  unambiguous revocation, not a sales objection.

> **The distinction to hold in your head:** "I'm not interested in refinancing" is a
> sales objection about the product. "I'm not interested — stop calling me" is a
> revocation about the contact. The first you may work. The second ends the call.

---

## 2. Do Not Call — the federal baseline

### Registry scrubbing

- The **National DNC Registry** must be scrubbed against every list you call.
- Rescrub at least every **31 days**. Most dialers do this automatically — *verify that
  yours does*, in writing, and know who at your shop owns it.
- Maintain your company's **internal DNC list** separately and forever.

### The exemptions — and their limits

You may call a number on the Registry if:

| Exemption | Duration | Watch out |
|---|---|---|
| **Express written consent** | Until revoked | Must be verifiable; keep the record |
| **Established Business Relationship (EBR)** — inquiry | **3 months** from the inquiry | Short. Aged leads blow through this fast. |
| **EBR — transaction** | **18 months** from last transaction | Your funded past clients |

**Read that EBR-inquiry line again: three months.** This is the single most misunderstood
rule among LOs working aged leads. A 6-month-old internet lead on the DNC Registry is
**not** callable under an inquiry EBR — that window closed. You need express written
consent that is still valid, and you need to be able to produce it.

### Federal calling hours

**8:00 a.m. to 9:00 p.m. in the *called party's* time zone.**

Their time zone, not yours. If you're dialing from Michigan at 8:15 a.m., you are
calling California at 5:15 a.m. That is a violation, and area code is an unreliable
proxy for location in the cell phone era — millions of people carry numbers from states
they left a decade ago.

### Required disclosures on every call

Within the first moments of a telemarketing call you must **truthfully** state:

1. Your **name**
2. The **name of the company** on whose behalf you're calling
3. That the purpose of the call is to **sell goods or services**

Point 3 is where most mortgage cold calls quietly fail. "I'm following up on an inquiry"
is a framing designed to *avoid* announcing a sales purpose. See the Never-Say List.

**Additionally, for you specifically:** most states require a licensed MLO to provide
their **NMLS unique identifier** in solicitations, and many require it verbally on
request. None of the four transcripts contain an NMLS ID. Get yours into your opening or
have it ready instantly. `[Confirm your specific states' requirements with compliance.]`

---

## 3. State mini-TCPA — the real risk surface

Since you are **multi-state licensed**, this section is your biggest exposure, and it is
the part this system cannot finish for you until you tell it which states.

States with active, aggressive mini-TCPA statutes as of 2026 include **Florida,
Oklahoma, Maryland, Washington, and New Jersey**. Others have narrower rules.

### What they add on top of federal law

| Restriction | Detail |
|---|---|
| **Narrower calling hours** | FL and MD restrict to **8 a.m.–8 p.m.** local — you must stop **an hour earlier** than federal law allows |
| **Daily contact caps** | FL, OK, and MD limit same-subject contact to **three attempts in a day** |
| **Consent standards** | Some states impose their own one-to-one-style requirements the 11th Circuit ruling did not disturb |
| **Damages** | **$500 to $20,000 per violation**, with private rights of action |

Florida's FTSA and Oklahoma's OTSA in particular have generated heavy litigation.

### The practical operating rule

Build your dialer around the **strictest** rule among the states you call, not the
federal floor. If you call Florida at all:

- Stop calling at **8:00 p.m. local**, everywhere. One rule is easier to follow than
  five.
- Cap at **3 attempts per person per day**, everywhere.
- Determine location by **verified address**, not area code.

The cost of the stricter standard is a handful of dials. The cost of the looser one is a
class action.

> **Action item:** tell your coach which states you are licensed in and which states your
> lead lists cover. Those are two different questions and the answer to the second one is
> what actually governs. Until then, this section stays generic.

---

## 4. Recording calls — two-party consent

You should be recording your calls. It is the fastest way to improve, and `call-score`
runs on the transcripts.

But recording law is state-by-state:

- **One-party consent** states: you may record because *you* are a party.
- **Two-party (all-party) consent** states: **every** party must consent. These include
  California, Florida, Pennsylvania, Illinois, Washington, Massachusetts, Maryland, and
  others.

**When in doubt, disclose.** It costs you nothing:

> "Just so you know, this call is recorded for quality and training purposes."

Most companies require this anyway. Say it, log it, move on. Recording an unconsented
call in a two-party state is a **crime** in some jurisdictions, not merely a civil
matter.

---

## 5. UDAAP — the rule that catches what the others miss

**Unfair, Deceptive, or Abusive Acts or Practices.** The CFPB's catch-all. It doesn't
care about your dialer settings; it cares about whether what you *said* was misleading.

A practice is **deceptive** if it is likely to mislead a reasonable consumer and is
material to their decision. Note what is *not* required: intent, or actual harm.

**What this catches in real mortgage cold calls:**

| What was said | Why it's a problem |
|---|---|
| "I'm following up on the inquiry you submitted" (they didn't) | Misrepresents the origin of the contact |
| "You sent us information" after they deny it | Doubling down on a false statement of fact |
| "I know for a fact I can beat that rate" (no credit pulled) | Unsubstantiated promise of a material term |
| "We take scores as low as 500" (stated without the 10%-down and overlay reality) | Technically true, materially misleading |
| "My manager will match it, but only if we lock today" (no such policy) | Fabricated authority and urgency |

Every one of those appears in the four transcripts. All five are dissected in
`24-the-never-say-list.md`.

---

## 6. Your daily compliance checklist

Print this. Tape it to your monitor.

**Before the first dial**
- [ ] List scrubbed against National DNC within 31 days
- [ ] List scrubbed against company internal DNC
- [ ] Consent records exist and are current for every record
- [ ] Time zones verified by address, not area code

**On every call**
- [ ] Name, company, and sales purpose stated truthfully up front
- [ ] NMLS ID available and given when required
- [ ] Recording disclosed if any party may be in a two-party state
- [ ] No rate promised before credit and pricing
- [ ] Nothing said about the lead's origin that isn't literally true

**The instant you hear a revocation**
- [ ] Stop pitching
- [ ] "Understood — I'll take you off our list. Sorry to have bothered you."
- [ ] Log it in the CRM with a timestamp, before the next dial
- [ ] Add to internal DNC

**End of day**
- [ ] All revocations logged
- [ ] No call attempts outside 8 a.m.–8 p.m. local
- [ ] No number contacted more than 3 times

---

## What you must be able to do

- State the federal calling window and whose time zone governs
- Explain why a 6-month-old internet lead on the DNC Registry may not be callable
- Recognize a revocation and distinguish it from a sales objection
- Name the three disclosures required at the top of a telemarketing call
- Explain what UDAAP catches that the TCPA doesn't

**Self-check:** A borrower says *"I already have a lender, I'm not interested."* Is that
a revocation? What do you say next?

> *Not a revocation — it's a product objection with a reason attached. One reframe is
> fair: "Understood — I'm not asking you to leave them. Can I ask one thing: is your rate
> locked yet?" If the answer comes back as another clear refusal, you're done.*

---

**Next:** `20-the-trigger-lead-ban.md`

---

### Sources

- [FCC extends limited waiver for part of the TCPA consent revocation rule — Wiley](https://www.wiley.law/alert-FCC-Extends-Limited-Waiver-for-Part-of-the-TCPA-Consent-Revocation-Rule)
- [The TCPA in 2026: one-to-one consent vacated, revocation-all delayed — ComplianceHub](https://compliancehub.wiki/tcpa-2026-consent-revocation-one-to-one-rule-vacated-compliance/)
- [Understanding the FCC one-to-one consent rule update — ActiveProspect](https://activeprospect.com/blog/fcc-one-to-one-consent/)
- [State mini-TCPA laws: 2026 compliance guide — AvairAI](https://www.avair.ai/resources/blog/state-mini-tcpa-laws-guide)
- [State mini-TCPA laws: Florida FTSA, Oklahoma OTSA — Leadgen Economy](https://www.leadgen-economy.com/blog/state-mini-tcpa-laws-ftsa-otsa/)
- [TCPA & outbound calling: 2026 state law guide — MediaVault](https://www.mediavaultplus.com/post/tcpa-outbound-calling-state-laws)
