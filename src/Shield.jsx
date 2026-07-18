import React, { useId } from 'react';
import { TINCTURES, tinctureHex, blazon } from './heraldry.js';
import { hasArt, artFile } from './charges/manifest.js';
import { useCharge, artKey } from './charges/recolor.js';
import { LOCAL_DIVISIONS, LOCAL_ORDINARIES, LOCAL_CHARGES, canRenderLocally } from './render-capabilities.js';

const SHIELD_PATH =
  'M18,14 H182 V108 C182,170 144,204 100,226 C56,204 18,170 18,108 Z';

// What this SVG renderer can draw natively — the SINGLE source of truth for
// local-render capability now lives in ./render-capabilities.js (so it can
// also be imported by the generation Pages Function without pulling in React
// or JSX). `OrdinaryEl` / `ChargeShape` / `DivisionEls` below handle exactly
// the LOCAL_* keys re-exported here; `canRenderLocally()` reads the same
// lists, so the Studio's "fall back to DrawShield?" decision can never drift
// from reality.
export { LOCAL_DIVISIONS, LOCAL_ORDINARIES, LOCAL_CHARGES, canRenderLocally };

// Root <svg> a11y role/label selection (task-21 review round 1 — "nested
// role=img collapses interactive zones" finding). `role="img"` is correct
// for a STATIC shield: WAI-ARIA collapses its entire subtree into one leaf,
// which is exactly right when there's nothing beneath it but decorative
// paths. But when `interactive` is true (Landing's driving-mode hero), the
// three zones below carry their own `role="button"`/`tabIndex`/`aria-label`
// (see `zoneA11y` below) — collapsing them under `role="img"` hides that
// from assistive tech even though they stay mouse- and keyboard-operable
// (DOM-level/Playwright drives don't see the difference, which is how this
// slipped through the original a11y sweep). `role="group"` is a plain,
// non-collapsing container: it still gets a name via `aria-label`, but its
// interactive descendants remain individually exposed. `ariaHidden` (the
// achievement's inner escutcheon, whose OWN root <svg> already carries the
// composition's single role="img"/aria-label) is unchanged either way — no
// role, no label, just aria-hidden.
export function rootA11y(interactive, ariaHidden) {
  if (ariaHidden) return { role: undefined, labelSuffix: '' };
  return interactive
    ? { role: 'group', labelSuffix: ' — tap a part to change it' }
    : { role: 'img', labelSuffix: '' };
}

// 5-point star points for a mullet.
function starPoints(cx, cy, r) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.4 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    out.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

// Adapt either the legacy flat design object OR a Coat AST into a small view
// model the renderer can draw. The legacy path is unchanged (the live
// components still emit it); the Coat path lets the deeper tiers render too.
function toShieldView(design) {
  if (typeof design.field === 'string') {
    return {
      field: { tincture: design.field },
      ordinary: design.ordinary ? { key: design.ordinary, tincture: design.ordinaryTincture } : null,
      charge: design.charges && design.charges[0]
        ? { type: design.charges[0].type, tincture: design.charges[0].tincture, qty: design.charges[0].qty }
        : null,
    };
  }
  const groups = design.charges || [];
  const prim = groups.find((g) => g.object && (g.object.kind === 'ordinary' || g.object.kind === 'subordinary'));
  const chg = groups.find((g) => g.object && g.object.kind === 'charge');
  return {
    field: design.field || {},
    ordinary: prim ? { key: prim.object.key, tincture: prim.tincture } : null,
    charge: chg ? { type: chg.object.key, tincture: chg.tincture, qty: chg.number, attitude: chg.object.attitude } : null,
  };
}

// Overlay regions for a divided field. The base shield is filled with the first
// tincture; these draw the second. Clipped to the shield by the parent group.
// Geometry is approximate (renderer grows over time); repeating patterns fall
// back to a plain field — a graceful, non-broken degrade.
function DivisionEls({ type, tinctures }) {
  const b = tinctureHex(tinctures && tinctures[1]);
  switch (type) {
    case 'per pale':    return <rect x={100} y={0} width={100} height={240} fill={b} />;
    case 'per fess':    return <rect x={0} y={120} width={200} height={120} fill={b} />;
    case 'quarterly':
      return (
        <g>
          <rect x={100} y={0} width={100} height={120} fill={b} />
          <rect x={0} y={120} width={100} height={120} fill={b} />
        </g>
      );
    case 'per bend':       return <polygon points="0,0 0,240 200,240" fill={b} />;
    case 'per bend sinister': return <polygon points="200,0 200,240 0,240" fill={b} />;
    case 'per saltire':
      return (
        <g>
          <polygon points="0,0 0,240 100,120" fill={b} />
          <polygon points="200,0 200,240 100,120" fill={b} />
        </g>
      );
    case 'per chevron': return <polygon points="0,240 100,140 200,240" fill={b} />;
    default:            return null; // paly/barry/chequy/… → plain field for now
  }
}

