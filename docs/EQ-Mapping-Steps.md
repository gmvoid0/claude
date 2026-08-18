# Mapping Easy Qualifier — what I need you to do

**Time it takes:** about five minutes, once. **You do not need to know any code.**

I can't see Easy Qualifier — it's behind your broker login — so I can't find out
what its fields are called. This is a small script that reads the *names* of the
boxes on the screen and hands them back to me. Then I can teach S.A.M where to
put an application.

---

## Before you start — what this does and doesn't do

**It reads:** the names of the fields, and what's inside the dropdowns (the list
of loan types, occupancy, property type, and so on). That's the map.

**It never reads what you typed.** Not a borrower name, not an income figure,
not a rate. Each box comes back as "empty" or "has something in it" and nothing
more.

**It never touches your login.** No cookies, no tokens, no saved passwords.
Password boxes are skipped entirely.

**It never sends anything anywhere.** There is not a single network call in the
file. What it collects sits in that one browser tab until *you* press Copy, and
disappears when you close the tab.

**It never changes or submits anything.** It only looks.

If you'd rather not have real borrower data on screen while you do this, use a
made-up scenario. It makes no difference to the map.

---

## The steps

### 1. Open Easy Qualifier
Log into UWM as normal and start a scenario. Fake numbers are fine — a
$400,000 house with a $270,000 payoff, VA, cash-out. It doesn't have to be real
and you never have to submit it.

### 2. Open the console
Press **F12**.
*(On a Mac: hold **Cmd + Option + I**.)*

A panel opens, usually on the right or the bottom. Click the tab that says
**Console**.

### 3. Click into the console and paste the script
Open the page S.A.M sent you and press **Copy script**. (Or open
`tools/eq-probe.js`, select all with **Ctrl + A** / **Cmd + A**, and copy.)

Then click the empty space next to the `>` symbol in the console, paste, and
press **Enter**.

> **If it says "Allow pasting" or "Don't paste code you don't understand":**
> that's Chrome protecting you. Type the words `allow pasting` and press Enter,
> then paste the script again. You only ever have to do this once.

### 4. Look for the black box
A small black box appears in the bottom-right corner of the page:

```
S.A.M — mapping Easy Qualifier
1 screen, 24 fields
```

That means it's working. **Leave it there.**

### 5. Click through the form once
Fill in your scenario and let every field appear. Some of EQ's boxes only exist
once a program is chosen — VA Use Type shows up when VA is selected, and the
funding-fee box with it.

### 6. Press "Read all dropdown lists"
This is the important one. It opens each dropdown, reads what's inside, and
presses Escape — about fifteen seconds, and you'll watch them blink open and
shut. It **picks nothing**, and it checks each field before and after to prove
your selection didn't move.

> This is the only part of the script that touches the page. Everything else
> just looks. If you'd rather it didn't click around a real scenario, put a
> made-up one in first.

### 7. Get a quote, then press "Read the results"
Press whatever button EQ uses to price it. Once the rates are on screen, press
**Read the results**. It records the column headings and replaces every digit
with a `#`, so the structure comes back without the pricing.

### 8. Press "Copy all & finish"
It'll say something like `Copied 61KB`.

### 9. Paste it back to me
Straight into the chat. If it's too big, press **Save as a file** and send me
`eq-map-<date>.json`.

### 10. Close the box
Click **close** at the bottom of the black box, then press F12 again to shut the
console. Nothing is left behind.

---

## If something goes wrong

**Nothing happened when I pressed Enter.**
Look for red text in the console and send me a photo of it.

**The black box never appeared.**
You may be on a page inside a frame. Above the console input there's a dropdown
that usually says `top` — click it, pick the entry that looks like the Easy
Qualifier page, and paste the script again.

**It says 1 screen and never goes up.**
Click **Capture this screen** by hand on each screen instead. Same result, just
manual.

**The counter is going up but the fields look wrong to me.**
Send it anyway. I can tell from the output whether it read the page properly,
and a bad map is still better than no map for working out what to fix.

---

## What happens next

I turn what you send into a mapping file, and S.A.M gets a **To UWM** button:
it takes the application you've already filled in on the call and drops it into
Easy Qualifier's fields in one go — you check it and press Quote yourself.

Per your own spec, it stops there. It won't auto-submit, it won't hold your
credentials, and it won't make any request to UWM in the background. If UWM
changes the page and the map stops matching, the button says so and falls back
to copying the scenario to your clipboard rather than filling in the wrong
boxes.
