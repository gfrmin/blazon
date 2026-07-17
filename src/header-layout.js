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
//
// 'download' is deliberately NOT one of these controls (task-21 cleanup —
// Task 18 review Minor: the Download button in Studio.jsx's header is
// rendered unconditionally, outside the headerInline/headerOverflow check
// entirely, so a 'download' entry here was dead data nobody ever read —
// always inline in both modes by construction, never part of the
// mobile-collapse decision this module actually makes).
// ─────────────────────────────────────────────────────────────────────────

const ALL_CONTROLS = ['library', 'save', 'share'];

/**
 * @param {boolean} isMobile
 * @returns {{inline: string[], overflow: string[]}}
 */
export function headerControls(isMobile) {
  if (!isMobile) return { inline: [...ALL_CONTROLS], overflow: [] };
  return { inline: [], overflow: [...ALL_CONTROLS] };
}
