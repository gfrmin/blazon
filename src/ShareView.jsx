import React, { useEffect, useRef, useState } from 'react';
import Shield from './Shield.jsx';
import Achievement from './Achievement.jsx';
import DownloadDialog from './components/DownloadDialog.jsx';
import { FrameCorners } from './components/Ornament.jsx';
import { HoverBtn, LangToggle } from './ui.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import { C, F, goldBtn, goldBtnHover, pageWash } from './theme.js';
import { navigate } from './router.js';
import { decodeCoat, designHash } from './share/codec.js';
import { blazon, hasAchievement } from './heraldry.js';
import { track, setSuperProps } from './analytics.js';

// Must match App.jsx's STUDIO_SOURCE_KEY / Studio.jsx's own read of it —
// "Make your own" opens Studio the same way every other CTA in the app does
// (a sessionStorage handoff read once on Studio's mount, then cleared).
const STUDIO_SOURCE_KEY = 'blazon:studio_source';

// Sets the arrived_via_share flag (task-7 brief §1) the same way the old
// ShareArrival component (App.jsx, pre-Task-18) did for every /a/ visit —
// this page's whole existence is a share arrival, so both routes into the
// Studio from here (Make your own / Open in Studio) set it, matching that
// prior unconditional behaviour rather than narrowing it to just one CTA.
function markArrivedViaShare() {
  try { sessionStorage.setItem('blazon:arrived_via_share', '1'); } catch { /* storage unavailable */ }
  setSuperProps({ arrived_via_share: true });
}

