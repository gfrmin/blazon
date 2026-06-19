# Handoff: Blazon — Coat of Arms Designer (Landing + Gifter Studio)

## Overview
Blazon is a web app for designing heraldically authentic coats of arms through natural language — no prior knowledge of heraldry required. The core thesis: **a coat of arms is defined by its *blazon* (the formal verbal description), not by any particular illustration of it.** The UI puts language at the centre and makes the relationship between *words* and *image* legible at all times via an always-visible **Blazon Bar**.

This package covers two surfaces built in this round:
1. **Landing page** — with an interactive hero coat of arms the visitor changes in one click.
2. **Design Studio — Gifter mode** — a describe-a-person wizard that generates a design, then lets the user swap each element via cards, with live tincture-rule validation and the always-on blazon bar.

(The spec also defines Enthusiast and Serious modes and a Gift certificate flow — **not built in this round**; see "Out of scope" below.)

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behaviour, **not production code to copy directly**.

The prototype is authored as a "Design Component" (`Blazon.dc.html`) that runs on a small custom runtime (`support.js`). **Do not port the runtime.** The task is to **recreate these designs in the target codebase's environment** — the spec calls for a **React SPA**, which is the recommended target — using its established component patterns, state management, and styling approach. Treat `Blazon.dc.html` as the source of truth for layout, copy, colour, typography, behaviour, and the shield-rendering logic (which is plain, framework-agnostic SVG-via-`React.createElement` and ports cleanly to JSX).

`Blazon.html` is a self-contained, fonts-and-runtime-inlined export for **viewing the prototype offline** — open it in a browser to see the intended result. It is minified/bundled; don't edit or read it as source.

## Fidelity
**High-fidelity (hifi).** Final colours, typography, spacing, copy, and interactions are all intended as shown. Recreate the UI pixel-accurately using the codebase's libraries and patterns. Exact values are documented below and in the source.

---

## Design Tokens

### The palette IS heraldic tinctures (deliberate art direction)
The entire UI chrome is built from heraldic tinctures — **no neutral greys, no white backgrounds.** This is the central aesthetic risk and should be preserved.

**Tinctures (used both as UI chrome AND as shield fills):**
| Tincture | Hex | Class | Plain name |
|---|---|---|---|
| Or | `#D4AF52` | metal | gold |
| Argent | `#E7E1D3` | metal | silver |
| Gules | `#9F2C2C` | colour | red |
| Azure | `#1F4E7A` | colour | blue |
| Sable | `#15151C` | colour | black |
| Vert | `#2E5A3E` | colour | green |
| Purpure | `#5A3A6B` | colour | purple |

**UI chrome colours (derived from the tinctures):**
| Token | Hex | Use |
|---|---|---|
| Ground | `#0C0F17` | page background (near-black blue-sable) |
| Ground alt | `#0B0E16` / `#0A0D14` | studio preview vignette edge / blazon bar |
| Panel | `#0F1826` | cards, control panel, footer surfaces |
| Panel raised | `#101D30` | highlighted cards (Gifter / Gift tier) |
| Panel azure | `#16273E` | header, inset toggles, pills |
| Panel azure 2 | `#1E3A5C` | pill hover |
| Hairline | `rgba(201,162,75,.18–.35)` | borders (Or at low alpha) |
| Accent (Or) | `#C9A24B` | borders, accents, eyebrows, ↻ glyphs, blazon-bar top rule |
| Text (Argent) | `#ECE6D8` | primary text |
| Text dim | `rgba(236,230,216,.45–.74)` | secondary text (vary alpha by hierarchy) |
| Alert (Gules) | `#B23A3A` border / `#F0CFCF` text / `rgba(178,58,58,.16)` bg | tincture-rule warnings |

Studio preview background is a radial gradient: `radial-gradient(circle at 50% 42%, #1A2C44, #0B0E16)`.
Gift CTA band: `linear-gradient(115deg,#16273E,#101D30)`.
`::selection` → bg `#C9A24B`, color `#0C0F17`.

### Typography
- **Display / blazon / headlines:** `Cormorant Garamond` (serif), weights 500–700, with italic used for all blazon text and mottoes. Google Fonts: `Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700`.
- **UI / body:** `Inter`, weights 400–700.
- **Monospace (blazon syntax, Serious-mode preview):** `Spline Sans Mono`, weights 400–500. Humanist, *not* a code-editor look.

