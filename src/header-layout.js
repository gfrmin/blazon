// ─────────────────────────────────────────────────────────────────────────
// Pure header-control layout decision (Task 18 §2, brief: "Header layout
// becomes: logo · Library (quiet) · Save · Share · Download (gold). Mobile:
// collapse Save/Share/Library into a "⋯" overflow using the same
// MenuPopover; keep Download visible.") Extracted so the inline-vs-overflow
// decision itself is `node --test`-able without a DOM — Studio.jsx just
// reads the two arrays back and renders each named control accordingly,
// further gated per-control on runtime state it owns alone (e.g. hiding
// 'library' entirely when the library is empty — that's not a layout
// decision, it's a data one, so it stays out of this pure module).
// ─────────────────────────────────────────────────────────────────────────

const ALL_CONTROLS = ['library', 'save', 'share', 'download'];

/**
 * @param {boolean} isMobile
 * @returns {{inline: string[], overflow: string[]}}
 */
export function headerControls(isMobile) {
  if (!isMobile) return { inline: [...ALL_CONTROLS], overflow: [] };
  return { inline: ['download'], overflow: ['library', 'save', 'share'] };
}
