import React, { useId } from 'react';
import { TINCTURES, blazon } from './heraldry.js';

const SHIELD_PATH =
  'M18,14 H182 V108 C182,170 144,204 100,226 C56,204 18,170 18,108 Z';

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
    default:
      return (
        <g>
          <path d="M18,14 L48,14 L182,186 L182,226 L152,226 L18,54 Z" fill={hex} />
          <path d="M182,14 L152,14 L18,186 L18,226 L48,226 L182,54 Z" fill={hex} />
        </g>
      );
  }
}

function chargeSlots(n) {
  if (n <= 1) return [[100, 60]];
  if (n === 2) return [[60, 56], [140, 56]];
  return [[58, 54], [142, 54], [100, 150]];
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
  // mullet
  return <polygon points={starPoints(cx, cy, 22)} fill={hex} stroke="rgba(0,0,0,.18)" strokeWidth={0.6} />;
}

/**
 * Shield renderer.
 *
 * Props:
 *  - design        the design object
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
}) {
  const uid = useId().replace(/[:]/g, '');
  const clip = `clip-${uid}`;
  const fieldHex = TINCTURES[design.field].hex;
  const ordHex = TINCTURES[design.ordinaryTincture]?.hex ?? '#ECE6D8';
  const ch = design.charges && design.charges.length ? design.charges[0] : null;

  const enter = (p) => (interactive && onHover ? () => onHover(p) : undefined);
  const leave = interactive && onHover ? () => onHover(null) : undefined;

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

  return (
    <svg
      viewBox="0 0 200 240"
      width={width}
      role="img"
      aria-label={blazon(design, 'formal')}
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
      />

      <g clipPath={`url(#${clip})`}>
        <g
          key={`ord-${design.ordinary}-${design.ordinaryTincture}`}
          onClick={interactive ? onOrdinary : undefined}
          onMouseEnter={enter('ord')}
          onMouseLeave={leave}
          style={zoneStyle('ord', '.55s')}
        >
          <OrdinaryEl type={design.ordinary} hex={ordHex} />
        </g>

        {ch && (
          <g
            key={`chg-${ch.type}-${ch.tincture}-${ch.qty}`}
            onClick={interactive ? onCharge : undefined}
            onMouseEnter={enter('chg')}
            onMouseLeave={leave}
            style={zoneStyle('chg', '1.1s')}
          >
            {chargeSlots(ch.qty || 1).map((p, i) => (
              <ChargeShape key={i} type={ch.type} cx={p[0]} cy={p[1]} hex={TINCTURES[ch.tincture].hex} fieldHex={fieldHex} />
            ))}
          </g>
        )}
      </g>

      <path d={SHIELD_PATH} fill="none" stroke="#C9A24B" strokeWidth={3.5} style={{ pointerEvents: 'none' }} />
    </svg>
  );
}