Representative sizes (hifi): hero h1 62px / line-height 1.04 / `text-wrap:balance`; section h2 40px; card display 21–28px; eyebrow labels 11–13px with 1.5–3.5px letter-spacing; body 14–18px; blazon bar formal text 24px italic, plain text 17px.

### Radius / shadow
- Card radius: 13px. Pills/buttons: 7–10px. Inset toggles: 8px. Big CTA band: 16px. Swatch dots: 50%.
- Shield drop shadow: `drop-shadow(0 16px 34px rgba(0,0,0,.5))`.
- Active swatch ring: `box-shadow: 0 0 0 3px rgba(219,184,92,.35)`, border `2px #DBB85C`.

### Motion
Restrained. Key animations (keyframes in source `<helmet>`):
- `chgpop` — `opacity .12→1` over .45s; played on shield ordinary/charge change (morph-in).
- `zonepulse` — `filter: brightness(1)→1.42→1` over 1.6s, infinite; the hero shield's field/ordinary/charge zones "breathe" on staggered delays (0s / .55s / 1.1s) **until the user first interacts** (`heroTouched`), then stop.
- `fadein` — `opacity 0 + translateY(10px) → 1`; panel/step transitions, .4–.5s.
- `spin` — generation spinner.
- Shield field colour change: CSS `transition: fill .45s ease`. Hover brightness: `transition: filter .2s ease`, `brightness(1.3)`.

---

## Core heraldic concepts the implementation must encode

- **The blazon is the source of truth.** The data model is the design object (AST); the UI is a view over it. All three personas (only Gifter built here) read/write the same object. A `blazon(design, lang)` function derives both the **formal** blazon ("Gules, a chevron Or between three mullets argent") and the **plain-English** translation ("A red shield with a gold chevron, and three silver stars.") from that object.
- **Tincture rule:** metal (Or, Argent) must not sit on metal, nor colour on colour. The app must *prevent* violations where it controls choices, and *explain* them plainly where the user can cause one. See `computeWarn` and `pickContrast` in source.
- **Tinctures, ordinaries, charges** — see tokens + shield rendering below.

---

## Screens / Views

### 1. Landing Page

**Purpose:** Communicate what the app does and get someone into the design flow fast. The hero is the thesis statement: an interactive coat of arms.

**Layout:** Centred max-width 1200px column, 32px side padding, on the `#0C0F17` ground.
- **Header** (flex, space-between, 26px vertical pad): hex-shield logo mark + "Blazon" wordmark (Cormorant 25px); nav links (Modes, Gallery, Pricing) + primary "Open the Studio" button (Or bg `#C9A24B`, sable text).
- **Hero** (CSS grid `1.05fr .95fr`, 72px gap, centred):
  - *Left:* eyebrow "DESIGN A COAT OF ARMS" (Or, 3.5px tracking); h1 **"Every family has a story worth a coat of arms."** (Cormorant 62px); subcopy **"Describe someone you love. We translate it into authentic heraldry — the same grammar heralds have used for eight hundred years — and render it in bold, flat colour."** (keep verbatim); primary button **"Start with a description"** + ghost link **"See how it works"**.
  - *Right:* the **interactive hero shield** (floats on Sable with a soft radial gold glow behind, **no card border**), then a **controls block**, then a **mini blazon bar**.
- **Interactive hero shield + controls** (THE key element):
  - Shield SVG (see rendering spec). Initial design: **Gules, a chevron Or between three mullets Argent.**
  - The shield's three zones (field / ordinary / charge) are individually clickable AND brighten on hover. They "breathe" (zonepulse, staggered) until first interaction.
  - Controls block: a row "TAP A PART TO CHANGE IT" + a **"⚄ Surprise me"** pill (rolls a whole new valid coat). Below: **three full-width control buttons**, each `#16273E` bg / Or hairline / hover `#1E3A5C`+`#C9A24B` border, showing a swatch (or shape glyph) + small uppercase label (FIELD / STRUCTURE / SYMBOL, fixed 66px width) + current value (Cormorant 17px) + an Or `↻` glyph. Clicking each cycles that dimension (see logic).
  - **Mini blazon bar:** `#0E1726` panel, Or hairline. Left: a two-tab toggle **[Blazon | Plain]** (active tab = Or bg, sable text; inactive = dim text). Right: the live blazon text — formal in Cormorant italic 19px; plain in Inter 14px dim. Default tab here = **Blazon (formal)**.