// ─────────────────────────────────────────────────────────────────────────
// /a/<payload> — the recipient view (Task 18 §1). This is the viral surface:
// a landing page for the NEXT user, not the editor. Replaces the old
// App.jsx ShareArrival, which used to decode-then-immediately-forward into
// Studio (see task-4-brief.md's forward-note "M3 presentation view will
// replace"). Bad payload → decodeCoat throws → redirect to `/`, same as
// before (M0/Task 4's router already treats that as the safety net).
//
// Presentation only: no header nav, no pricing, no editing affordances — the
// achievement, its motto, a READ-ONLY blazon bar (LangToggle + Copy, no
// edits), one quiet explanatory line, and the three CTAs.
// ─────────────────────────────────────────────────────────────────────────
export default function ShareView({ payload }) {
  const isMobile = useMediaQuery('(max-width: 520px)');
  const [coat, setCoat] = useState(null);
  const [lang, setLang] = useState('plain');
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const openedRef = useRef(false); // guards shared_view_opened firing once (StrictMode double-invoke safe)

  useEffect(() => {
    let cancelled = false;
    decodeCoat(payload)
      .then(async (decoded) => {
        if (cancelled) return;
        setCoat(decoded);
        if (openedRef.current) return;
        openedRef.current = true;
        // design_code = the designHash of the AST — NEVER the payload itself
        // and never free text (motto/description); see analytics.js's
        // SAFE_PROPS allowlist, which only knows `design_code` as a key, not
        // as "whatever string a caller hands it" — this is the one call-site
        // that produces the value.
        const hash = await designHash(decoded);
        if (!cancelled) track('shared_view_opened', { design_code: hash });
      })
      .catch(() => {
        if (!cancelled) navigate('/', { replace: true });
      });
    return () => { cancelled = true; };
  }, [payload]);

  // Decoding is synchronous-fast (no network) — render nothing during the
  // brief window before either the design lands or the redirect above fires.
  if (!coat) return null;

  const showAchievement = hasAchievement(coat);

  const makeOwn = () => {
    track('shared_view_cta', { cta: 'make_own' });
    track('remix_started');
    markArrivedViaShare();
    try { sessionStorage.setItem(STUDIO_SOURCE_KEY, 'share_recipient'); } catch { /* storage unavailable — Studio defaults to 'direct' */ }
    navigate('/studio'); // fresh describe step — no hash, this is NOT the shared design
  };

  const openInStudio = () => {
    track('shared_view_cta', { cta: 'open_in_studio' });
    track('remix_started');
    markArrivedViaShare();
    // Reuse the SAME payload string — Studio's own hash-restore effect
    // decodes it again on mount (the exact path a reload/bookmark already
    // exercises), which is also what reconnects `currentId` via §2b if this
    // design is already in the visitor's own library.
    navigate('/studio#' + payload);
  };

  const openDownload = () => {
    track('shared_view_cta', { cta: 'download' });
    setDownloadOpen(true);
  };

  const copyBlazon = () => {
    navigator.clipboard?.writeText(blazon(coat, 'formal')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundImage: pageWash, backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 64px' }}>
      {/* A bare wordmark, not a nav — brief: "No header nav clutter, no pricing on this page." */}
      <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 34 }}>
        <svg width="22" height="25" viewBox="0 0 30 34" aria-hidden="true">
          <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
          <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
        </svg>
        <span style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 19, color: C.cream, letterSpacing: '.3px' }}>Blazon</span>
      </a>

      {/* The achievement — centred on the dark wash inside the same
          FrameCorners plate treatment as Landing's hero. */}
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', padding: showAchievement ? '26px 26px 16px' : '30px', border: `1px solid ${C.line}`, borderRadius: 16, background: 'radial-gradient(circle at 50% 38%, rgba(201,162,75,.12), rgba(15,24,38,.55) 72%)' }}>
        <FrameCorners />
        {showAchievement ? (
          // backfill={false}: honour the design exactly as the maker left it
          // (a "just the shield" design must show as just the shield — see
          // the `!showAchievement` branch below, mirroring Studio's own
          // preview split).
          <Achievement design={coat} width="100%" backfill={false} />
        ) : (
          <div style={{ width: 220, margin: '0 auto' }}><Shield design={coat} /></div>
        )}
      </div>

      {/* The motto beneath — only in the bare-shield case: <Achievement>
          already carries its own motto scroll inside the composition above,
          so a separate caption here would double-show it (same rule Studio's
          own preview follows). */}
      {!showAchievement && coat.motto && coat.motto.trim() && (
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 23, color: C.gold, marginTop: 26, textAlign: 'center' }}>&ldquo;{coat.motto}&rdquo;</div>
      )}

      {/* Read-only blazon bar — the language↔image thesis does the
          explaining; LangToggle + Copy only, no edit affordances. Stacks on
          narrow screens (same responsive treatment as Studio's own blazon
          bar) — a fixed row here left the middle text column squeezed to a
          few characters wide on a phone. */}
      <div style={{ width: '100%', maxWidth: 520, background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 11, padding: isMobile ? '14px 16px' : '13px 16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 14, marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: 10 }}>
          <LangToggle value={lang} onFormal={() => setLang('formal')} onPlain={() => setLang('plain')} />
          {isMobile && (
            <button onClick={copyBlazon} style={{ flex: 'none', background: 'transparent', border: `1px solid ${C.lineHi}`, color: copied ? C.gold : C.cream, padding: '8px 14px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', fontFamily: F.sans }}>{copied ? 'Copied ✓' : 'Copy'}</button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {lang === 'formal'
            ? <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 17, color: C.cream }}>{blazon(coat, 'formal')}</span>
            : <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.4 }}>{blazon(coat, 'plain')}</span>}
        </div>
        {!isMobile && (
          <button onClick={copyBlazon} style={{ flex: 'none', background: 'transparent', border: `1px solid ${C.lineHi}`, color: copied ? C.gold : C.cream, padding: '8px 14px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', fontFamily: F.sans }}>{copied ? 'Copied ✓' : 'Copy'}</button>
        )}
      </div>

      {/* One quiet line of "what is this" copy. */}
      <p style={{ maxWidth: 440, textAlign: 'center', color: C.muted, fontSize: 14.5, lineHeight: 1.6, margin: '26px 0 4px' }}>
        Someone described a person, and this is what Blazon answered — a coat of arms, granted in a sentence.
      </p>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, marginTop: 22, width: '100%', maxWidth: 360 }}>
        <HoverBtn onClick={makeOwn} style={{ ...goldBtn, width: '100%', padding: '15px 22px', fontSize: 15.5 }} hoverStyle={goldBtnHover}>Make your own coat of arms →</HoverBtn>
        <button onClick={openInStudio} style={{ background: 'transparent', border: `1px solid ${C.lineHi}`, color: C.cream, width: '100%', padding: '13px 20px', borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: F.sans }}>Open this one in the Studio</button>
        <button onClick={openDownload} style={{ background: 'none', border: 'none', color: C.muted2, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', fontFamily: F.sans, padding: '6px 0 0', alignSelf: 'center' }}>Download</button>
      </div>

      {/* The SAME DownloadDialog every other surface uses — recipients can
          buy the $19 unlock for arms made FOR them (M4 makes the paid side
          live; free works now). */}
      <DownloadDialog open={downloadOpen} onClose={() => setDownloadOpen(false)} design={coat} surface="recipient" hasAchievement={coat ? hasAchievement(coat) : false} />
    </div>
  );
}
