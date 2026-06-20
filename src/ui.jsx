import React, { useState } from 'react';

// A button whose style merges `hoverStyle` over `style` while hovered.
// (Inline styles can't express :hover; this keeps us inline-only by design.)
export function HoverBtn({ style, hoverStyle, children, onMouseEnter, onMouseLeave, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      {...rest}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      style={hover ? { ...style, ...hoverStyle } : style}
    >
      {children}
    </button>
  );
}

// A circular tincture swatch with an active ring.
export function Swatch({ hex, active, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: '50%', background: hex, cursor: 'pointer', padding: 0,
        border: `2px solid ${active ? '#DBB85C' : 'rgba(236,230,216,.14)'}`,
        boxShadow: active ? '0 0 0 3px rgba(219,184,92,.35)' : 'none',
        transition: 'box-shadow .15s',
      }}
    />
  );
}

// A pill toggle button (used for ordinary/charge type selectors).
export function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 13px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
        border: `1px solid ${active ? '#C9A24B' : 'rgba(201,162,75,.22)'}`,
        background: active ? 'rgba(201,162,75,.18)' : 'transparent',
        color: active ? '#ECE6D8' : 'rgba(236,230,216,.7)',
      }}
    >
      {children}
    </button>
  );
}

// A small dimmed sub-label ("Its colour", "How many"…) used inside cards.
export function SubLabel({ children, style }) {
  return <div style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)', marginBottom: 8, ...style }}>{children}</div>;
}

// A "more…" disclosure: a labelled toggle that reveals its children on demand.
// The one place progressive disclosure is implemented — reused by every card so
// depth is reached in context, never via a mode switch.
export function Disclosure({ label, openLabel, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none', border: 'none', color: 'rgba(201,162,75,.85)', fontSize: 12,
          cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontWeight: 600, letterSpacing: '.3px',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, width: 10, textAlign: 'center' }}>{open ? '−' : '+'}</span>
        {open && openLabel ? openLabel : label}
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// The two-tab language toggle used by both blazon bars.
export function LangToggle({ value, onFormal, onPlain, plainLabel = 'Plain' }) {
  const btn = (on) => ({
    padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    background: on ? '#C9A24B' : 'transparent',
    color: on ? '#0C0F17' : 'rgba(236,230,216,.7)',
  });
  return (
    <div style={{ display: 'flex', background: '#16273E', borderRadius: 8, padding: 3 }}>
      <button onClick={onFormal} style={btn(value === 'formal')}>Blazon</button>
      <button onClick={onPlain} style={btn(value === 'plain')}>{plainLabel}</button>
    </div>
  );
}