- **Modes section** (`#modes`): h2 **"Three ways in. One coat of arms."** + subcopy. Three cards (grid, 3 cols, 22px gap) with **progressive visual complexity**:
  - *The Gifter* — highlighted: `#101D30` bg, `1.5px #C9A24B` border, "YOU START HERE" chip (Or pill, top-left, sable text). Copy: "Tell us what someone loves. We handle the heraldry and hand back something beautiful to print, frame and give."
  - *The Enthusiast* — plain card + a "PALETTE" row of 5 tincture swatch dots at the bottom (Or/Gules/Azure/Vert/Argent, 15px). Copy: "Build it yourself with a real charge library. Learn the grammar of a thousand years — the rules explained as you go."
  - *The Serious Amateur* — plain card + a monospace blazon snippet inset at the bottom (`#0A0D14`, Spline Sans Mono 12px, syntax-coloured: `Or`=`#D4AF52`, `gules`=`#C76B6B`, rest dim/argent): `Or, a fess gules between three roundels sable`. Copy: "A proper blazon editor with full grammar, live validation and rigorous output. Everything DrawShield should have been."
- **Gallery** (`#gallery`): h2 **"Made with Blazon"**. Three cards (grid, 3 cols), each = a rendered shield (130px) + title (Cormorant 21px) + its **formal blazon** (Cormorant italic 15px, Or). The three designs (chosen to span the range):
  - *House of Calder* — `Or, a saltire gules between a roundel azure`
  - *The Aldermere Arms* — `Azure, a bend or between two crescents argent`
  - *Família Vendral* — `Argent, a chevron sable between three lozenges gules`
- **Pricing** (`#pricing`): h2 **"Pricing"**. Four cards: Free £0 / Personal £9 mo / **Gift £19–49** (highlighted, "THE GIFT" chip, body line **"Digital download £19 · physical A3 certificate, framed and posted, £49."**) / Creator API £29 mo.
- **Gift CTA band:** gradient panel, h2 **"Give someone a coat of arms."** + subcopy + "Design a gift" button.
- **Footer:** "Blazon — the heraldic manuscript, made digital. · *Per fess Or and Azure*" (the italic part is a heraldic flourish — keep it).

### 2. Design Studio — Gifter Mode

**Purpose:** Generate a meaningful coat of arms from a free-text description with minimum friction; let the user swap each element via cards.

**Layout:** Full-viewport flex column (`height:100vh`, `overflow:hidden`).
- **Header** (`#101A2A`, Or bottom hairline): logo + wordmark (click → back to landing); centred segmented **mode toggle [Gifter | Enthusiast | Serious]** — Gifter active (Or bg), the other two visually present but disabled/`cursor:not-allowed` (only Gifter built this round); right-side ghost "Save" + Or "Export" buttons.
- **Main** (flex, fills remaining height):
  - *Left — Live Preview* (flex:1, radial vignette bg, centred): label "LIVE PREVIEW" top-left. Three states:
    - **empty** (`step==='describe'`, no design): dashed shield outline + "Your arms will appear here."
    - **generating**: spinner + Cormorant italic "Reading your story, consulting eight centuries of heraldry…"
    - **design**: the large rendered shield (300px) + motto beneath in Cormorant italic Or (`“…”`), if set.
  - *Right — Control Panel* (width 466px, `#0F1826`, Or left hairline, scrolls). Two steps:
    - **Describe step:** h2 "Tell us their story." + subcopy; a textarea (`#0B111C`, Or hairline) with the placeholder example; "OR TRY ONE OF THESE" + 3 example chips; primary "Design the coat of arms" button (shows "Designing…" while generating).
    - **Design step:** h2 "Here's what we made." + "Start over" link; intro line; an optional **tincture-rule warning** banner (Gules-tinted, ⚠ + plain-English message); then cards:
      - **THE FIELD · COLOUR** — current tincture name (Cormorant italic), rationale copy, a row of 7 tincture swatches (active = Or ring) to swap.
      - **THE STRUCTURE** — current ordinary name, rationale, a row of 6 ordinary pills (Saltire/Cross/Fess/Pale/Bend/Chevron) + a row of 7 tincture swatches for "Its colour".
      - **THE SYMBOL** (if a charge present) — current charge label, rationale, a row of 4 charge pills (Star/Crescent/Disc/Diamond), a quantity stepper (− n +, clamped 1–3), and a row of 7 tincture swatches.
      - **THE MOTTO** — an inline-editable input (Cormorant italic 19px, underline).
      - Primary "Continue to your gift →" button.
