# Blazon — Product Specification
**Version 0.1 · For Design Review**

---

## 1. What Is This

**Blazon** is a web application for designing heraldically authentic coats of arms through natural language — no prior knowledge of heraldry required, but rewarded if you have it.

The core thesis: a coat of arms is defined by its *blazon* (the formal verbal description), not by any particular illustration of it. This app treats that as a feature, not a complexity. It puts language at the centre of the design experience while making the visual output beautiful.

The product serves three distinct personas across a single coherent interface, using the same rendering engine and the same underlying heraldic grammar for all of them. What adapts is the *language layer* — from pure natural English to formal blazon. Nobody is locked into a mode; the app rewards curiosity and progression.

---

## 2. Business Model

### Revenue Streams

| Tier | Price | What You Get |
|---|---|---|
| **Free** | £0 | Design one coat of arms, low-res PNG with watermark, view blazon |
| **Personal** | £9/month or £79/year | Unlimited designs, high-res PNG/SVG exports, PDF certificate, saved library |
| **Gift** | £19–£49 one-time | Print-quality files + physical certificate (print-on-demand fulfilment) |
| **Creator API** | £29/month | REST API access, SVG output, embed in other tools |

### The Gift Product
The physical certificate is the primary acquisition channel. Positioned as a premium gift ("Design your family's coat of arms") with:
- Print-ready A3 certificate layout
- Formal blazon typeset in period-appropriate calligraphy style
- Brief explanatory text on heraldic tradition
- Print-on-demand fulfilment (Printful or equivalent); no inventory

### API Customers
Targeted at tabletop RPG platforms (Foundry VTT, Roll20), fantasy map generators (Azgaar Fantasy Map, Wonderdraft), worldbuilding communities, genealogy services. Priced per-call above a free tier.

### Gifting as Acquisition
The shareable nature of "I designed my family coat of arms" is the primary organic growth mechanism. Every export should be easily shareable, watermarked on free tier in a non-ugly way (small blazon text as footer, not a garish stamp), and should link back to the app.

---

## 3. Personas

### Persona A — The Gifter
**Who:** Someone buying a birthday or Christmas gift. No interest in heraldry per se; wants something that looks impressive and personal.
**Goal:** Get something beautiful and meaningful with minimum friction. They want to tell a story ("Dad loves fishing and Scotland") and receive a finished product they can give or print.
**Anxiety:** Getting it "wrong." They don't know what a fess is and shouldn't have to.
**Mode:** Wizard. Plain English throughout. Blazon is hidden but generated behind the scenes.
**Revenue trigger:** Physical print / gift certificate.

### Persona B — The Enthusiast
**Who:** SCA member, tabletop RPG worldbuilder, genealogy hobbyist, Game of Thrones rewatcher who went down a Wikipedia rabbit hole. Has heard the word "blazon" but doesn't speak it fluently.
**Goal:** Create something that *feels* authentic. Wants to understand why their design looks the way it does. Interested in the rules, will tolerate learning.
**Anxiety:** Their coat of arms being "fake" or heraldically ridiculous.
**Mode:** Visual builder with progressive blazon exposure — charges have names, rules are explained in context, the formal blazon is visible but not required reading.
**Revenue trigger:** Personal subscription, API access.

### Persona C — The Serious Amateur
**Who:** Studying heraldry properly, preparing a submission to the College of Arms or Lord Lyon, writing a historical novel, academic interest. Knows what "Or, a fess gules between three roundels sable" means.
**Goal:** A proper blazon tool with full grammar, validation, a reference library, and rigorous output. Probably already uses DrawShield; finds it ugly and frustrating.
**Mode:** Direct blazon editor + NLP assistant for drafting and validation. Full access to all grammar including supporters, mottoes, crests, compartments, augmentations.
**Revenue trigger:** Personal subscription, physical output for formal records.

### Mode Switching
**Critical design requirement:** All three personas must be able to move between modes *at any time without losing their work*. The data model is always the blazon AST. The UI is just a view over it. A Gifter who gets curious can slide into Enthusiast mode; a Serious Amateur helping their child can drop into Gifter mode. A toggle or slider (not a modal prompt on login) handles this.

---

## 4. Core Concepts the Design Must Encode

