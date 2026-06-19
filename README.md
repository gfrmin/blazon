# Blazon (React)

Design heraldically authentic coats of arms through natural language. This is a
plain **React + Vite** codebase recreated from the design prototype — no custom
runtime, no build magic. Built to be extended in a real codebase.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

Requires Node 18+.

## What's here

Two surfaces, both implemented and interactive:

- **Landing** (`src/Landing.jsx`) — marketing page with an **interactive hero coat
  of arms**. Tap the shield's field / structure / symbol (or the three control
  buttons, or "Surprise me") to change it live; every result stays
  tincture-rule valid. A mini blazon bar toggles formal blazon ↔ plain English.
- **Design Studio — Gifter mode** (`src/Studio.jsx`) — describe a person → generate
  a design → swap each element via cards, with live tincture-rule validation.
  The always-visible **Blazon Bar** (bottom) is the product thesis: it keeps the
  link between language and image legible at all times.

`src/App.jsx` is a trivial two-view switch. Swap it for your router
(`/`, `/studio`, …) when you wire this into a real app.

## Architecture

| File | Responsibility |
|---|---|
| `src/heraldry.js` | **The model + grammar engine.** Tinctures, ordinaries, charges, the `blazon()` derivation (formal + plain), `computeWarn()` tincture-rule validation, the `contrastPool`/`pickContrast` engine, hero cycling sets, and the Gifter presets. **Pure, framework-free — start here.** |
| `src/Shield.jsx` | The shield as an SVG React component (geometric ordinaries + charges, interactive zones, breathing-hint + change animations, `aria-label` = the formal blazon). |
| `src/ui.jsx` | Small shared controls: `HoverBtn`, `Swatch`, `Pill`, `LangToggle`. |
| `src/Landing.jsx` / `src/Studio.jsx` | The two surfaces. |
| `src/index.css` | Resets, font imports, and the handful of `@keyframes` that can't be inline. |

## Two deliberate conventions

1. **The tinctures ARE the UI palette.** No neutral greys, no white backgrounds —
   the interface chrome is derived from the heraldic tinctures (Or, Argent,
   Gules, Azure, Sable, Vert, Purpure). This is the core art direction; keep it.
   All colour literals live in `heraldry.js` (`TINCTURES`) and the component
   style objects.
2. **Inline styles, on purpose.** Styling is done with inline `style={{…}}`
   objects rather than CSS modules / a framework, mirroring the prototype and
   keeping each component self-contained. If your codebase has a styling system
   (Tailwind, CSS-in-JS, design tokens), this is the layer to translate — the
   values are all documented in `design-reference/README.md`.

## The data model (source of truth)

```js
{
  field: 'Azure',                 // a tincture name
  ordinary: 'saltire',            // saltire | cross | fess | pale | bend | chevron
  ordinaryTincture: 'Argent',
  charges: [{ type: 'mullet', tincture: 'Or', qty: 2 }],  // 0 or 1 in this round
  motto: 'Steadfast through the dark',
  rationale: { field, ordinary, charges },  // friendly copy shown on cards
}
```

`blazon(design, 'formal' | 'plain')` derives the text. The shield renders purely
from this object. Both are stateless — store the object, derive everything else.

## Production TODO (stubbed here)

- **Gifter generation** is the one place that fakes AI: `Studio.jsx` `generate()`
  runs a 1.7s timeout and returns one of three canned `PRESETS` (chosen by the
  example chip you clicked, or a keyword match). Replace with a **Claude API**
  call (claude-sonnet-4-6) that takes the free-text description and returns a
  validated design object — see `design-reference/blazon-app-spec.md` §6.1 for the exact contract.
- Tincture-rule validation (`computeWarn`) is already a deterministic rules
  engine and can stay client-side (cheaper/faster than an AI call).
- Not built this round: Enthusiast mode, Serious-mode blazon editor/parser,
  Gallery/Library, the full Gift checkout + A3 certificate, real charge SVG
  library (animals/objects via DrawShield or commissioned assets), exports
  (SVG/PNG/PDF). See `design-reference/blazon-app-spec.md` for the complete spec.

## Deploy

Hosted on **Cloudflare Pages** (same model as `kaomoji-app`). Vite builds to `dist/`,
which is what `wrangler.toml` points at (`pages_build_output_dir = "dist"`).

```bash
npm run deploy      # npm run build && npx wrangler pages deploy dist --project-name=blazon
```

CI: `.github/workflows/deploy.yml` builds and deploys on every push to `master`
(and via manual `workflow_dispatch`). It needs two repo secrets:
`CLOUDFLARE_API_TOKEN` (Pages-scoped) and `CLOUDFLARE_ACCOUNT_ID`. The Cloudflare
Pages project must be named `blazon`.

## Reference

- `design-reference/blazon-app-spec.md` — the full product specification.
- `design-reference/README.md` — exhaustive design tokens, per-component
  measurements, copy, and interaction notes (the original design handoff).
- `design-reference/Blazon.dc.html` — the source-of-truth prototype (markup + logic class).
- `design-reference/Blazon.html` — self-contained offline build of the prototype (open in a browser).
