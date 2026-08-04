---
name: call-score
description: Score a real mortgage sales call transcript against the 110-point rubric with specific rewrites. Use when the user pastes a call transcript, asks for a call review, asks how a call went, or invokes /call-score.
---

# Call Score

Score a real call transcript the way the four source calls were scored in
`curriculum/07-teardowns/`.

## Before scoring

Read:
- `curriculum/08-drills/46-scoring-rubric.md` — the rubric
- `curriculum/04-compliance/24-the-never-say-list.md` — the compliance flags
- `curriculum/07-teardowns/43-what-the-four-calls-teach.md` — the five patterns to look for

If the user hasn't provided a transcript, ask for one. If they describe a call from memory,
score what you can and say which categories you couldn't assess.

## Output format

```
═══════════════════════════════════
CALL SCORE — [borrower name / date]
═══════════════════════════════════

[If any compliance auto-fail: state it here first, in bold, before anything else]

THE BORROWER
  [Facts table — balance, rate, value, income, purpose, credit events]
  [Flag anything material the LO collected and didn't use]

WHAT WENT RIGHT
  • [Specific, quoted. Be genuine — find real strengths.]

WHAT WENT WRONG
  ❌ [Quote the line]
     [Why it's a problem]
     ✅ [What to say instead — actual words]

COMPLIANCE FLAGS
  [Table: line → issue. Empty is a good outcome — say so.]

THE MOMENT THAT DECIDED IT
  [The single pivotal exchange, quoted, with the alternative]

SCORE
  Open __/10   Frame __/10   Facts __/10   Drivers __/10
  Diagnose __/10   Position __/10   Product __/10
  Tonality __/10   Listening __/10   Close __/10   Compliance __/10
  TOTAL __/110  — Grade _

THE ONE THING
  [Single highest-value fix. One.]
  → curriculum/[file]
```

## Scoring principles

**Be honest.** The four source transcripts scored 33–49 out of 110 from an originator with
genuinely good instincts. Inflated scores are worthless.

**Quote everything.** Never say "the discovery was weak." Quote the exchange and show what
should have happened.

**Give words, not concepts.** Every ❌ needs a ✅ with actual sentences.

**Find real strengths.** There are always some, and he'll take the criticism better if the
praise is specific and true.

## The compliance override

**If Compliance scores 0, the call fails regardless of total.** Lead with it:

> **FAIL — COMPLIANCE.** Nothing else in this review matters until this is fixed.

Auto-zero conditions:
- Claimed a lead source that isn't true
- Continued pitching past a clear revocation
- Promised a specific rate before credit and pricing

## The five patterns to check for

From `curriculum/07-teardowns/43-what-the-four-calls-teach.md`. Check every transcript
against these — they're the failures that recur:

1. **Did he ask what the money is for?** (All four transcripts failed this.)
2. **Did he handle a legacy rate honestly?** If the borrower holds sub-4.5% and he implied
   he could lower it, Diagnose = 0.
3. **Did he raise the second lien?** If the borrower has a legacy rate and equity and this
   never came up, Product ≤ 3.
4. **Did he listen when the borrower disclosed something?** Time horizons, credit events,
   life events. If he talked past it, Listening ≤ 2.
5. **Did he end with time + task + channel?** (All four transcripts failed this.)

## Tonality from text

You can't hear the call. Infer from tells and **say that you're inferring**:

| Tell | Likely problem |
|---|---|
| Heavy filler ("okay, beautiful" repeatedly) | On rails, not listening |
| Interrupting mid-story | Rushed, anxious |
| Long unbroken monologues | Talking too much |
| Answering his own questions | Can't tolerate silence |
| Hedges — "kind of," "maybe," "I think" | Low certainty |
| Re-selling a point already agreed to | Not hearing the yes |

Then note: *"To actually coach your tonality I need audio — see
`curriculum/10-reference/53-gaps.md`."*

## Tracking

If he's scored calls before, compare to the last one and name the trend. The point of this
skill is a rising line over a quarter, not a single verdict.
