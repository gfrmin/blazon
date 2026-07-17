import React from 'react';
import Shield from '../Shield.jsx';
import Achievement from '../Achievement.jsx';
import { Lift } from '../ui.jsx';
import { ParchInset } from './Ornament.jsx';
import { C, F, parchSurface } from '../theme.js';
import { hasAchievement, blazon } from '../heraldry.js';

// The parchment "certificate" card — extracted from Landing's original
// inline gallery card (Task 18 §3, brief: "extract a LibraryCard from the
// Landing gallery's parchment card") so /library's real saved designs
// (src/Library.jsx) and Landing's illustrative gallery (src/Landing.jsx)
// share ONE component instead of two copies of the same markup drifting
// apart. Landing passes no `actions`/`unlocked` (purely illustrative, no
// per-design operations) — the thumbnail auto-picks a live <Achievement>
// (full crest/helm/supporters) when the design carries one, else the plain
// <Shield> escutcheon, same branch Studio itself uses for its preview.
export default function LibraryCard({ design, title, subtitle, unlocked = false, thumbWidth = 116, actions = null }) {
  const showAchievement = hasAchievement(design);
  return (
    <Lift style={{ ...parchSurface, borderRadius: 6, padding: '30px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
      <ParchInset />
      {unlocked && (
        <div style={{ position: 'absolute', top: 14, right: 14, background: C.gold, color: C.goldInk, fontSize: 10, fontWeight: 700, letterSpacing: '.6px', padding: '4px 9px', borderRadius: 20 }}>UNLOCKED</div>
      )}
      <div style={{ width: thumbWidth }}>
        {/* backfill={false}: an entry's coat carries its achievement exactly
            as the maker left it (a "just the shield" design must render as
            just the shield here too, not silently regrow a crest). */}
        {showAchievement ? <Achievement design={design} width="100%" backfill={false} /> : <Shield design={design} />}
      </div>
      <div style={{ fontFamily: F.serif, fontSize: 23, fontWeight: 600, color: C.parchInk, margin: '18px 0 5px' }}>{title}</div>
      <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 14.5, color: C.parchInk2, lineHeight: 1.4 }}>{subtitle || blazon(design, 'formal')}</div>
      {actions && <div style={{ marginTop: 16 }}>{actions}</div>}
    </Lift>
  );
}
