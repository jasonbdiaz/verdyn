# Verdyn — Brand Guidelines

> **Verdyn** turns any Orbit B-hyve controller into a pro-grade turf agronomist.
> Connect your existing account, answer a few questions about your lawn, and
> Verdyn waters smarter — automatically, every day, within your local rules.

---

## 1. The Name

**Verdyn** — a coinage of **verd**ant (lush, green, growing) + **dyn**amic
(intelligent, adaptive, alive).

- Pronounced **VER-din**.
- Always capitalized **Verdyn**. Never "VerDyn", "Verdin", or "verdyn" in body copy
  (lowercase is permitted only inside the logotype lockup).
- We are **not** affiliated with Orbit or B-hyve. We never use "hive" in our name,
  logo, or domains — Verdyn is an independent layer on top of B-hyve. Always refer
  to the controller as "your B-hyve®" with the third-party-compatible disclaimer.

### Why not "SmartHyve"?
The working title leaned on the B-hyve trademark. A sellable product cannot build
equity on a name it does not own and which infringes Orbit's mark. **Verdyn** is
ownable, trademark-safe, and describes the *outcome* (a verdant lawn) rather than
the *hardware*.

---

## 2. Positioning

| | |
|---|---|
| **One-liner** | Pro-grade irrigation intelligence for any B-hyve. |
| **Tagline** | *Water like a pro.* |
| **Category** | Smart-irrigation optimization (software, BYO-hardware) |
| **For** | The 1M+ homeowners who own a B-hyve controller |
| **Who** | want a healthier lawn without becoming an agronomist |
| **Unlike** | the stock B-hyve app's generic "smart watering" |
| **Verdyn** | builds a daily plan from your grass, soil, climate, and local water rules — and adapts it to the weather automatically. |

### Elevator pitch
> You already bought the smart sprinkler timer. Verdyn is the brain it was missing.
> Tell us your grass type and ZIP code; we handle the rest — runtime math,
> cycle-and-soak, rain skips, heat bumps, wind holds, and your city's watering
> restrictions. Pros call it deficit irrigation and ET-based scheduling. You'll
> just call it the best your lawn has ever looked.

---

## 3. Logo

The mark is a **droplet-leaf**: a water droplet whose lower-left curve lifts into
a leaf tip — water and growth as one form. Files in `brand/`:

- `logo-mark.svg` — the droplet-leaf symbol only (favicon, app icon)
- `logo-full.svg` — symbol + "Verdyn" wordmark (horizontal lockup)
- `logo-wordmark.svg` — wordmark only

### Clear space & minimums
- Keep clear space ≥ the height of the "V" on all sides.
- Minimum mark size: 24px digital. Minimum full lockup: 120px wide.

### Don'ts
- Don't recolor the mark outside the palette.
- Don't add a hive, bee, or honeycomb.
- Don't stretch, rotate, or add drop-shadows to the wordmark.

---

## 4. Color

| Token | Hex | Use |
|---|---|---|
| **Verdyn Green** (primary) | `#0E7C5A` | Brand, primary buttons, links |
| **Sprout** (accent) | `#8BE04A` | Highlights, "smart" callouts, charts |
| **Deep Pine** (ink) | `#08231B` | Headlines, body text on light |
| **Tide** (secondary) | `#16B6C4` | Water/weather data, info states |
| **Mist** (surface) | `#F4FAF6` | App background |
| **Cloud** (card) | `#FFFFFF` | Cards, sheets |
| **Clay** (warn) | `#E8A13A` | Adjusted / caution states |
| **Ember** (alert) | `#E5544B` | Skips, failures, urgent |

Gradient (hero, app icon): `#0E7C5A → #8BE04A` at 135°.

Dark mode: ink becomes `#E8F3ED`, surface `#08231B`, card `#0F3329`.

---

## 5. Typography

- **Display / headings:** *Space Grotesk* (geometric, confident, a little technical).
- **Body / UI:** *Inter* (neutral, legible at small sizes).
- **Numerals / data:** *Inter* tabular figures for runtimes and weather.

Scale (web, rem): 3.5 / 2.5 / 2 / 1.5 / 1.25 / 1 / 0.875.
Headings: tight tracking (-0.02em). Body: 1.6 line-height.

---

## 6. Voice & Tone

**Expert, but never condescending. Plain-spoken with a pro's confidence.**

- Say *"We'll halve runtime — it rained 0.3" overnight,"* not *"Weather adjustment applied."*
- Teach in passing: name the agronomy ("cycle-and-soak prevents runoff") so users
  feel smarter, then get out of the way.
- Celebrate wins quietly. The lawn is the hero, not the app.

**Words we use:** turf, runtime, cycle, soak, deficit, root zone, ET, syringe.
**Words we avoid:** "magic", "effortless" (overused), anything implying we control
the hardware we don't own.

---

## 7. Product surfaces

- **Marketing site** — `verdyn.com` (the pitch, pricing, onboarding entry)
- **Web app** — `app.verdyn.com` (dashboard, plan, settings)
- **iOS app** — "Verdyn" (onboarding, daily plan, notifications)

All three share one engine (`packages/core`) so the agronomy is identical everywhere.

---

## 8. Legal footer (every surface)

> Verdyn is an independent product and is not affiliated with, endorsed by, or
> sponsored by Orbit Irrigation Products, LLC. B-hyve® is a registered trademark
> of Orbit. Verdyn connects to your B-hyve account using credentials you provide.