The designer should understand these enough to make them feel natural in the interface.

### The Blazon
A formal verbal description of a coat of arms from which the image can be reconstructed. Example:
> *Azure, a bend Or between two mullets argent.*
> (A blue shield, a gold diagonal band, two silver stars above and below it.)

The app always maintains a blazon, even for Gifter-mode designs. It's the source of truth.

### Key Heraldic Rules to Surface (Contextually, Not as a Lecture)
- **Tincture rule:** Metal (Or/gold, Argent/silver) must not be placed on metal, nor colour on colour. This is the most fundamental rule and the most commonly violated by novices. The app should *prevent* violations visually and *explain* them plainly.
- **Tinctures:** Or (gold), Argent (silver), Gules (red), Azure (blue), Sable (black), Vert (green), Purpure (purple). Plus furs (Ermine, Vair, etc.).
- **Ordinaries and subordinaries:** The primary geometric charges — fess (horizontal band), pale (vertical), bend (diagonal), chevron, cross, saltire, etc.
- **Charges:** Everything else that can appear on a shield — animals, objects, flora, symbols.
- **Achievement:** The full coat of arms including shield, helm, crest, mantling, supporters, motto.

The app in Gifter mode should use plain English for all of this. In Enthusiast/Serious modes, it teaches the terms contextually.

---

## 5. Application Structure

### 5.1 Landing Page / Home

**Single job:** Communicate what the app does and get someone into the design flow within 30 seconds.

**Hero:** Live demo. The hero is an *interactive coat of arms* that the visitor can modify in one click — not a static image. This is the app's thesis statement. Suggested: a pre-built design with 3–4 labelled elements the visitor can click to swap (change the field colour, change the charge). It should feel like picking up a toy.

**Below the fold:**
- The three modes explained as benefits, not features ("Tell us what you love. We'll handle the heraldry." / "Learn the grammar of a thousand years." / etc.)
- Sample gallery of generated arms with their blazons visible
- Pricing
- Gift CTA ("Give someone a coat of arms")

### 5.2 Design Studio (Core Feature)