- **Blazon Bar** (always visible, bottom, full width): `#0A0D14`, `1.5px #C9A24B` top rule. Left: a circular `i` info glyph (tooltip explains the blazon) + a two-tab toggle **[Blazon | Plain English]**. Centre: the live blazon — formal = Cormorant italic 24px Argent; plain = Inter 17px dim; placeholder italic dim when no design yet. Right: a "Copy" button (→ "Copied ✓" for 1.6s, copies the **formal** blazon). Default tab in Gifter studio = **Plain English**.

---

## Interactions & Behavior

### Hero (landing) — the interactive coat of arms
The hero state is a `heroDesign` object: `{ field, ordinary, ordinaryTincture, charges:[{type,tincture,qty}] }`.
- **Click field zone / FIELD button:** advance through `HERO_FIELDS = ['Gules','Azure','Vert','Purpure','Sable','Or','Argent']`. On change, re-derive the ordinary tincture and charge tincture via `pickContrast(field, …)` so the result is **always tincture-rule valid** (metal field → colour ordinary/charges, and vice-versa).
- **Click ordinary zone / STRUCTURE button:** advance the ordinary shape through `ORDINARY_ORDER = ['saltire','cross','fess','pale','bend','chevron']`, AND advance its tincture to the next entry in the field's contrast pool (so it never lands metal-on-metal / colour-on-colour).
- **Click charge zone / SYMBOL button:** advance through `HERO_SYMBOLS = [{mullet,3},{crescent,2},{roundel,1},{mullet,2},{lozenge,3},{crescent,1},{roundel,3}, null]` (null = no charge, last so visitors start *with* charges). New charge tincture = `pickContrast(field, ordinaryTincture)` so it differs from the ordinary.
- **Surprise me:** random valid field + ordinary + symbol, tinctures via `pickContrast`.
- **First interaction sets `heroTouched=true`**, which stops the breathing `zonepulse` animation.
- Hover any zone → `brightness(1.3)`; hovering a control button sets the matching zone's hover too (`hoverPart`).
- The mini blazon bar tab toggles `heroLang` between `'formal'` and `'plain'`; blazon text re-derives live.

**Contrast helper (the tincture-rule engine):**
```
contrastPool(field) = TINCTURES[field].cls === 'metal' ? COLOURS : METALS
  // COLOURS = ['Gules','Azure','Vert','Purpure','Sable']; METALS = ['Or','Argent']
pickContrast(field, avoid) = random from contrastPool(field) excluding `avoid` (fallback: whole pool)
```

### Studio (Gifter)
- **Generate:** sets `generating=true`, waits ~1.7s (simulated AI), then sets `step='design'` and a `design` object. **In production this is the Claude API call** (see spec §6.1) returning `{field, charges, motto, blazon_formal, blazon_plain, rationale}`. The prototype hard-codes 3 presets and picks one by keyword match on the description, OR by which **example chip** was clicked (deterministic — the chip locks its preset index so the label always matches the result). Keyword routing: `/build|home|steady|patient|…/` → builder preset; `/militar|bold|fierce|…/` → military preset; else → the Scottish/astronomy preset.
- **Element swaps** (field tincture, ordinary type, ordinary tincture, charge type, charge quantity 1–3, charge tincture, motto text): each mutates the `design` object immutably and re-renders the shield + blazon bar live (<200ms; no spinner for these).
- **Validation:** after any swap, `computeWarn(design)` returns a plain-English message if the ordinary or charge tincture clashes in class with the field (metal-on-metal / colour-on-colour). Shown as a non-blocking banner. Example copy: *"Colour on colour — heralds have frowned on this for 800 years. Try a metal (Or or Argent) for the structure so it reads with contrast."*
- **Blazon bar:** tab toggles `studioLang`; Copy writes the formal blazon to clipboard.
- **Start over** resets to the describe step.

### The 3 Gifter presets (prototype canned data — replace with API in prod)
1. *Scottish / astronomy / matriarch* → **Azure, a saltire argent between two mullets Or**, motto "Steadfast through the dark".
2. *A builder / patient hands* → **Vert, a chevron Or between three roundels argent**, motto "By patient hands".
3. *Bold / military line* → **Gules, a cross Or between a mullet argent**, motto "Without fear".
Each carries `rationale.{field,ordinary,charges}` friendly copy shown on the cards.