function OrdinaryEl({ type, hex }) {
  switch (type) {
    case 'fess':
      return <rect x={18} y={90} width={164} height={40} fill={hex} />;
    case 'pale':
      return <rect x={80} y={14} width={40} height={212} fill={hex} />;
    case 'bend':
      return <path d="M18,14 L52,14 L182,184 L182,226 L148,226 L18,56 Z" fill={hex} />;
    case 'cross':
      return (
        <g>
          <rect x={83} y={14} width={34} height={212} fill={hex} />
          <rect x={18} y={93} width={164} height={34} fill={hex} />
        </g>
      );
    case 'chevron':
      return <path d="M18,192 L100,108 L182,192 L182,156 L100,72 L18,156 Z" fill={hex} />;
    case 'saltire':
      return (
        <g>
          <path d="M18,14 L48,14 L182,186 L182,226 L152,226 L18,54 Z" fill={hex} />
          <path d="M182,14 L152,14 L18,186 L18,226 L48,226 L182,54 Z" fill={hex} />
        </g>
      );
    default:
      return null; // un-rendered ordinary/subordinary → graceful blank (text blazon still correct)
  }
}

function chargeSlots(n) {
  // Slots are lowered enough that each charge's box (size from chargeSize) clears
  // the shield's top edge (SHIELD_PATH starts at y=14) — otherwise tall figural
  // art gets flat-cut by the clip path.
  if (n <= 1) return [[100, 84]];
  if (n === 2) return [[60, 70], [140, 70]];
  return [[58, 64], [142, 64], [100, 150]];
}

function ChargeShape({ type, cx, cy, hex, fieldHex }) {
  if (type === 'roundel') return <circle cx={cx} cy={cy} r={19} fill={hex} />;
  if (type === 'lozenge')
    return <polygon points={`${cx},${cy - 23} ${cx + 17},${cy} ${cx},${cy + 23} ${cx - 17},${cy}`} fill={hex} />;
  if (type === 'crescent')
    return (
      <g>
        <circle cx={cx} cy={cy} r={19} fill={hex} />
        <circle cx={cx + 8} cy={cy - 5} r={16} fill={fieldHex} />
      </g>
    );
  if (type === 'mullet')
    return <polygon points={starPoints(cx, cy, 22)} fill={hex} stroke="rgba(0,0,0,.18)" strokeWidth={0.6} />;
  return null; // beasts/objects without art yet → graceful blank (offload to DrawShield later)
}

// Box size for a vendored (figural) charge, by how many appear.
const chargeSize = (n) => (n <= 1 ? 122 : n === 2 ? 86 : 66);

// A vendored DrawShield charge, recoloured to the tincture and fitted into a slot.
// `resolved` (pre-fetched art) is used for synchronous render (export); otherwise
// the art is fetched on the client via the hook.
function VendoredCharge({ file, hex, cx, cy, size, resolved }) {
  const fetched = useCharge(resolved ? null : file, hex);
  const art = resolved || fetched;
  if (!art) return null;
  return (
    <svg
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      viewBox={art.viewBox}
      fill={hex}
      preserveAspectRatio="xMidYMid meet"
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  );
}

/**
 * Shield renderer.
 *
 * Props:
 *  - design        the design object (legacy flat object OR a Coat AST)
 *  - interactive   enable click/hover affordances (hero)
 *  - autoHint      while true, zones "breathe" (stop once the user interacts)
 *  - hoverPart     'field' | 'ord' | 'chg' | null  (controlled hover highlight)
 *  - onHover(part) called on mouse enter/leave of a zone
 *  - onField / onOrdinary / onCharge  click handlers per zone
 *  - width         CSS width (default '100%')
 */
