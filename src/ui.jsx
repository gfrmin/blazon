import React, { useState, useEffect, useId } from 'react';
import { C, F } from './theme.js';

// Shared UI primitives. Inline-styled by design; all colours come from theme.js
// so Landing and Studio stay in lockstep.

// Visually-hidden but still in the a11y tree — the standard "sr-only"
// clip-rect technique (not `display:none`/`visibility:hidden`, which would
// remove it from the accessible name computation too). Used to pair a real
// `<label>` with an input styled from its placeholder alone (task-21 a11y
// sweep — a placeholder is not an accessible name; it disappears once
// there's text, and many screen readers don't expose it as a label at all).
export const srOnly = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

// Tab-key focus trap for a modal panel: when Tab/Shift+Tab would carry focus
// outside `panelRef`'s subtree, it wraps back around to the other end
// instead (task-21 a11y sweep — DownloadDialog/Credits already moved focus
// in on open and Esc-closed, but neither actually kept Tab from walking out
// into the page behind the overlay). Call from inside a component's own
// `keydown` handler alongside its own Escape branch, not as a listener of
// its own — callers each already run their own single document `keydown`
// listener per open dialog, and a second one would just double the wiring
// for no benefit.
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function trapTabKey(e, panelRef) {
  if (e.key !== 'Tab') return;
  const root = panelRef.current;
  if (!root) return;
  const focusables = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

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

// A non-button element that lifts on hover (gallery / pricing cards).
export function Lift({ as: Tag = 'div', style, hoverStyle, lift = -3, children, ...rest }) {
  const [hover, setHover] = useState(false);
  const merged = hover
    ? { ...style, transform: `translateY(${lift}px)`, ...hoverStyle }
    : style;
  return (
    <Tag {...rest} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ transition: 'transform .18s, border-color .18s', ...merged }}>
      {children}
    </Tag>
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
        border: `2px solid ${active ? C.goldBr : 'rgba(236,230,216,.14)'}`,
        boxShadow: active ? '0 0 0 3px rgba(219,184,92,.35)' : 'none',
        transition: 'box-shadow .15s, border-color .15s',
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
        border: `1px solid ${active ? C.gold : C.lineMid}`,
        background: active ? 'rgba(201,162,75,.18)' : 'transparent',
        color: active ? C.cream : C.muted,
        fontFamily: F.sans, transition: 'border-color .15s, background .15s, color .15s',
      }}
    >
      {children}
    </button>
  );
}

// A small dimmed sub-label ("Its colour", "How many"…) used inside cards.
export function SubLabel({ children, style }) {
  return <div style={{ fontSize: 11.5, color: C.muted2, marginBottom: 8, ...style }}>{children}</div>;
}

// A "more…" disclosure: a labelled toggle that reveals its children on demand.
// The one place progressive disclosure is implemented — reused by every card so
// depth is reached in context, never via a mode switch.
export function Disclosure({ label, openLabel, children, defaultOpen = false, onToggle }) {
  const [open, setOpen] = useState(defaultOpen);
  // Not a functional setOpen(o => ...) updater: onToggle is a side effect
  // (it fires charge_search_used), and StrictMode double-invokes updater
  // functions, which would double-fire it (review round 1, Finding 3).
  const toggle = () => { const next = !open; onToggle?.(next); setOpen(next); };
  return (
    <div>
      <button
        onClick={toggle}
        style={{
          background: 'none', border: 'none', color: 'rgba(201,162,75,.85)', fontSize: 12,
          cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontWeight: 600, letterSpacing: '.3px', fontFamily: F.sans,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, width: 10, textAlign: 'center' }}>{open ? '−' : '+'}</span>
        {open && openLabel ? openLabel : label}
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// A small anchored popover: click the trigger to open; an invisible
// full-screen overlay-click or Esc closes it (the DownloadDialog a11y
// basics, scaled down from a full-screen modal to a flyout). Task 18 extracts
// this as the ONE primitive behind both the Studio header's Share control
// (src/components/SharePopover.jsx) and its mobile "⋯" overflow menu — do not
// hand-roll a second open/outside-click/Esc implementation anywhere else.
//
// `trigger` and `children` are render props: `trigger(toggle, open)` lets a
// caller style its own trigger element (a header button, a MenuItem row when
// nested inside another MenuPopover's panel, …); `children(close)` lets menu
// items close the popover after acting (or, like SharePopover's "Copy link",
// deliberately NOT call it, so a "Copied ✓" confirmation stays visible).
// `onOpen` fires exactly once per open transition — SharePopover uses it for
// `share_opened`, so that event reflects "the visitor actually revealed the
// share options", not merely "some ancestor menu is open".
export function MenuPopover({ trigger, children, label, align = 'right', width = 220, onOpen }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) onOpen?.();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {trigger(toggle, open)}
      {open && (
        <>
          {/* Invisible, full-screen — catches an outside click without dimming
              the page (this is a flyout, not a modal). */}
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 69 }} />
          <div
            role="menu"
            aria-label={label}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', [align]: 0, zIndex: 70,
              minWidth: width, background: C.panel, border: `1px solid ${C.lineHi}`,
              borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,.5)', padding: 8,
            }}
          >
            {typeof children === 'function' ? children(close) : children}
          </div>
        </>
      )}
    </div>
  );
}

