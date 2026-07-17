import React, { useEffect, useRef, useState } from 'react';
import { C, F, goldBtn, goldBtnHover } from '../theme.js';
import { HoverBtn, trapTabKey } from '../ui.jsx';
import { track } from '../analytics.js';
import { encodeCoat, designHash } from '../share/codec.js';
import { isUnlocked, CHECKOUT_PENDING_KEY } from '../unlock.js';
import { getDesign } from '../library.js';

// The app's first modal (task-6 brief §2), later extended with the M4 paid
// unlock (task-19 brief §4/§5). A plain dark panel consistent with the old
// export-dropdown styling. Free download is always live; the paid slot is
// one of three states, computed fresh on every open:
//   - `checkoutConfigured === false` (still loading, or genuinely
//     unconfigured) → inert "coming very soon" copy — fail-safe (task-19
//     brief, verbatim): NEVER an actionable $19 button unless /api/health
//     has POSITIVELY confirmed Stripe is configured.
//   - `unlockedForHash` (the CURRENT design's designHash isUnlocked,
//     src/unlock.js) → the clean-file buttons directly, no CTA.
//   - otherwise, configured → the live "$19 — own it" → Stripe Checkout CTA.
//
// A11y (task-21 sweep, verified against the paid/unlocked states M4 added):
// overlay click + Esc close it, focus moves in on open and returns to the
// trigger on close, Tab is trapped inside the panel (ui.jsx's trapTabKey),
// role="dialog" + aria-modal + a labelled title.
export default function DownloadDialog({ open, onClose, design, surface, currentId = null, editsCount = 0, hasAchievement = false }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [printNoted, setPrintNoted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  // Synchronous in-flight guard — state alone can lag a fast double-click by
  // a render; this ref blocks the second call the instant the first starts.
  const inFlight = useRef(false);

  // ── M4 unlock state — recomputed each time the dialog opens (see the
  // effect below; keyed off `[open]` like the rest of this file's reset
  // logic, not `[design]`, matching the existing convention). ──
  const [hash, setHash] = useState(null); // this design's designHash, once computed
  const [checkoutConfigured, setCheckoutConfigured] = useState(false); // pessimistic default — see file header
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const [cleanBusy, setCleanBusy] = useState(null); // 'svg' | 'png' | 'pdf' | null — which clean download is in flight
  const [cleanError, setCleanError] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setPrintNoted(false);
    setDownloadError(false);
    setDownloading(false);
    setCheckoutError(false);
    setCheckingOut(false);
    setCleanBusy(null);
    setCleanError(false);
    inFlight.current = false;
    previouslyFocused.current = document.activeElement;
    track('download_opened', { surface, edits_count: editsCount, has_achievement: hasAchievement });

    let cancelled = false;
    setHash(null);
    if (design) {
      designHash(design).then((h) => { if (!cancelled) setHash(h); }).catch(() => {});
    }
    fetchCheckoutConfigured().then((c) => { if (!cancelled) setCheckoutConfigured(c); });

    // Esc closes; Tab/Shift+Tab is trapped inside the panel (task-21 a11y
    // sweep — focus-move-in/focus-restore/Esc were already here, but nothing
    // stopped Tab from walking out into the page behind the overlay).
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      trapTabKey(e, panelRef);
    };
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
    // Only the open transition (re-)runs this; `onClose`/`surface`/`design`/
    // `editsCount`/`hasAchievement` are stable for the lifetime of a given
    // open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const unlockedForHash = hash ? isUnlocked(hash) : false;
  // Honesty rule (task-19 brief §4): if the CURRENT hash isn't unlocked but
  // this working design is already a saved library entry that IS flagged
  // unlocked, the arms were edited since purchase — the paid button must
  // return (a different hash needs its own $19), but the line below tells
  // the visitor their purchased file didn't vanish.
  const purchasedElsewhere = !unlockedForHash && currentId ? !!getDesign(localStorage, currentId)?.unlocked : false;

  const downloadFree = async () => {
    if (inFlight.current) return; // guard against double-clicks firing two downloads
    inFlight.current = true;
    setDownloading(true);
    setDownloadError(false);
    track('download_free', { format: 'png' });
    try {
      // Export is code-split (pulls in react-dom/server) — load it on click only.
      const m = await import('../export.js');
      await m.downloadPNG(design);
      // Reset in-flight state ourselves before closing — self-consistent
      // regardless of whether the parent's reopen-effect also resets it.
      inFlight.current = false;
      setDownloading(false);
      onClose();
    } catch {
      // svgToPNG / the chunk fetch can reject (toBlob failure, SVG image load
      // failure, network). Keep the dialog open and tell the visitor plainly
      // rather than closing on a silent failure — this is the only download
      // path there is right now.
      track('download_error', { format: 'png' });
      setDownloadError(true);
      inFlight.current = false;
      setDownloading(false);
    }
  };

  const downloadClean = async (format) => {
    if (cleanBusy) return;
    setCleanBusy(format);
    setCleanError(false);
    track('download_paid_file', { format });
    try {
      const m = await import('../export.js');
      if (format === 'svg') await m.downloadCleanSVG(design);
      else if (format === 'png') await m.downloadCleanPNG(design);
      else if (format === 'pdf') await m.downloadCleanPDF(design);
      setCleanBusy(null);
    } catch {
      setCleanError(true);
      setCleanBusy(null);
    }
  };

  const startCheckout = async () => {
    if (checkingOut) return;
    setCheckingOut(true);
    setCheckoutError(false);
    track('checkout_started');
    try { sessionStorage.setItem(CHECKOUT_PENDING_KEY, '1'); } catch { /* storage unavailable — abandonment just won't be detected */ }
    try {
      const payload = await encodeCoat(design);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) throw new Error('checkout_failed');
      const data = await res.json();
      if (!data.url) throw new Error('no_url');
      window.location.href = data.url; // full navigation to Stripe Checkout
    } catch {
      setCheckoutError(true);
      setCheckingOut(false);
      try { sessionStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* storage unavailable */ }
    }
  };

  const noteInterest = () => {
    track('print_interest_clicked');
    setPrintNoted(true);
  };

  const cleanBtnStyle = { ...goldBtn, padding: '10px 16px', fontSize: 13.5, width: '100%', textAlign: 'center' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,18,.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.panel, border: '1px solid rgba(201,162,75,.3)', borderRadius: 14, maxWidth: 460, width: '100%', padding: '26px 28px', boxShadow: '0 24px 60px rgba(0,0,0,.6)', outline: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <h2 id="download-dialog-title" style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 26, margin: 0, color: C.cream }}>Take it with you.</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(236,230,216,.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0, marginLeft: 12 }}>×</button>
        </div>

        {/* Free — always live */}
        <div style={{ background: C.ink, border: `1px solid ${C.lineMid}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 17, color: C.cream, marginBottom: 6 }}>Free — share it</div>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, margin: '0 0 14px' }}>Share it — a fine image for screens, with a small mark of its making.</p>
          <HoverBtn
            onClick={downloadFree}
            disabled={downloading}
            style={{ ...goldBtn, padding: '11px 20px', fontSize: 14, width: '100%', opacity: downloading ? .6 : 1, cursor: downloading ? 'default' : 'pointer' }}
            hoverStyle={downloading ? {} : goldBtnHover}
          >
            {downloading ? 'Downloading…' : 'Download PNG'}
          </HoverBtn>
          {downloadError && (
            <p role="alert" style={{ fontSize: 12.5, color: '#F0CFCF', lineHeight: 1.4, margin: '10px 0 0' }}>That didn’t download — try once more.</p>
          )}
        </div>

        {/* Paid — one of three states (unlocked / live CTA / coming soon), see file header. */}
        {unlockedForHash ? (
          <div style={{ background: C.ink, border: `1px solid ${C.lineHi}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 17, color: C.gold, marginBottom: 6 }}>Unlocked</div>
            <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, margin: '0 0 14px' }}>Unlocked — the clean files for these arms are yours.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <HoverBtn onClick={() => downloadClean('svg')} disabled={!!cleanBusy} style={{ ...cleanBtnStyle, opacity: cleanBusy && cleanBusy !== 'svg' ? .6 : 1 }} hoverStyle={goldBtnHover}>
                {cleanBusy === 'svg' ? 'Downloading…' : 'Download SVG (vector)'}
              </HoverBtn>
              <HoverBtn onClick={() => downloadClean('png')} disabled={!!cleanBusy} style={{ ...cleanBtnStyle, opacity: cleanBusy && cleanBusy !== 'png' ? .6 : 1 }} hoverStyle={goldBtnHover}>
                {cleanBusy === 'png' ? 'Downloading…' : 'Download PNG (300dpi print)'}
              </HoverBtn>
              <HoverBtn onClick={() => downloadClean('pdf')} disabled={!!cleanBusy} style={{ ...cleanBtnStyle, opacity: cleanBusy && cleanBusy !== 'pdf' ? .6 : 1 }} hoverStyle={goldBtnHover}>
                {cleanBusy === 'pdf' ? 'Downloading…' : 'Download PDF'}
              </HoverBtn>
            </div>
            {cleanError && (
              <p role="alert" style={{ fontSize: 12.5, color: '#F0CFCF', lineHeight: 1.4, margin: '10px 0 0' }}>That didn’t download — try once more.</p>
            )}
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 17, color: checkoutConfigured ? C.cream : C.muted, marginBottom: 6 }}>Own it — print files</div>
            {purchasedElsewhere && (
              <p style={{ fontSize: 12.5, color: '#E0B36A', lineHeight: 1.5, margin: '0 0 12px' }}>
                You&rsquo;ve changed the arms since unlocking — your purchased files are kept in your library.
              </p>
            )}
            {checkoutConfigured ? (
              <>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: '0 0 14px' }}>Print-resolution image and vector artwork, clean and yours forever.</p>
                <HoverBtn
                  onClick={startCheckout}
                  disabled={checkingOut}
                  style={{ ...goldBtn, padding: '11px 20px', fontSize: 14, width: '100%', opacity: checkingOut ? .6 : 1, cursor: checkingOut ? 'default' : 'pointer' }}
                  hoverStyle={checkingOut ? {} : goldBtnHover}
                >
                  {checkingOut ? 'Redirecting…' : '$19 — own it'}
                </HoverBtn>
                {checkoutError && (
                  <p role="alert" style={{ fontSize: 12.5, color: '#F0CFCF', lineHeight: 1.4, margin: '10px 0 0' }}>That didn’t work — try once more.</p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: C.muted2, lineHeight: 1.5, margin: 0 }}>Print-resolution image and vector artwork, clean and yours forever. Coming very soon.</p>
            )}
          </div>
        )}

        <button
          onClick={printNoted ? undefined : noteInterest}
          disabled={printNoted}
          style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: printNoted ? C.gold : C.muted2, textDecoration: printNoted ? 'none' : 'underline', cursor: printNoted ? 'default' : 'pointer', fontFamily: F.sans }}
        >
          {printNoted ? 'Noted.' : 'Printed, framed and posted — coming soon.'}
        </button>
      </div>
    </div>
  );
}

// Cached (module-lifetime) presence check of server-side Stripe config —
// fetched at most once per page load, mirroring components/Turnstile.jsx's
// `loadScript()` caching. A network failure resolves `false` (fail-safe:
// never show the actionable $19 CTA off an unconfirmed check).
let checkoutConfigPromise = null;
function fetchCheckoutConfigured() {
  if (!checkoutConfigPromise) {
    checkoutConfigPromise = fetch('/api/health')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => !!d.checkout)
      .catch(() => false);
  }
  return checkoutConfigPromise;
}

// Test-only: forces the next fetchCheckoutConfigured() call to re-fetch
// instead of reusing a cached result from an earlier test/page session.
export function _resetCheckoutConfigCacheForTests() {
  checkoutConfigPromise = null;
}