This is where the app lives. The layout is:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo · Mode toggle · Save · Export · Account  │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│   SHIELD         │   CONTROL PANEL                      │
│   PREVIEW        │                                      │
│                  │   [Varies by mode — see below]       │
│   (live SVG,     │                                      │
│    updates       │                                      │
│    in real time) │                                      │
│                  │                                      │
├──────────────────┴──────────────────────────────────────┤
│  BLAZON BAR: [Gules, a lion rampant Or]  ⓘ  [Copy]    │
└─────────────────────────────────────────────────────────┘
```

**The Blazon Bar** is always visible regardless of mode. In Gifter mode it shows the plain English translation. In Enthusiast/Serious modes it shows the formal blazon. Toggle between them inline. This is the single most important UI element — it makes the connection between language and image legible at all times.

**The shield preview** updates in real time as the user makes changes. It should never show a loading spinner for simple changes (field colour, basic charge swap). Aim for <200ms visual feedback.

#### Control Panel — Gifter Mode
A conversational/wizard interface:
1. **Tell us about yourself / the person** — free text input ("My grandfather was a fisherman from Galway who loved whisky and terrible puns")
2. **NLP processes this** → suggests field colours, charges, mottos with brief reasoning ("We thought green and silver for Ireland, an anchor for the sea...")
3. **Tap to accept or swap** each element — presented as cards, not dropdowns
4. **Optional:** "What does this mean?" tooltip on any element
5. Motto field (plain text, no blazon required)

The LLM call happens once on submission of the description. Subsequent tweaks are UI interactions against the generated design.

#### Control Panel — Enthusiast Mode
A structured builder with visible heraldic taxonomy:
- **Field:** Tincture selector (colour swatches with names: "Gules (Red)"), division options (per pale, per fess, quarterly, etc.) shown as mini shield thumbnails
- **Charge picker:** Searchable library organised by category (Beasts, Ordinaries, Objects, Flora, Crosses, etc.)
- **Charge properties:** Tincture, attitude (for animals: rampant, passant, sejant...), position, quantity
- **Crest / Supporters / Motto:** Collapsible sections, only shown when user opts in
- **Validation panel:** Inline alerts when rules are violated ("Metal on metal — try a colour instead") with one-click fix suggestions
- **Blazon visible throughout**, updating live as selections change

#### Control Panel — Serious Mode
- **Direct blazon editor:** Monospace text input, syntax highlighting for tinctures/charges/ordinaries, real-time validation and rendering
- **NLP assist:** "Translate to blazon" button that takes a plain English description and produces formal blazon — useful for drafting
- **Reference sidebar:** Collapsible panel with tincture rules, grammar reference, common charges, terminology glossary
- **Full achievement editor:** Shield, helm (type: tournament, barred, esquire, etc.), wreath, crest, mantling, supporters, compartment, motto, badge — each as a separate section
- **Export options:** SVG, high-res PNG, PDF with blazon, formal certificate layout

### 5.3 Gallery / Library

- User's saved designs
- Public gallery (opt-in) with search/filter by charge, tincture, country style (English, Scottish, Continental, etc.)
- Each design shows the blazon, rendering, and creation date
- "Remix" button to fork a public design into your own studio

### 5.4 Gift Flow

Separate, simplified flow for gift purchases:
1. Design the arms (Gifter mode by default, switchable)
2. Add personalisation: recipient name, date, occasion text
3. Choose product: digital download / physical A3 print / framed print
4. Preview the certificate layout
5. Checkout

The certificate itself should look like a real heraldic document — not a candle-and-scroll cliché, but genuinely considered typography and layout that would not embarrass someone to hang on a wall.

### 5.5 Learn (Optional V2 Feature)

An interactive reference and tutorial section:
- "Blazonry in 10 minutes" — guided interactive lesson
- Charge library browser with examples
- Historical examples with annotated blazons (historical arms in the public domain)
- Grammar of blazonry (covering field, ordinaries, charges, attitude, positioning syntax)

---

## 6. NLP / AI Layer — Behaviour Spec

This section describes what the AI does, for both design purposes (what feedback states to design) and engineering reference.

### 6.1 Gifter Mode: Description → Design

**Input:** Free text description of a person, family, place, values, occupation, interests.

**Output:** A structured design object:
```json
{
  "field": { "tincture": "Azure", "division": null },
  "charges": [
    { "type": "anchor", "tincture": "Argent", "position": "center", "quantity": 1 },
    { "type": "fish", "tincture": "Or", "position": "chief", "quantity": 2 }
  ],
  "motto": "By sea and salt",
  "blazon_formal": "Azure, an anchor argent, on a chief Or two fish naiant proper",
  "blazon_plain": "A blue shield with a silver anchor, and two gold fish along the top",
  "rationale": {
    "field": "Blue for the sea and Galway's coastal identity",
    "charges": "An anchor for the fishing heritage; fish naiant (swimming) in the chief"
  }
}
```

The rationale is displayed to the user as friendly copy beneath the preview. It makes the design feel *considered*, not random.

**Validation:** Before returning, the AI validates its own output against tincture rules. If it generates a violation, it corrects it and notes the correction in the rationale.

### 6.2 Enthusiast Mode: Inline Validation

As the user builds their design element by element, the AI (or a rules engine — this can be deterministic) checks:
- Tincture rule violations
- Charge attitude validity (a fish can't be "rampant")
- Positional grammar (charges must be described in the correct order in the blazon)
- Missing elements (a charge with no tincture, etc.)

Feedback is inline, plain English, non-blocking (warnings not hard stops, except for the tincture rule which should be firm).

### 6.3 Serious Mode: Blazon Parsing

The formal blazon editor sends the user's text to a parser that:
- Identifies tokens (tinctures, charges, ordinaries, attitudes, positions, quantifiers)
- Validates grammar
- Renders the result
- Returns error messages with specific positions ("'rampant' is not a valid attitude for a fish — did you mean 'naiant'?")

DrawShield's API can be used for this in V1 to avoid reimplementing a full parser. In V2, a custom parser would give better error messages and tighter integration.

### 6.4 NLP Assist in Serious Mode

"Translate to blazon" takes natural English and returns a formal blazon suggestion. The user can edit this before rendering. Think of it as autocomplete for heralds.

---

## 7. Technical Architecture (for Engineering Handoff Reference)

- **Frontend:** React SPA. The shield preview is SVG, rendered client-side from the design AST.
- **Rendering:** DrawShield API (v1) for blazon → SVG conversion. Custom SVG renderer (v2) for performance and full control.
- **AI calls:** Anthropic Claude API (claude-sonnet-4-6) for natural language → design object and blazon translation tasks. Blazon validation in Enthusiast mode should be a deterministic rules engine where possible (cheaper, faster, offline-capable).
- **Charge library:** SVG assets conforming to heraldic drawing conventions. Start with DrawShield's open library; commission or source additional charges over time. Each charge needs metadata: name, blazon term(s), valid attitudes, valid positions, category.
- **Backend:** Minimal — user accounts, saved designs, payment processing (Stripe), print fulfilment webhook (Printful API).
- **Export:** SVG (always available), PNG (rasterised at 300dpi for print), PDF (certificate layout, generated server-side).

---

## 8. Visual Design Direction

### Aesthetic
**The heraldic manuscript, made digital.** Not medieval cosplay — not torches and scrollwork — but the genuine visual intelligence of heraldry itself: bold flat colour, strong geometry, high contrast, bilateral symmetry, and a vocabulary of specific named forms. The app's visual language should *feel* like heraldry without being a pastiche of it.

This means:
- The shield and its charges are the visual hero. Everything else steps back.
- Strong typographic hierarchy with a period-inflected display face (something that reads as authoritative, not novelty — think a serious serif with genuine historical precedent, not a Halloween font)
- The tinctures *are* the palette: Or (gold), Argent (off-white), Gules (red), Azure (deep blue), Sable (near-black), Vert (forest green). The UI chrome should be derived from these, not fight them.
- High contrast. Heraldry exists to be read at a distance, on a battlefield, through a visor. The app should feel like it understands that.

### Typography
- **Display:** A serif with real authority — Cormorant Garamond, IM Fell English, or similar. Used for the blazon text, certificate layouts, headlines.
- **UI / Body:** A clean, legible grotesque — Inter or Geist — for interface copy, labels, controls.
- **Monospace:** For the blazon editor in Serious mode. Something with slightly humanist qualities — not too code-editor.

### Motion
Restrained. The one essential animation: the shield preview updating as elements change — a smooth cross-fade or morph between states rather than a jarring swap. Everything else can be simple opacity transitions. The product is about the artefact, not the interface.

### Accessibility
- All tincture colour choices must meet WCAG AA against the interface background
- Keyboard navigation throughout the builder
- Alt text on all generated shield images (the blazon is, conveniently, an ideal alt text)
- Reduced motion respected

---

## 9. Copy Voice

- **Gifter mode copy:** Warm, curious, slightly romantic about heritage. "Every family has a story worth a coat of arms."
- **Enthusiast mode copy:** Knowledgeable but not superior. Treats the user as someone learning something real. No condescension.
- **Serious mode copy:** Terse and precise. Gets out of the way. This user does not need encouragement.
- **Error messages:** Specific and constructive. "Gold on gold violates the tincture rule — heralds have frowned on this for 800 years. Try a colour instead." Never just "invalid input."
- **Empty states:** Invitations. "No designs yet — start with a description, or dive straight into the builder."

---

## 10. Out of Scope (V1)

- Mobile-native app (responsive web only)
- Official grant submission tooling (we are emphatically not the College of Arms)
- AI image generation for charges (vector SVG only — quality and heraldic accuracy matter more than variety)
- Multi-user / family collaboration (V2)
- Historical research / genealogy (V2, possible partnership)
- Non-Western heraldic traditions (Japanese mon, Islamic tughra, etc.) — rich future vertical

---

## 11. Success Metrics

| Metric | Target (6 months) |
|---|---|
| Free → Paid conversion | ≥8% |
| Gift product purchases | Primary revenue driver in M1–3 |
| Blazon mode adoption (Enthusiast+) | ≥30% of active users explore beyond Gifter mode |
| API signups | ≥50 developer/creator accounts |
| Shield completions per session | ≥1 per new user session |
| NPS | ≥50 |

---

*Spec authored June 2026. Subject to revision following design review.*
