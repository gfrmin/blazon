import React, { useState } from 'react';
import { MenuPopover, MenuItem } from '../ui.jsx';
import { C, F } from '../theme.js';
import { encodeCoat } from '../share/codec.js';
import { shareUrl } from '../share/link.js';
import { blazon } from '../heraldry.js';
import { track } from '../analytics.js';

// ─────────────────────────────────────────────────────────────────────────
// Task 18 §2 — the Studio header's Share control, extracted so it can be
// reused verbatim wherever the app needs to mint/copy a `/a/<payload>` link:
// the Studio header (desktop AND, nested inside the mobile overflow, via its
// own `trigger` override), and every LibraryCard's Share action.
//
// PRIVACY: the only analytics props here are `surface` (an enum this app
// controls) and nothing else — never the payload, never the blazon text,
// never the design itself. `design_code` (the hash) belongs to the
// `shared_view_*` events fired on the /a/ recipient page (src/ShareView.jsx),
// not here — this component never even computes a hash.
// ─────────────────────────────────────────────────────────────────────────

// The share-link action logic, factored out from the popover chrome so a
// caller that wants to flatten these into a bigger menu (none does today,
// but Studio's mobile overflow nests <SharePopover> wholesale instead —
// kept anyway as the one seam a future flattening would need) can reuse it
// without also getting a nested MenuPopover.
function useShareActions(design, surface) {
  const [copied, setCopied] = useState(false);

  const buildLink = async () => shareUrl(window.location.origin, await encodeCoat(design));

  const copyLink = async () => {
    const url = await buildLink();
    try { await navigator.clipboard?.writeText(url); } catch { /* clipboard unavailable — nothing to recover into */ }
    setCopied(true);
    track('share_link_copied', { surface });
    setTimeout(() => setCopied(false), 1600);
  };

  const nativeShare = async () => {
    const url = await buildLink();
    try {
      await navigator.share({ url, title: blazon(design, 'plain') });
      track('share_native_used', { surface });
    } catch { /* the visitor cancelled the share sheet, or it's unsupported — not an error */ }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return { copied, copyLink, nativeShare, canNativeShare };
}

// The popover's row content — "Copy link" always, "Share…" (navigator.share)
// only on capable devices (brief: "+ on mobile navigator.share(...) when
// available").
function ShareMenuItems({ design, surface }) {
  const { copied, copyLink, nativeShare, canNativeShare } = useShareActions(design, surface);
  return (
    <>
      <MenuItem onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy link'}</MenuItem>
      {canNativeShare && <MenuItem onClick={nativeShare}>Share…</MenuItem>}
    </>
  );
}

const defaultTrigger = (toggle) => (
  <button
    onClick={toggle}
    style={{ background: 'transparent', color: C.cream, border: `1px solid ${C.lineHi}`, padding: '9px 16px', borderRadius: 7, fontSize: 13.5, cursor: 'pointer', fontFamily: F.sans }}
  >Share</button>
);

/**
 * @param {import('../model/types.js').Coat} design
 * @param {'header'|'library'} [surface]
 * @param {'left'|'right'} [align]
 * @param {(toggle: () => void, open: boolean) => React.ReactNode} [trigger]
 *   Override the trigger element — Studio's mobile overflow passes a
 *   `<MenuItem>` row instead of the default pill button so this nests
 *   cleanly inside another MenuPopover's panel.
 */
export default function SharePopover({ design, surface = 'header', align = 'right', trigger }) {
  if (!design) return null;
  return (
    <MenuPopover
      label="Share"
      align={align}
      onOpen={() => track('share_opened', { surface })}
      trigger={trigger || defaultTrigger}
    >
      {() => <ShareMenuItems design={design} surface={surface} />}
    </MenuPopover>
  );
}
