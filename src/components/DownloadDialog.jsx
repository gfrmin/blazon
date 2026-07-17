import React, { useEffect, useRef, useState } from 'react';
import { C, F, goldBtn, goldBtnHover } from '../theme.js';
import { HoverBtn } from '../ui.jsx';
import { track } from '../analytics.js';

// The app's first modal (task-6 brief §2). A plain dark panel consistent with
// the old export-dropdown styling — no new ornament work. Free download is
// the only actionable option until Stripe lands (a later task); the paid
// slot renders inert copy on purpose rather than a dead $19 button.
//
// Basic a11y only for now (a fuller audit is a later task): overlay click +
// Esc close it, focus moves in on open and returns to the trigger on close,
// role="dialog" + aria-modal + a labelled title.
export default function DownloadDialog({ open, onClose, design, surface }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [printNoted, setPrintNoted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  // Synchronous in-flight guard — state alone can lag a fast double-click by
  // a render; this ref blocks the second call the instant the first starts.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    setPrintNoted(false);
    setDownloadError(false);
    setDownloading(false);
    inFlight.current = false;
    previouslyFocused.current = document.activeElement;
    track('download_opened', { surface });

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
    // Only the open transition (re-)runs this; `onClose`/`surface` are stable
    // for the lifetime of a given open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

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

  const noteInterest = () => {
    track('print_interest_clicked');
    setPrintNoted(true);
  };

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

        {/* Free — the only actionable option until Stripe lands */}
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

        {/* Paid — inert copy, no price button, until Stripe lands (task-6 brief §2).
            Inactive read comes from the muted theme tokens alone (no container
            opacity — that composed with C.muted2 text to ~2:1, under the 3:1 floor). */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 17, color: C.muted, marginBottom: 6 }}>Own it — print files</div>
          <p style={{ fontSize: 13, color: C.muted2, lineHeight: 1.5, margin: 0 }}>Print-resolution image and vector artwork, clean and yours forever. Coming very soon.</p>
          {/* TODO(M4): $19 checkout */}
        </div>

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