---

## State Management

**Landing/hero:** `heroDesign` (object), `heroLang` ('formal'|'plain'), `hoverPart` (null|'field'|'ord'|'chg'), `heroTouched` (bool).

**Studio:** `view` ('landing'|'studio'), `step` ('describe'|'design'), `desc` (string), `selectedPreset` (int|null — set by example chip, cleared on free typing), `generating` (bool), `design` (object|null), `studioLang` ('formal'|'plain'), `copied` (bool).

**The design object shape** (source of truth — matches spec §6.1):
```
{ field: 'Azure', ordinary: 'saltire', ordinaryTincture: 'Argent',
  charges: [{ type:'mullet', tincture:'Or', qty:2 }],
  motto: 'Steadfast through the dark',
  rationale: { field:'…', ordinary:'…', charges:'…' } }
```
Production should additionally store `blazon_formal` / `blazon_plain` from the API; the prototype derives them client-side via `blazon()`.

**Data fetching (production):** Gifter generation = one Claude API call (claude-sonnet-4-6) on description submit, returning the design object (it self-validates against the tincture rule). Subsequent tweaks are pure client-side UI mutations — no further calls. See spec §6 + §7.

---

## Shield rendering (SVG) — port this logic

The shield is **stylised geometric heraldry**, drawn as SVG (no raster, no charge-library dependency in this round). All authentic and framework-agnostic — port the functions to JSX/SVG components.

- **Shield silhouette (heater):** `viewBox 0 0 200 240`, path
  `M18,14 H182 V108 C182,170 144,204 100,226 C56,204 18,170 18,108 Z`.
  Rendered as: clipPath (the path) → field `<path>` filled with field tincture → a clipped `<g>` containing the ordinary + charges → an Or stroke (`#C9A24B`, width 3.5) edge on top.
- **Ordinaries** (filled shapes, clipped to the shield):
  - `fess` = horizontal rect (y 90, h 40); `pale` = vertical rect (x 80, w 40); `cross` = pale+fess; `bend` = diagonal band path; `chevron` = inverted-V path; `saltire` = two crossed diagonal bands.
- **Charges** (mobile, placed by quantity): `mullet` = 5-point star (`starPoints(cx,cy,r=22)`); `roundel` = circle r19; `lozenge` = diamond polygon; `crescent` = circle minus an offset field-coloured circle. Quantity slots: 1 → `[100,60]`; 2 → `[[60,56],[140,56]]`; 3 → `[[58,54],[142,54],[100,150]]`.
- **Accessibility:** the shield SVG sets `role="img"` and `aria-label` = the **formal blazon** (the spec notes the blazon is an ideal alt text). Honour `prefers-reduced-motion` (disable zonepulse/chgpop).

The full implementations of `renderShield`, `ordinaryEl`, `chargeShape`, `starPoints`, `blazon`, `computeWarn`, `contrastPool`, `pickContrast` are in `Blazon.dc.html`'s logic class — read them directly; they are plain JS.

---

## Assets
- **No image/icon files.** All shield artwork is inline SVG generated from the design object. Logo mark is a tiny inline SVG (hex shield with an Or diagonal).
- **Fonts:** Google Fonts — Cormorant Garamond, Inter, Spline Sans Mono (link tag in source `<helmet>`).
- **Glyphs used as UI:** `↻` (cycle), `⚄` (surprise/die), `✕` (structure pill icon), `⚠` (warning), `i` (info), `“ ”` (motto). Replace with your icon set if preferred.

## Out of scope (this round — see full spec for intent)
Enthusiast mode (visual builder + charge library), Serious mode (blazon editor + parser), Gallery/Library, full Gift checkout + A3 certificate layout, DrawShield API integration, real charge SVG library (animals/objects), mobile-native. The attached `blazon-app-spec.md` is the complete product spec.

## Files
- `Blazon.dc.html` — **source of truth** prototype (markup + logic class). Read its logic class for exact shield/blazon/validation implementations.
- `Blazon.html` — self-contained offline build of the prototype, for **viewing only** (open in a browser).
- `support.js` — the prototype's custom runtime. **Reference only; do not port.**
- `blazon-app-spec.md` — the full Blazon product specification (all three personas, business model, NLP/AI behaviour, technical architecture, visual direction, copy voice).
