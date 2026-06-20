import React, { useState, useEffect } from 'react';

// Attribution surface (CC-BY-SA compliance): a small link that opens a modal
// crediting DrawShield + the Wikimedia heraldic artists whose charge art we use.
export default function CreditsLink({ style }) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    if (open && !credits) {
      fetch('/charges/attribution.json').then((r) => (r.ok ? r.json() : {})).then(setCredits).catch(() => setCredits({}));
    }
  }, [open, credits]);

  const link = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: 'rgba(236,230,216,.6)', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit',
    ...style,
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={link}>Artwork &amp; licences</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8,11,18,.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0F1826', border: '1px solid rgba(201,162,75,.3)', borderRadius: 14, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '26px 28px', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 26, margin: 0 }}>Artwork &amp; licences</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(236,230,216,.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(236,230,216,.78)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Charge artwork is sourced from{' '}
              <a href="https://drawshield.net" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>DrawShield</a>{' '}
              by Karl Wilcox (code GPL-3.0) and contributed heraldic art from{' '}
              <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>Wikimedia Commons</a>{' '}
              (notably User:Sodacan) and the Viking Answer Lady. It is used under{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A24B' }}>CC BY-SA</a>.
              Coats of arms you create here may incorporate this artwork and are likewise shared under CC BY-SA (attribution + share-alike).
            </p>
            <div style={{ fontSize: 11, color: 'rgba(236,230,216,.5)', letterSpacing: '.5px', margin: '18px 0 8px' }}>PER-CHARGE CREDITS</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {credits
                ? Object.entries(credits).sort().map(([file, v]) => (
                  <div key={file} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'rgba(236,230,216,.62)', borderBottom: '1px solid rgba(201,162,75,.08)', padding: '3px 0' }}>
                    <span style={{ fontFamily: "'Spline Sans Mono', monospace" }}>{file.replace('.svg', '')}</span>
                    <span style={{ textAlign: 'right', opacity: .85 }}>{v.artist.replace(/^https?:\/\/(commons\.)?/, '')}</span>
                  </div>
                ))
                : <span style={{ fontSize: 12, color: 'rgba(236,230,216,.45)' }}>Loading…</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