// A small "i" info badge that reveals an explanatory popover on click/Enter/
// Space (task-21 a11y sweep — replaces a `title`-only tooltip, which is
// mouse-hover-only and unreachable from the keyboard entirely). Same
// open/Esc-close shape as MenuPopover above, scaled down to one
// informational panel rather than a list of actions: a real `<button>`
// (keyboard-focusable by default) with `aria-expanded` + `aria-controls`, and
// a `role="note"` panel (informational content, not a set of menu actions).
export function InfoTip({ label, children, placement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        style={{
          width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(201,162,75,.5)',
          color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontStyle: 'italic', cursor: 'pointer', fontFamily: F.serif, padding: 0,
          background: open ? 'rgba(201,162,75,.16)' : 'transparent', flex: 'none',
        }}
      >i</button>
      {open && (
        <>
          {/* Invisible outside-click catcher, same as MenuPopover — a flyout, not a dimmed modal. */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 69 }} />
          <div
            id={panelId}
            role="note"
            style={{
              position: 'absolute', left: 0, zIndex: 70,
              // 'bottom' (default) opens downward, panel below the trigger;
              // 'top' opens upward, panel above it — for triggers anchored
              // near the bottom of the viewport (Studio's blazon bar sits at
              // the very bottom of the screen, so a downward-opening panel
              // there ran off-screen — caught live during the task-21
              // keyboard drive).
              ...(placement === 'top' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
              width: 240, background: C.panel, border: `1px solid ${C.lineHi}`,
              borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,.5)', padding: '12px 14px',
              fontSize: 12.5, color: C.muted, lineHeight: 1.5, fontFamily: F.sans,
            }}
          >{children}</div>
        </>
      )}
    </div>
  );
}

// A single row inside a MenuPopover panel — plain HoverBtn styling, block-
// width, left-aligned text (a "menu item" look, not a pill/button look).
export function MenuItem({ onClick, children, style }) {
  return (
    <HoverBtn
      onClick={onClick}
      role="menuitem"
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
        padding: '9px 10px', borderRadius: 6, color: C.cream, fontSize: 13.5, cursor: 'pointer',
        fontFamily: F.sans, whiteSpace: 'nowrap', ...style,
      }}
      hoverStyle={{ background: 'rgba(201,162,75,.14)' }}
    >{children}</HoverBtn>
  );
}

// The two-tab language toggle used by both blazon bars.
export function LangToggle({ value, onFormal, onPlain, plainLabel = 'Plain' }) {
  const btn = (on) => ({
    padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: F.sans,
    background: on ? C.gold : 'transparent',
    color: on ? C.goldInk : C.muted,
  });
  return (
    <div style={{ display: 'flex', background: C.panel2, borderRadius: 8, padding: 3 }}>
      <button onClick={onFormal} style={btn(value === 'formal')}>Blazon</button>
      <button onClick={onPlain} style={btn(value === 'plain')}>{plainLabel}</button>
    </div>
  );
}
