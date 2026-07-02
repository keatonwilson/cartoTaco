# CartoTaco UI & Data-Viz Refresh Plan

A design-and-visualization refresh plan for CartoTaco. Goal: make the app feel
**modern, fresh, and fun** while doubling down on its identity as a
*data-viz-first* taco atlas. Every item below works entirely from data already
in the database — no net-new data collection.

Ratings used throughout:

- **Impact**: how much the change moves "modern / fresh / fun" or unlocks other work — High / Medium / Low
- **Difficulty**: implementation risk + surface area — Low / Medium / High, with a rough effort estimate

---

## 1. Current-State Assessment

### What's working

- **Data architecture is excellent.** One `sites_complete` view → one fetch →
  derived stores (`processedTacoData`, `filteredTacoData`, `summaryStats`).
  Components consume pre-computed values. Any new viz below is a derived store
  plus a component — no backend work.
- **Feature depth is unusual for a hobby-scale app**: trail builder, comparison,
  taste profile with k-NN recommendations, ranked-choice group voting, vibe
  votes, onboarding tour, dark mode. The refresh should *unify* these, not add
  more mechanics.
- **SummitResults** is the best chart in the app today: a proper stacked bar
  with an ordinal orange ramp, direct labels, theme-reactive. It's the quality
  bar the rest should meet.

### Design debt inventory (what's holding the app back)

