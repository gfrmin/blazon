import React, { useState, useEffect, useRef } from 'react';
import { trapTabKey } from './ui.jsx';

// Attribution surface (CC-BY-SA compliance): credits DrawShield + the Wikimedia
// heraldic artists whose charge art we use. Full per-charge record lives in
// ATTRIBUTION.md; this is the user-facing acknowledgement.
export default function CreditsLink({ style }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const link = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: 'rgba(236,230,216,.6)', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit',
    ...style,
  };

  // Modal a11y (task-21 sweep — this dialog had none: no role/aria-modal, no
  // Esc, no focus management). Same shape as DownloadDialog's: focus moves
  // in on open and returns to the trigger on close, Esc closes, Tab is
  // trapped inside the panel.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      trapTabKey(e, panelRef);
    };
    document.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} style={link}>Artwork &amp; licences</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,18,.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0F1826', border: '1px solid rgba(201,162,75,.3)', borderRadius: 14, maxWidth: 540, width: '100%', padding: '26px 28px', boxShadow: '0 24px 60px rgba(0,0,0,.6)', outline: 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h2 id="credits-dialog-title" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 26, margin: 0 }}>Artwork &amp; licences</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(236,230,216,.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(236,230,216,.78)', lineHeight: 1.65, margin: '0 0 14px' }}>
              The charge artwork — over <strong>2,000 heraldic charges</strong> — comes from{' '}
              <a href="https://drawshield.net" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>DrawShield</a>{' '}
              by Karl Wilcox (code GPL-3.0) and contributed art from{' '}
              <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>Wikimedia Commons</a>{' '}
              (notably User:Sodacan) and the Viking Answer Lady, used under{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>CC BY-SA</a>.
            </p>
            <p style={{ fontSize: 14, color: 'rgba(236,230,216,.78)', lineHeight: 1.65, margin: '0 0 14px' }}>
              Coats of arms you create here may incorporate this artwork and are likewise shared under
              CC BY-SA (attribution + share-alike). Recoloured charges are derivative works under the same terms.
            </p>
            <p style={{ fontSize: 13, color: 'rgba(236,230,216,.6)', margin: 0 }}>
              Full per-charge credits:{' '}
              <a href="https://github.com/gfrmin/blazon/blob/master/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>ATTRIBUTION.md</a>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