export default function Shield({
  design,
  interactive = false,
  autoHint = false,
  hoverPart = null,
  onHover,
  onField,
  onOrdinary,
  onCharge,
  width = '100%',
  chargeArt = null,
  ariaHidden = false,
}) {
  const uid = useId().replace(/[:]/g, '');
  const clip = `clip-${uid}`;
  const view = toShieldView(design);
  const division = view.field.division || null;
  const baseTincture = division ? (division.tinctures && division.tinctures[0]) : view.field.tincture;
  const fieldHex = tinctureHex(baseTincture, TINCTURES.Argent.hex);
  const ord = view.ordinary;
  const ordHex = ord ? tinctureHex(ord.tincture) : '#ECE6D8';
  const ch = view.charge;

  const enter = (p) => (interactive && onHover ? () => onHover(p) : undefined);
  const leave = interactive && onHover ? () => onHover(null) : undefined;

  // Keyboard equivalent of onClick for the interactive zones (task-21 a11y
  // sweep — these were mouse-only: a click handler with no tabIndex/role/
  // keydown is invisible to keyboard/screen-reader users even though it's
  // the hero's advertised interaction). Enter and Space both activate, same
  // as a native <button>; Space must preventDefault or the page would also
  // scroll.
  const zoneKeyDown = (handler) => (interactive && handler ? (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handler(e);
    }
  } : undefined);
  const zoneA11y = (part, handler, label) => (interactive ? {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onFocus: enter(part),
    onBlur: leave,
    onKeyDown: zoneKeyDown(handler),
  } : {});

  // Per-zone style: hover wins (brightness); else breathe while autoHint; else
  // the change-morph. NB: only set `filter` inline when hovering, so the
  // zonepulse keyframe controls brightness the rest of the time.
  const zoneStyle = (part, delay, base) => {
    const st = { cursor: interactive ? 'pointer' : 'default', transition: 'filter .2s ease', ...(base || {}) };
    if (interactive && hoverPart === part) st.filter = 'brightness(1.3)';
    else if (interactive && autoHint) st.animation = `zonepulse 1.6s ease-in-out infinite ${delay}`;
    else st.animation = 'chgpop .45s ease';
    return st;
  };

  const { role: rootRole, labelSuffix } = rootA11y(interactive, ariaHidden);

  return (
    <svg
      viewBox="0 0 200 240"
      width={width}
      role={rootRole}
      aria-label={ariaHidden ? undefined : `${blazon(design, 'formal')}${labelSuffix}`}
      aria-hidden={ariaHidden || undefined}
      style={{ display: 'block', filter: 'drop-shadow(0 16px 34px rgba(0,0,0,.5))' }}
    >
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>

      <path
        d={SHIELD_PATH}
        fill={fieldHex}
        onClick={interactive ? onField : undefined}
        onMouseEnter={enter('field')}
        onMouseLeave={leave}
        style={zoneStyle('field', '0s', { transition: 'fill .45s ease, filter .2s ease' })}
        {...zoneA11y('field', onField, 'Change the field colour')}
      />

      <g clipPath={`url(#${clip})`}>
        {division && (
          <g key={`div-${division.type}-${(division.tinctures || []).join('-')}`} style={{ animation: 'chgpop .45s ease' }}>
            <DivisionEls type={division.type} tinctures={division.tinctures} />
          </g>
        )}

        {ord && (
          <g
            key={`ord-${ord.key}-${ord.tincture}`}
            onClick={interactive ? onOrdinary : undefined}
            onMouseEnter={enter('ord')}
            onMouseLeave={leave}
            style={zoneStyle('ord', '.55s')}
            {...zoneA11y('ord', onOrdinary, 'Change the structure')}
          >
            <OrdinaryEl type={ord.key} hex={ordHex} />
          </g>
        )}

        {ch && (
          <g
            key={`chg-${ch.type}-${ch.tincture}-${ch.qty}`}
            onClick={interactive ? onCharge : undefined}
            onMouseEnter={enter('chg')}
            onMouseLeave={leave}
            style={zoneStyle('chg', '1.1s')}
            {...zoneA11y('chg', onCharge, 'Change the symbol')}
          >
            {chargeSlots(ch.qty || 1).map((p, i) => (
              // Geometric charges keep their crisp native shapes; everything else
              // renders from the vendored R2 art (if available).
              LOCAL_CHARGES.includes(ch.type) ? (
                <ChargeShape key={i} type={ch.type} cx={p[0]} cy={p[1]} hex={tinctureHex(ch.tincture)} fieldHex={fieldHex} />
              ) : hasArt(ch.type, ch.attitude) ? (
                <VendoredCharge
                  key={i}
                  file={artFile(ch.type, ch.attitude)}
                  hex={tinctureHex(ch.tincture)}
                  cx={p[0]}
                  cy={p[1]}
                  size={chargeSize(ch.qty || 1)}
                  // Keyed by file+hex (artKey), not file alone — the same
                  // file rendered in a different tincture elsewhere in the
                  // achievement (e.g. an Argent-lion crest alongside this
                  // Or-lion shield charge) must not collide in `chargeArt`.
                  // See src/charges/recolor.js's artKey doc comment.
                  resolved={chargeArt ? chargeArt[artKey(artFile(ch.type, ch.attitude), tinctureHex(ch.tincture))] : null}
                />
              ) : null
            ))}
          </g>
        )}
      </g>

      <path d={SHIELD_PATH} fill="none" stroke="#C9A24B" strokeWidth={3.5} style={{ pointerEvents: 'none' }} />
    </svg>
  );
}
