// ─────────────────────────────────────────────────────────────────────────
// Pure pricing-tier data (task-20 brief §1) — reconciled against what M4
// actually ships. Task 6's review flagged the prior FOUR-tier grid as
// advertising things the app can't sell: a Membership subscription and a
// live "$29/mo API" footnote link, neither of which exist in MVP scope — a
// dead link / unbuyable tier is funnel poison. Three tiers only, matching
// src/components/DownloadDialog.jsx's own two real states (free download,
// $19 clean-file unlock) plus the coming-soon print demand signal:
//   - free   — what the app gives away today: the full achievement, a
//              library, share links, a watermarked download.
//   - files  — the ONE thing that's actually purchasable right now:
//              DownloadDialog's $19 clean-file unlock (300dpi PNG + SVG +
//              PDF). `highlight: true` — this is the card the grid leads
//              with.
//   - print  — NOT a product yet. `comingSoon: true` is read by Landing to
//              render a muted, non-buy card whose only affordance is
//              `print_interest_clicked` — the exact same demand-signal
//              event DownloadDialog's own "coming soon" footnote already
//              fires (src/components/DownloadDialog.jsx's `noteInterest`).
// No React/JSX in this file — kept plain data so the shape itself is
// node-testable without a JSX transform (see __tests__/pricing.test.js).
// ─────────────────────────────────────────────────────────────────────────

export const PRICING_TIERS = [
  {
    id: 'free',
    tier: 'Free',
    priceLabel: 'Free',
    priceSuffix: null,
    body: 'Design as many coats of arms as you like — the full achievement, saved to your library, shared by a link. Every download carries a small mark of its making.',
    highlight: false,
    comingSoon: false,
  },
  {
    id: 'files',
    tier: 'The Files',
    priceLabel: '$19',
    priceSuffix: 'once',
    body: 'Your finished achievement, clean and watermark-free — a 300dpi print image, a vector SVG, and a ready-to-print PDF. One design, yours to keep forever.',
    highlight: true,
    comingSoon: false,
  },
  {
    id: 'print',
    tier: 'Printed & framed',
    priceLabel: 'from $49',
    priceSuffix: null,
    // Future/conditional tense, deliberately (task-21 Minor, folded in from
    // Task 20's review) — the "· coming soon" header alone wasn't enough of
    // a signal; the old present-tense "Printed large on heavy art paper and
    // framed, delivered to your door." read as a live, active service to a
    // skimmer even sitting right next to that label.
    body: 'The plan: printed large on heavy art paper, framed, and delivered to your door.',
    highlight: false,
    comingSoon: true,
  },
];