| # | Finding | Evidence |
|---|---------|----------|
| A1 | **No design tokens.** The brand coral `#FE795D` is hardcoded ~215 times across 31 files; a second accent `#FF9800` competes with it in protein chips and type bars. `app.css` defines CSS variables that components mostly ignore. | `grep -c '#FE795D' src` → 31 files |
| A2 | **Dark mode is hand-rolled per component** via `:global(.dark)` overrides — hundreds of duplicated lines, each a chance to drift. | `Card.svelte`, `TasteProfile.svelte`, etc. |
| A3 | **Default typography.** Arial-first stack, no display face, no tabular numerals for data. Nothing about the type says "taco" or "map" or "fun". | `src/routes/styles.css` (dead), no font imports in `app.css` |
| A4 | **Three chart libraries for five charts.** Chart.js (radar, salsa bar, scatter) + ECharts (gauge, summit bars); `chartjs-gauge`, `svg-gauge`, `svelte-chartjs` are in `package.json` but **never imported**. Tooltips, fonts, and animation feel different chart to chart. | `package.json`, grep confirms zero imports |
| A5 | **Flowbite is a dependency for one component.** `flowbite-svelte` is imported once (`SpecCard`'s `<Card>`); `flowbite`, its Tailwind plugin, and `flowbite-svelte-icons` (18 files) ride along. Two icon systems (Flowbite + Phosphor) mix in the same header. | grep: 1 import of `flowbite-svelte`, 18 of icons |
| A6 | **Dead code**: `src/routes/styles.css` (SvelteKit demo boilerplate incl. `--color-theme-1: #ff3e00` — the Svelte demo palette — and `@fontsource/fira-mono` which isn't even installed) is not imported anywhere. Its dark-mode Mapbox control styles are dead too. | no `styles.css` import anywhere |
| A7 | **Radar charts aren't comparable across spots.** Each card's radar shows that spot's own top-5 axes *and* a per-spot dynamic max (50 or 75), so two radars side by side (especially on `/compare`) have different axes and different scales — shape comparison is misleading. | `RadarChart.svelte:13-14`, `compare/+page.svelte` |
| A8 | **The spice gauge fights the brand.** Multi-hue ramp (gold → pink-red → burnt orange), a needle, tiny 12px value — a dated "dashboard widget" look, hardcoded colors unrelated to the palette. | `SpiceGauge.svelte:51-56` |
| A9 | **Rich salsa data is invisible.** The view exposes 8 named salsa varieties (`verde/rojo/pico/pickles/chipotle/avo/molcajete/macha`) plus up to 3 "other" salsas **each with its own name, heat level, and description** — the UI shows only a count and one overall heat number. This is the largest untapped dataset in the app. | `schema/sites_complete_view.sql:111-140` |
| A10 | **Dated UI idioms**: flashing text-shadow "Open Now" animation, strikethrough day letters for closed days, two separate min/max sliders for one spice range, plain-text "Loading data..." states. | `HoursOpen.svelte:104-126`, `FilterBar.svelte:250-273` |

### Verdict

The bones are great; the skin is inconsistent. The highest-leverage move is a
**foundation pass (tokens + type + one chart system)** followed by a **card-level
viz refresh** that surfaces data the app already owns. Nothing here requires
touching the database beyond what exists.

---

## 2. Refresh Principles

1. **The data is the decoration.** CartoTaco's personality comes from charts,
   numbers, and the map — lean into stat tiles, hero numbers, and distribution
   context ("spicier than 82% of Tucson") instead of decorative imagery.
2. **One accent, used with intent.** Coral `#FE795D` is the brand. Everything
   else in a chart earns its hue from a *job* (identity, magnitude, polarity,
   status) — never decoration. Categorical hues are assigned in fixed order and
   follow the entity (chicken is always the same color everywhere).
3. **Warm Sonoran, not corporate SaaS.** Cream/paper surfaces in light mode,
   deep warm grays in dark mode, a display typeface with character. Fun comes
   from motion and copy, not from rainbow palettes.
4. **Comparable by construction.** Same axes, same scale, same colors wherever
   two spots can be seen together (A7 is a correctness fix, not just polish).
5. **Text wears text colors.** Values, labels, and legends stay in ink tokens;
   a colored mark next to them carries identity. Direct-label the few marks
   that matter; never a number on every point.

---

## 3. Track F — Foundation (do first; everything else compounds on it)

### F1. Design token system
**What**: Promote `app.css`'s existing CSS variables into a real token set
(surface/ink/accent/status + chart tokens), map them into
`tailwind.config.js` (`colors: { surface: 'var(--surface-1)' … }`), and migrate
components from hardcoded hexes to tokens as they're touched. Standardize the
accent on the coral scale already defined in Tailwind's `primary` (50–900);
retire the competing `#FF9800` amber (protein chips move to `primary-600`/ink).
Delete dead `src/routes/styles.css`.

**Why**: Kills A1/A2/A6. Dark mode becomes "tokens flip, components don't
change", ending the `:global(.dark)` duplication for new code. Every following
item gets cheaper.

- **Impact: High** — unblocks every other item; instantly improves consistency.
- **Difficulty: Medium** (~1–2 days for tokens + high-traffic components; long tail migrates opportunistically)

### F2. Typography upgrade
**What**: Self-host two faces via `@fontsource`:
- **Display** — *Bricolage Grotesque* (headings, spot names, hero numbers):
  warm, slightly quirky, very "independent food guide", excellent at heavy weights.
- **Text/UI** — *Inter* (body, labels, chart text) with `font-variant-numeric:
  tabular-nums` on all stat/number elements.

Define `--font-display` / `--font-text` tokens, wire into Tailwind
`fontFamily`, and give hero numbers (salsa count, heat, census stats) a
consistent big-number treatment (display face, `primary-600`, tight leading,
small uppercase ink-muted label).

**Why**: The single fastest "modern + fresh" win in the whole plan; currently
the app renders in Arial. Tabular numerals make every stat and count feel
engineered.

- **Impact: High** — transforms perceived quality at a glance.
- **Difficulty: Low** (~½–1 day; fonts are additive, no layout rework required)

### F3. One chart system + shared chart theme
**What**: Standardize on **ECharts** (already powers the two most complex
charts). Port the three Chart.js charts (radar ×2 usages, salsa bar, taste
scatter) and delete `chart.js`, `chartjs-plugin-annotation`, `svelte-chartjs`,
`chartjs-gauge`, `svg-gauge` (the last three are already unused — remove today).
Create `src/lib/chartTheme.js` exporting a theme built from the CSS tokens:
fonts (F2), ink/grid colors, the categorical palette (F4), a single tooltip
style, and standard mark specs (2px lines, thin bars with 4px rounded data-ends,
≥8px hover targets). Every chart component consumes it.

**Why**: Kills A4. One bundle instead of two-plus, and every chart finally
looks like it came from the same product. The gauge/salsa replacements in V2/V3
become trivial once the theme exists.

- **Impact: High** — consistency + meaningful bundle reduction on every page.
- **Difficulty: Medium** (~2 days; scatter and radar ports are mechanical, verify tooltips/resize behavior)

### F4. Validated chart palettes (values ready to paste)
**What**: Adopt the following palettes, validated with a CVD/contrast/lightness
checker against the app's real surfaces (white light / `#1f2937` dark):

**Categorical** — fixed order, color follows the entity. Order matches the
protein taxonomy so chicken/beef/pork/fish/veg are stable everywhere
(radar overlays, census bars, compare columns):

| Slot | Entity anchor | Light (`#fff`) | Dark (`#1f2937`) |
|------|---------------|----------------|------------------|
| 1 | brand / primary series | `#FE795D` | `#E85535` |
| 2 | series 2 | `#2A9D8F` | `#2A9D8F` |
| 3 | series 3 | `#E9A03B` | `#C2851A` |
| 4 | series 4 | `#6366F1` | `#7C7FF2` |
| 5 | series 5 | `#B5179E` | `#C75DA8` |

Both sets pass lightness-band, chroma, adjacent-pair CVD separation, and
contrast checks (light mode carries a contrast WARN on slots 1/3 — legal
because our charts direct-label; keep doing so).

**Sequential (magnitude — heat, density, percentiles)**: the existing Tailwind
`primary` coral scale, light→dark (`primary-100` → `primary-900`). One hue only —
this replaces the gauge's gold/pink/orange ramp (A8).

**Status**: keep `--success`/`--error` for open/closed and toasts only; never
reuse them as series colors.

- **Impact: Medium-High** — correct-by-construction color everywhere; accessibility for free.
- **Difficulty: Low** (already validated; ~an hour to encode in `chartTheme.js`)

### F5. One icon system
**What**: Standardize on **Phosphor** (duotone as the accent style — already the
most-used and most distinctive). Replace the 18 files using
`flowbite-svelte-icons`, rebuild `SpecCard`'s lone Flowbite `<Card>` with ~20
lines of markup, then drop `flowbite`, `flowbite-svelte`,
`flowbite-svelte-icons` and the Flowbite Tailwind plugin.

**Why**: Kills A5. One icon voice, three dependencies and a Tailwind plugin
removed, smaller CSS scan surface.

- **Impact: Medium** — subtle but pervasive polish; real dependency diet.
- **Difficulty: Low-Medium** (~1 day; mechanical swaps, verify the Tailwind config after plugin removal)

---

## 4. Track V — Refresh the Existing Visualizations

### V1. Radar → comparable "Taco Fingerprint"
**What**: Keep the radar — it's the app's signature mark — but make it honest
and consistent:
- **Fixed axes for protein radar** (chicken/beef/pork/fish/veg, always all 5,
  same order) and a **fixed 16-item-derived top-N convention for menu** with a
  **fixed 0–100 scale** (drop the per-spot dynamic max — A7). Shapes become
  comparable across cards, compare view, and taste profile.
- Restyle per mark spec: 2px brand line, 12% fill, points appear on hover only,
  per-axis tooltip retained.
- On `/compare`, render **one radar with 2–3 overlaid series** (categorical
  slots 1–3, series named by spot, legend + direct end-labels) instead of three
  disconnected radars — see N6.

**Why**: Fixes the one genuine *correctness* issue in the current viz while
strengthening the brand's most recognizable element.

- **Impact: High** — the radar appears on card, compare, and taste profile; comparability is a real fix.
- **Difficulty: Medium** (~1–2 days incl. the ECharts port from F3)

### V2. SpiceGauge → "Heat Ladder" stat tile
**What**: Replace the needle gauge with a compact, hand-rolled SVG **10-notch
heat ladder** (thin segments, filled with sequential coral steps up to the
value, rounded data-end) + hero number treatment ("7 / 10", display face) +
context line from data: *"Hotter than 82% of Tucson spots"* (percentile from
`summaryStats`/distribution, see N4). Keep the existing text descriptors
("Medium-Hot").

**Why**: A8. Gauges spend pixels on chrome (arcs, ticks, needles) to encode one
number. A notched ladder + hero number is clearer, brand-colored, weighs ~0 KB,
and the percentile line adds actual information.

- **Impact: High** — on every card, compare column, and taste profile.
- **Difficulty: Low-Medium** (~1 day; pure Svelte/SVG, deletes an ECharts gauge instance)

### V3. SalsaCount → true bullet bar with distribution context
**What**: Rebuild as a proper bullet chart in SVG: track = city max, subtle
tick = city average, bar = this spot (thin mark, rounded end, direct label).
Optionally a faint dot-strip of all spots' salsa counts behind the bar so the
spot reads against the whole city. Kills the Chart.js+annotation dependency use.

**Why**: The current implementation fakes a bullet chart with a stacked bar and
an annotation plugin; the "Mean" pill label is illegible at 50px height. This is
a 3-value display — it should cost 3 marks.

- **Impact: Medium** — sharper and instantly readable on every card.
- **Difficulty: Low** (~½ day once F3/F4 exist)

### V4. HoursOpen → "Week Rhythm" strip
**What**: Redesign the hours block as 7 day pills (Mo–Su) each containing a
mini vertical span bar of open hours on a shared 24h scale — closed days render
as empty pills, today gets an accent ring, and "Open now" becomes a **calm
green dot + label** (delete the flashing text-shadow animation and the
strikethrough letters — A10). Tooltip on hover/tap gives exact times.

**Why**: Turns a cramped text grid into an actual small visualization — you
*see* "lunch-only weekdays, late Fridays" at a glance. Removing the flash is a
big perceived-modernity win (and kinder to photosensitive users).

- **Impact: Medium-High** — hours appear on card, compare, and submissions preview.
- **Difficulty: Low-Medium** (~1 day; data already parsed by `convertHoursData`)

### V5. Taste Profile polish
**What**: Port the scatter to the shared theme (F3/F4: favorites → slot 4
indigo, recommendations → slot 1 coral, centroid star keeps gold), and add a
**"You vs. Tucson" overlay** on the protein radar: user affinity as series 1,
city average (from `processedTacoData`) as a dashed ink-muted series 2, with a
proper 2-item legend.

**Why**: The scatter is already good; the overlay answers the fun question the
page begs — "am I normal?" — with zero new data.

- **Impact: Medium** — deepens the stickiest logged-in feature.
- **Difficulty: Low** (~½–1 day)

### V6. SummitResults — keep, align, celebrate
**What**: Keep the chart as-is (it's the reference-quality one), swap hardcoded
colors for theme tokens, and add a one-shot confetti burst + count-up on the
winner reveal when a session locks.

**Why**: "Fun" needs at least one moment of delight; the group-decision reveal
is the natural place.

- **Impact: Low-Medium** — small surface, high delight-per-line.
- **Difficulty: Low** (~½ day; `canvas-confetti` is ~5 KB, or a 30-line CSS/JS burst)

---

## 5. Track N — New Visualizations from Existing Data

### N1. Salsa Lineup on the Card ⭐ best data-for-free win
**What**: Surface the per-salsa data (A9) as a **salsa swatch row** on each
card: one chip per available variety (Verde, Rojo, Pico, Pickles, Chipotle,
Avocado, Molcajete, Macha) plus the up-to-3 named "other" salsas. Each "other"
chip shows its own **heat dots** (its `other_N_heat` value on the 0–10 scale,
rendered as 1–5 filled dots in sequential coral) with the description in a
tooltip/expandable line. The existing count + overall heat become the row's
header stats.

**Why**: The single biggest mismatch between data richness and UI today. It
answers the question salsa people actually ask ("do they have macha?") and
makes every card feel more data-dense — on data that has been sitting unused in
the view since day one.

- **Impact: High** — every card, zero backend work, very "CartoTaco".
- **Difficulty: Low** (~1 day; needs `processedTacoData` to pass through `site.salsa` fields it currently drops)

### N2. Tucson Taco Census — a public stats dashboard (`/census`)
**What**: Build roadmap item V1 as the app's data-viz showpiece. All client-side
from `processedTacoData`:
- **Hero stat tiles**: total spots, open right now, avg heat, total distinct
  salsas, newest spot (display-face hero numbers per F2).
- **Menu prevalence**: horizontal bar of the 16 menu item types by % of spots
  serving them (thin bars, direct labels, sequential coral).
- **Protein leaderboard**: 5 fixed-order categorical bars.
- **Heat histogram**: distribution of `heat_overall` 0–10 with the city mean
  flagged.
- **Tortilla split**: flour / corn / both + handmade % — two simple stat tiles
  or a 100% bar with 2px gaps.
- **"When can you get a taco?"** — 7×24 open-spot heat strip computed from
  hours (sequential ramp; the roadmap's C5 "Midnight Map" gets its teaser here).
- **Growth timeline**: cumulative spots over time from `created_at` (2px line,
  no dots, crosshair tooltip).
- A **"Share the census"** button (native share / copy link).

**Why**: Press-worthy, shareable, zero new data, and it *defines* the app as
"the people who chart tacos". Also becomes the natural landing page for the
percentile framing used across cards (N4).

- **Impact: High** — marketing surface + identity statement.
- **Difficulty: Medium** (~2–3 days; a `censusStats` derived store + one page of themed charts)

### N3. Map Lenses — let the map itself visualize
**What**: A small lens switcher on the map (chip row, top-left): 
- **Spots** (default, current markers)
- **Heat** — markers colored by `heat_overall` on the sequential coral ramp
  (data-driven `circle-color` interpolation), legend chip shows the ramp.
- **Salsa depth** — marker radius scaled by `salsa_count`.
- **Density** — Mapbox heatmap layer of spot concentration (roadmap item 5).
- Optional auto-suggested **"Open late"** lens after 9pm (dims closed spots).

Lenses are pure paint-property changes on the existing GeoJSON source — the
data is already embedded in feature properties.

**Why**: The map is 90% of the screen and currently encodes only location. This
makes the core surface itself a visualization and is the most "wow"-forward
item in the plan.

- **Impact: High** — the app's centerpiece becomes the data viz.
- **Difficulty: Medium-High** (~2–3 days; interaction with clustering + theme switching needs care — cluster layers should disable in heat/salsa lenses)

### N4. Percentile context everywhere ("spicier than 82%")
**What**: A `distributionStats` derived store (percentile ranks for heat, salsa
count, menu breadth per spot) + a tiny reusable `ContextStrip.svelte`: a 100px
dot-strip/sparkline of the city distribution with this spot's marker
highlighted, and a one-line claim. Drop into Card (under heat + salsa), Compare
(per row), and spot rows elsewhere.

**Why**: Cheap, reusable, and turns bare numbers into stories — the essence of
"data-viz focused but fun". Pairs with V2/V3.

- **Impact: Medium-High** — small component, appears everywhere.
- **Difficulty: Low-Medium** (~1 day)

### N5. Vibe Fingerprint mini-viz
**What**: Upgrade the vibe vote counts into a compact 4-bar **fingerprint**:
four thin horizontal bars (Heat Legit / Authentic / Value / Vibe) normalized by
the spot's total votes, rendered beside the chips on the card and as a row on
`/compare`. Icons + labels carry identity (not color — all bars are coral),
counts stay as direct labels.

**Why**: The anti-review's promise is literally "builds a vibe fingerprint" —
right now it's four numbers. A shape you can compare across spots delivers the
promise and enriches Compare for free (`vibe_votes` already has public SELECT).

- **Impact: Medium** — deepens an existing signature feature.
- **Difficulty: Low-Medium** (~1 day; needs a batch count fetch for compare)

### N6. Compare page: overlay + delta table
**What**: With V1's fixed axes in place, rebuild `/compare`'s chart rows as
**one overlaid radar** (2–3 series, categorical slots 1–3, legend + spot-colored
column headers so column identity = series identity) and a compact **delta
row** per metric (heat, salsas, menu breadth) with the leader direct-labeled.
Keep the existing winner highlighting logic; it just gets visual teeth.

**Why**: Side-by-side radars with *different axes and scales* (A7) are the
weakest data-viz moment in the app today; the overlay makes comparison the
actual encoding. Roadmap P8 alignment.

- **Impact: Medium** — much stronger page, but a secondary surface.
- **Difficulty: Medium** (~1–2 days, mostly layout rework)

---

## 6. Track U — UI Modernization & Delight

### U1. FilterBar → chip-based filtering
**What**: Replace checkbox lists with **toggle chips with live counts**
("Chicken · 23"), one **dual-thumb range slider** for spice (replacing the two
separate min/max sliders — A10), and an **active-filters chip row** under the
search bar with per-chip ✕ and "Clear all". Counts come from cheap tallies over
`processedTacoData`.

**Why**: Chips-with-counts is the modern filter idiom (and the counts are
themselves data viz — you learn the city's composition by reading the filter
panel). The two-slider spice range is genuinely confusing today.

- **Impact: High** — the most-touched control surface in the app.
- **Difficulty: Medium** (~2 days incl. mobile layout)

### U2. Card hierarchy pass
**What**: Restructure the card around a **stat-tile row** (Heat ladder V2 ·
Salsa bullet V3 · Tortilla badge) directly under the title, standardized
section labels (small caps, ink-muted, consistent spacing), the Salsa Lineup
(N1) as its own section, and flattened visual noise (one surface level, 1px
hairlines instead of nested shadows/boxes). Desktop keeps the no-scroll
constraint; mobile keeps collapsibles.

**Why**: The card is the product's money shot and currently reads as stacked
widgets from different eras. This is where F1–F4 + V2/V3/V4 + N1 compose into
one visibly "designed" artifact.

- **Impact: High** — the surface every user sees most.
- **Difficulty: Medium** (~2 days, mostly careful layout on two form factors)

### U3. Map marker & cluster refresh
**What**: Differentiate the three establishment types on the map — small glyph
badges (fork / tent / truck via symbol layer sprites) or a type ring on the
circle; restyle cluster steps to the sequential coral ramp with a 2px surface
stroke; slightly bolder hover pop (radius + shadow transition).

**Why**: Type is a first-class filter but invisible on the map. Also aligns the
map's color logic with F4 instead of the current ad-hoc orange/red steps.

- **Impact: Medium** — richer default map without a lens switch.
- **Difficulty: Medium** (~1–2 days; sprite management + cluster styling in Mapbox GL)

### U4. Loading skeletons & empty states with personality
**What**: Replace "Loading data..." with skeleton cards/map shimmer; give every
empty state (no favorites, no comparison, no results, taste profile without
favorites) a small illustrated taco/map moment + one funny line + a CTA.
One `Skeleton.svelte` + an `EmptyState.svelte` with a tiny inline SVG set.

**Why**: Empty and loading states are where "fun" is cheapest to add and where
the app currently feels most unfinished.

- **Impact: Medium** — polish that reads as craftsmanship.
- **Difficulty: Low** (~1 day)

### U5. Motion & micro-interactions
**What**: A restrained motion pass using Svelte's built-ins: `fly`/`fade` on
sheet, trays, filter panel, and popups; count-up on hero numbers (census tiles,
salsa count, vote counts); heart-burst on favoriting; springy chip toggles.
Global `prefers-reduced-motion` guard in one utility.

**Why**: Motion is the difference between "works" and "feels alive". Everything
here is standard Svelte, no new dependencies.

- **Impact: Medium** — pervasive feel upgrade.
- **Difficulty: Low-Medium** (~1–2 days spread across components)

### U6. Header & nav slim-down
**What**: Move authenticated nav items (Submit / Favorites / Profile / Sign
out) into an avatar menu (using the existing profile avatar), keep
Summit + New Spots + theme + help as icon actions with tooltips, and swap the
email address in the header for username/avatar (both already in `profiles`).

**Why**: Eight top-level items is why the hamburger breakpoint sits at 1100px;
a user menu is the expected modern pattern and shows off the avatar feature
that already shipped.

- **Impact: Medium** — first thing seen on every page.
- **Difficulty: Low-Medium** (~1 day)

---

## 7. Rating Summary

| ID | Item | Impact | Difficulty | Effort |
|----|------|--------|------------|--------|
| F1 | Design token system | **High** | Medium | 1–2 d |
| F2 | Typography upgrade | **High** | **Low** | ½–1 d |
| F3 | One chart system + theme | **High** | Medium | 2 d |
| F4 | Validated palettes | Medium-High | **Low** | hours |
| F5 | One icon system (drop Flowbite) | Medium | Low-Medium | 1 d |
| V1 | Comparable radar fingerprint | **High** | Medium | 1–2 d |
| V2 | Heat Ladder (replace gauge) | **High** | Low-Medium | 1 d |
| V3 | Salsa bullet bar | Medium | **Low** | ½ d |
| V4 | Week Rhythm hours strip | Medium-High | Low-Medium | 1 d |
| V5 | Taste profile polish + city overlay | Medium | **Low** | ½–1 d |
| V6 | Summit confetti + token alignment | Low-Medium | **Low** | ½ d |
| N1 | **Salsa Lineup on card** | **High** | **Low** | 1 d |
| N2 | Taco Census dashboard | **High** | Medium | 2–3 d |
| N3 | Map Lenses | **High** | Medium-High | 2–3 d |
| N4 | Percentile context strips | Medium-High | Low-Medium | 1 d |
| N5 | Vibe fingerprint mini-viz | Medium | Low-Medium | 1 d |
| N6 | Compare overlay + deltas | Medium | Medium | 1–2 d |
| U1 | Chip-based FilterBar | **High** | Medium | 2 d |
| U2 | Card hierarchy pass | **High** | Medium | 2 d |
| U3 | Marker/cluster refresh | Medium | Medium | 1–2 d |
| U4 | Skeletons & empty states | Medium | **Low** | 1 d |
| U5 | Motion pass | Medium | Low-Medium | 1–2 d |
| U6 | Header slim-down | Medium | Low-Medium | 1 d |

## 8. Suggested Sequencing

Each phase ships independently and leaves the app better than it found it.

1. **Phase A — Foundation** (≈1 week): F2 → F1 → F4 → F3 → F5, plus dead-code
   cleanup (delete `src/routes/styles.css`; drop `chartjs-gauge`, `svg-gauge`,
   `svelte-chartjs` immediately — they're unused today). *App looks noticeably
   fresher from typography + tokens alone.*
2. **Phase B — The Card** (≈1 week): N1 → V2 → V3 → V4 → N4 → U2. *The money
   shot becomes the showcase.*
3. **Phase C — Map & Filters** (≈1 week): U1 → N3 → U3. *The core surface gets
   its wow.*
4. **Phase D — Destination pages** (≈1 week): N2 → V1/N6 → V5. *Shareable
   census + honest comparisons.*
5. **Phase E — Delight** (2–3 days): U4 → U5 → V6 → U6. *Motion, moments,
   polish.*

### Explicit non-goals

- No new data collection (price tiers, neighborhoods, photos stay on the
  long-term roadmap where they already live in `IMPROVEMENTS.md`).
- No star ratings or review text — the anti-review stance stands.
- Don't abandon the radar — fix it. It's the closest thing the brand has to a
  logo-in-chart-form.
- No palette rainbowing: one accent + job-based hues only.
