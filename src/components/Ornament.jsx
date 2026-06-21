import React from 'react';
import { C, F } from '../theme.js';

// Decorative manuscript motifs, shared by Landing and Studio. Pure SVG/markup
// (no pseudo-elements) so they compose with the app's inline-style approach.

// A gilded hairline rule with a centred lozenge ornament — section punctuation.
export function GildedRule({ maxWidth = 540, filled = false, style }) {
  const line = { height: 1, flex: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', margin: '0 auto', maxWidth, padding: '8px 0', ...style }}>
      <span style={{ ...line, background: `linear-gradient(90deg, transparent, ${C.lineHi})` }} />
      <svg width="38" height="12" viewBox="0 0 38 12" style={{ flex: 'none' }} aria-hidden="true">
        {filled
          ? <path d="M19,2 L23,6 L19,10 L15,6 Z" fill={C.gold} />
          : <><path d="M19,1 L24,6 L19,11 L14,6 Z" fill="none" stroke={C.gold} strokeWidth="1" /><circle cx="19" cy="6" r="1.4" fill={C.gold} /></>}
      </svg>
      <span style={{ ...line, background: `linear-gradient(90deg, ${C.lineHi}, transparent)` }} />
    </div>
  );
}

// Four gold corner brackets, absolutely positioned within a relative parent —
// frames the interactive shield in the hero.
export function FrameCorners({ color = C.gold }) {
  const base = { position: 'absolute', width: 22, height: 22, stroke: color, strokeWidth: 1.4, fill: 'none', opacity: 0.8 };
  const corner = (key, pos, transform) => (
    <svg key={key} viewBox="0 0 24 24" style={{ ...base, ...pos, transform }} aria-hidden="true">
      <path d="M2,22 V8 Q2,2 8,2 H22" />
    </svg>
  );
  return (
    <>
      {corner('tl', { top: 8, left: 8 })}
      {corner('tr', { top: 8, right: 8 }, 'scaleX(-1)')}
      {corner('bl', { bottom: 8, left: 8 }, 'scaleY(-1)')}
      {corner('br', { bottom: 8, right: 8 }, 'scale(-1,-1)')}
    </>
  );
}

// The thin inset border drawn inside a parchment card (a manuscript ruled edge).
export function ParchInset({ inset = 8 }) {
  return <span aria-hidden="true" style={{ position: 'absolute', inset, border: `1px solid ${C.parchRule}`, borderRadius: 4, pointerEvents: 'none' }} />;
}

// An illuminated drop-cap: the initial letter set large in a gilded box.
export function DropCap({ children }) {
  return (
    <span style={{
      float: 'left', fontFamily: F.serif, fontWeight: 700, fontSize: 92, lineHeight: 0.78,
      color: C.gold, margin: '8px 16px 0 0', padding: '10px 16px',
      border: `1.5px solid ${C.lineHi}`, borderRadius: 6,
      background: 'linear-gradient(160deg, rgba(201,162,75,.14), rgba(201,162,75,.03))',
      boxShadow: '0 0 0 4px rgba(201,162,75,.05)',
    }}>{children}</span>
  );
}
