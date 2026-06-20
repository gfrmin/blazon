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
| `src/model/` | **The model + grammar engine** (a complete blazon AST). `tinctures.js` (metals/colours/**furs**/proper/stains + the tincture rule), `field.js` (divisions + lines of partition), `ordinaries.js` (ordinaries + diminutives + subordinaries), `charges.js` (charge library + **attitudes**), `achievement.js` (full achievement + `normalize()`), `blazon.js` (recursive formal+plain serializer), `validate.js` (`computeWarn`), `drawshield.js` (render bridge). **Pure, framework-free — start here.** |
| `src/heraldry.js` | Public **barrel** re-exporting `model/*` under the names the app uses, plus the app-specific helpers (`contrastPool`/`pickContrast`, hero cycling sets, Gifter `PRESETS`). |
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

The canonical AST is a **`Coat`** — a single shield, or a `marshalling` of several:

```js
{
  field: {
    tincture: 'Azure',                          // OR a division:
    division: { type: 'per fess', line: 'wavy', tinctures: ['Azure', 'Or'], count },
  },
  charges: [                                    // ordered by precedence (= blazon order)
    { role: 'primary',   number: 1, tincture: 'Or',
      object: { kind: 'ordinary', key: 'chevron', line, cotised } },
    { role: 'secondary', number: 3, tincture: 'Argent',
      object: { kind: 'charge', key: 'mullet', attitude }, arrangement, on },
  ],
  marshalling: { type: 'quarterly' | 'impaled', parts: [ /* Coat[] */ ] },
  motto, rationale,
}
```

`blazon(design, 'formal' | 'plain')` derives the text and `computeWarn(design)`
validates the tincture rule — both **accept the legacy flat object too** (via
`normalize()`), so older code keeps working. The shield renders purely from the
object; everything is stateless — store the `Coat`, derive the rest. The three
personas are different progressive-disclosure *views* over this one AST.

## Production TODO (stubbed here)

- **Gifter generation** is now wired to a real **Claude API** call (spec §6.1):
  the Cloudflare Pages Function `functions/api/generate.js` takes the free-text
  description and returns a validated Coat (claude-sonnet-4-6, server-side key).
  `Studio.jsx` `generate()` POSTs `/api/generate` and **falls back to the canned
  `PRESETS`** when the API isn't configured/reachable (offline, local dev, no key).
  The tool schema is enum-locked to the model's own vocabulary, so Claude can only
  return keys the app can render/blazon. **Setup:** set the key on the Pages project —
  `npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=blazon` (until then
  the function returns 503 and the preset fallback runs). Local function dev:
  `npx wrangler pages dev dist` (after `npm run build`).
- Tincture-rule validation (`computeWarn`) is a deterministic rules engine and stays
  client-side (cheaper/faster than an AI call); it re-checks whatever Claude returns.
- **Exports** ship as SVG + print-resolution PNG with a blazon-text watermark
  (`src/export.js`, code-split; reuses the Shield renderer / DrawShield bridge).
- The **heraldic model is now complete** (a full-achievement blazon AST — divisions,
  furs, lines of partition, ordinaries/diminutives/subordinaries, charge attitudes,
  marshalling). The **SVG renderer grows incrementally**: `Shield.jsx` draws the
  simple tiers (and divided fields) today and defers the rest to DrawShield
  (`drawShieldURL()`) until a custom renderer catches up.
- Mode UI: the persona names (Gifter / Enthusiast / Serious) are an **internal
  UX-design instrument**, never an in-product toggle. Depth is reached through
  **progressive disclosure** over the one AST, not a self-classification switch.
- Not built yet: the blazon text editor (Serious mode, needs a parser),
  Gallery/Library + persistence, the full Gift checkout + A3 certificate, real charge
  SVG art (animals/objects via DrawShield or commissioned assets), PDF export.
  See `design-reference/blazon-app-spec.md` for the complete spec.

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
