import React, { useState, useEffect, useMemo, useRef } from 'react';
import Shield from './Shield.jsx';
import Achievement from './Achievement.jsx';
import CreditsLink from './Credits.jsx';
import { HoverBtn, LangToggle, Lift, srOnly } from './ui.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import { C, F, goldBtn, goldBtnHover, eyebrow, pageWash, parchSurface } from './theme.js';
import { GildedRule, FrameCorners, ParchInset, DropCap } from './components/Ornament.jsx';
import LibraryCard from './components/LibraryCard.jsx';
import {
  TINCTURES, ORDINARY_ORDER, CHARGES, blazon, cap,
  HERO_FIELDS, HERO_SYMBOLS, REEL, contrastPool, pickContrast,
} from './heraldry.js';
import { fetchCharge } from './charges/recolor.js';
import { artFile } from './charges/manifest.js';
import { track } from './analytics.js';
import { navigate } from './router.js';
import { listDesigns } from './library.js';
import { PRICING_TIERS } from './pricing.js';
import { heroStudioUrl } from './hero.js';
import { useTypewriter } from './useTypewriter.js';

// Landing's own copy of the sessionStorage handoff key used to carry the
// `studio_opened{source}` attribution one hop ahead of navigate() (App.jsx's
// `openStudio`, Studio.jsx's own read, ShareView.jsx's own write — every
// caller keeps its own literal copy of this same string, commented "must
// match", rather than a shared export; see ShareView.jsx). The hero inline
// input needs this directly (not via the `onOpenStudio` prop) because it's
// the one CTA that also carries a `?desc=` query — `onOpenStudio(source)`
// only ever does a bare `navigate('/studio')`.
const STUDIO_SOURCE_KEY = 'blazon:studio_source';

const LOGO = (
  <svg width="28" height="32" viewBox="0 0 30 34">
    <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
    <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
  </svg>
);

// The hero input types the reel's own sentences — one source of truth for
// "what a description sounds like" (the reel then SHOWS what each becomes).
const HERO_PHRASES = REEL.map((s) => s.sentence);

// The heirloom vignette frames the reel's opening scene — the same
// grandmother the hero placeholder describes — completing the arc:
// sentence → arms → framed on the family wall.
const HEIRLOOM = { ...REEL[0].design, motto: REEL[0].motto };

// Three gallery arms, chosen to show the figural range (beast / flora / object)
// across warm and cool fields — not just the geometric charges.
const GALLERY = [
  { title: 'House of Calder',     design: { field: 'Gules', ordinary: null,      charges: [{ type: 'lion',  tincture: 'Or',     qty: 1, attitude: 'rampant' }] } },
  { title: 'The Aldermere Arms',  design: { field: 'Azure', ordinary: 'chevron', ordinaryTincture: 'Or', charges: [{ type: 'rose',  tincture: 'Argent', qty: 3 }] } },
  { title: 'Família Vendral',     design: { field: 'Or',    ordinary: null,      charges: [{ type: 'tower', tincture: 'Sable',  qty: 1 }] } },
];

export default function Landing({ onOpenStudio }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [hero, setHero] = useState(REEL[0].design);
  const [lang, setLang] = useState('formal');
  const [driving, setDriving] = useState(false); // user took the wheel (edit mode)
  const [paused, setPaused] = useState(false);    // auto-advance halted (still reel view)
  const [hoverPart, setHoverPart] = useState(null);
  const [heroDesc, setHeroDesc] = useState(''); // hero inline describe input (task-20 brief §3)
  const [heroFocused, setHeroFocused] = useState(false);
  const [printNoted, setPrintNoted] = useState(false); // the coming-soon print card's demand-signal tap

  const isMobile = useMediaQuery('(max-width: 720px)');
  const isTablet = useMediaQuery('(max-width: 1000px)');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  // The nav link only ever appears once there's something to see there
  // (task-18 brief §3) — re-read on every render (cheap; picks up a Save
  // that just happened without any extra state/effect of its own).
  const libraryNonEmpty = listDesigns().length > 0;

  // Ref-guarded (not a bare effect-on-mount) so StrictMode's dev-only
  // double-invoke of mount effects can't double-fire this "once" event —
  // the ref survives that synthetic remount even though the effect re-runs.
  const landingViewedRef = useRef(false);
  useEffect(() => {
    if (landingViewedRef.current) return;
    landingViewedRef.current = true;
    track('landing_viewed');
  }, []);

  // ── The reel: auto-advance through scenes until the visitor takes control ──
  const reelActive = !driving && !paused && !reduceMotion;
  useEffect(() => {
    if (!reelActive) return undefined;
    const id = setInterval(() => setSceneIdx((i) => (i + 1) % REEL.length), 5200);
    return () => clearInterval(id);
  }, [reelActive]);
  // In reel mode (incl. paused / reduced-motion) the shield follows the scene;
  // in drive mode the shield is the visitor's own working design.
  useEffect(() => {
    if (!driving) setHero(REEL[sceneIdx].design);
  }, [sceneIdx, driving]);
  // Warm the figural art so rotation is instant and the first scene paints fast.
  useEffect(() => {
    REEL.forEach((s) => {
      const c = s.design.charges && s.design.charges[0];
      const f = c && artFile(c.type, c.attitude);
      if (f) fetchCharge(f);
    });
  }, []);

  const scene = REEL[sceneIdx];
  const takeControl = () => { setDriving(true); setPaused(true); };
  const watchExamples = () => { setDriving(false); setPaused(false); };
  const goToScene = (i) => { setSceneIdx(i); setPaused(true); setDriving(false); track('hero_interacted', { control: 'reel_dot' }); };

  // ── Hero cycling (always tincture-rule valid via pickContrast) ──
  const cycleField = () => {
    takeControl();
    track('hero_interacted', { control: 'field' });
    setHero((h) => {
      const next = HERO_FIELDS[(HERO_FIELDS.indexOf(h.field) + 1) % HERO_FIELDS.length];
      const ord = pickContrast(next, null);
      const charges = h.charges.length ? [{ ...h.charges[0], tincture: pickContrast(next, ord) }] : [];
      return { ...h, field: next, ordinaryTincture: ord, charges };
    });
  };
  const cycleOrdinary = () => {
    takeControl();
    track('hero_interacted', { control: 'structure' });
    setHero((h) => {
      const nextOrd = ORDINARY_ORDER[(ORDINARY_ORDER.indexOf(h.ordinary) + 1) % ORDINARY_ORDER.length];
      const pool = contrastPool(h.field);
      const nextT = pool[(pool.indexOf(h.ordinaryTincture) + 1) % pool.length];
      return { ...h, ordinary: nextOrd, ordinaryTincture: nextT };
    });
  };
  const cycleSymbol = () => {
    takeControl();
    track('hero_interacted', { control: 'symbol' });
    setHero((h) => {
      const cur = h.charges.length ? `${h.charges[0].type}-${h.charges[0].qty}` : 'none';
      const keys = HERO_SYMBOLS.map((x) => (x ? `${x.type}-${x.qty}` : 'none'));
      const next = HERO_SYMBOLS[(keys.indexOf(cur) + 1) % HERO_SYMBOLS.length];
      const charges = next ? [{ type: next.type, qty: next.qty, tincture: pickContrast(h.field, h.ordinaryTincture) }] : [];
      return { ...h, charges };
    });
  };
  const surprise = () => {
    takeControl();
    track('hero_interacted', { control: 'surprise' });
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const field = pick(HERO_FIELDS);
    const ordinaryTincture = pickContrast(field, null);
    const sym = pick(HERO_SYMBOLS);
    setHero({
      field, ordinary: pick(ORDINARY_ORDER), ordinaryTincture,
      charges: sym ? [{ type: sym.type, qty: sym.qty, tincture: pickContrast(field, ordinaryTincture) }] : [],
    });
  };

  const symbolName = hero.charges.length
    ? CHARGES[hero.charges[0].type].label + (hero.charges[0].qty > 1 ? ` ×${hero.charges[0].qty}` : '')
    : 'None';

  // ── Hero inline describe input (task-20 brief §3, the activation lever) ──
  // Submits straight into Studio's `?desc=` arrival path (heroStudioUrl,
  // pure/tested in src/hero.js) so generation is already in flight the
  // instant Studio mounts — the exact path a preset chip's textarea submit
  // already exercises (Task 4/15), just entered from the hero instead of the
  // Studio describe step. An empty submit falls back to the plain "open a
  // blank Studio" behaviour the gold CTA always had (onOpenStudio('hero_cta')),
  // so this is additive, not a replacement of that path.
  // The placeholder types the reel's sentences out (Alon's feedback: a live
  // typing animation beats a static example). Runs only while the field is
  // empty AND unfocused AND motion is welcome — in every other case the
  // static first sentence shows, so nothing moves under a reader's cursor
  // and prefers-reduced-motion gets a perfectly still field. The visible
  // caret is part of the placeholder string itself (U+258F).
  const typewriterOn = !reduceMotion && !heroFocused && heroDesc === '';
  const typed = useTypewriter(HERO_PHRASES, typewriterOn);
  const heroPlaceholder = typewriterOn ? `${typed}▏` : HERO_PHRASES[0];

  const submitHeroDescribe = (e) => {
    e.preventDefault();
    const text = heroDesc.trim();
    if (!text) { onOpenStudio('hero_cta'); return; }
    try { sessionStorage.setItem(STUDIO_SOURCE_KEY, 'hero_inline'); } catch { /* storage unavailable — Studio defaults to 'direct' */ }
    navigate(heroStudioUrl(text));
  };

  // The "coming soon" print card's ONLY affordance — a demand signal, not a
  // purchase (task-20 brief §1). Same event, same no-props shape,
  // DownloadDialog's own coming-soon footnote already fires
  // (src/components/DownloadDialog.jsx's `noteInterest`).
  const notePrintInterest = () => {
    if (printNoted) return;
    track('print_interest_clicked');
    setPrintNoted(true);
  };

  // ── Reel achievements — full <Achievement> compositions, memoized to avoid
  // recompute when Landing re-renders for unrelated reasons (notably hero-input
  // keystrokes). Each auto-advance tick (~5200ms, setInterval above) swaps to a
  // different-keyed element, causing React to unmount and remount that scene's
  // <Achievement> — the SVG composition and effects re-run each tick, but charge
  // art is fetch-cached at module level (charges/recolor.js), so the cost is
  // acceptable. Achievement.jsx is already in the entry bundle (pulled in by
  // Studio.jsx/ShareView.jsx via App.jsx static import), so adding it here adds
  // zero bytes to what ships. Passive reel-viewing display only — NOT
  // interactive (no tap-to-cycle) — the moment the visitor taps
  // FIELD/STRUCTURE/SYMBOL/Surprise below, `takeControl()` flips `driving`
  // true and the display swaps to the exact same live interactive <Shield>
  // this hero has always used for editing, unchanged.
  const reelAchievements = useMemo(
    () => REEL.map((s, i) => <Achievement key={i} design={s.design} width="100%" />),
    [],
  );

  const PAD = isMobile ? 20 : 36;
  const sectionWrap = { maxWidth: 1180, margin: '0 auto', padding: `0 ${PAD}px` };
  const sec = { ...sectionWrap, padding: `60px ${PAD}px` };
  const h2Style = { fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 30 : 42, margin: '14px 0 12px', textAlign: 'center', letterSpacing: '-.4px' };

  // Hero control rail row
  const ctrlBase = { display: 'flex', alignItems: 'center', gap: 12, background: C.panel2, border: '1px solid rgba(201,162,75,.28)', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', color: C.cream, textAlign: 'left', width: '100%' };
  const ctrlHover = { background: '#1E3A5C', border: `1px solid ${C.gold}` };
  const ctrlLabel = { fontSize: 10.5, letterSpacing: '.6px', color: C.label, width: 64, flex: 'none' };
  const ctrlValue = { fontFamily: F.serif, fontSize: 17, color: C.cream, flex: 1 };
  const cycleGlyph = <span style={{ fontSize: 15, color: C.gold }}>↻</span>;

  const navLink = { color: C.muted, textDecoration: 'none', fontSize: 14.5 };

  return (
    <div style={{ minHeight: '100vh', backgroundImage: pageWash, backgroundAttachment: 'fixed' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(16px)', background: 'rgba(9,12,19,.92)', borderBottom: '1px solid rgba(201,162,75,.18)', boxShadow: '0 6px 24px rgba(0,0,0,.4)' }}>
        <div style={{ ...sectionWrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `16px ${PAD}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {LOGO}
            <span style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 25, letterSpacing: '.5px' }}>Blazon</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 32 }}>
            {!isMobile && <>
              <a href="#how" style={navLink}>How it works</a>
              <a href="#gallery" style={navLink}>Gallery</a>
              <a href="#pricing" style={navLink}>Pricing</a>
            </>}
            {libraryNonEmpty && (
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/library'); }} style={navLink}>Library</a>
            )}
            <HoverBtn onClick={() => onOpenStudio('nav')} style={{ ...goldBtn, padding: '11px 18px', fontSize: 14.5 }} hoverStyle={goldBtnHover}>Open the Studio</HoverBtn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ ...sectionWrap, padding: isMobile ? `40px ${PAD}px 36px` : '70px 36px 40px', display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.02fr .98fr', gap: isMobile ? 44 : 64, alignItems: 'center' }}>
        <div style={isTablet ? { order: 1 } : undefined}>
          <div style={eyebrow}>Arms, newly made</div>
          <h1 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 40 : 62, lineHeight: 1.02, margin: '18px 0 24px', letterSpacing: '-.5px', textWrap: 'balance' }}>
            <DropCap>W</DropCap>e still make arms. You just describe the&nbsp;person.
          </h1>
          <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.62, color: C.muted, maxWidth: '31em', margin: '0 0 32px' }}>Tell us who someone is — a name, a place, the thing they were known for. We answer the way heralds have for eight hundred years: with a coat of arms made for them alone.</p>
          {/* Hero inline describe input (task-20 brief §3) — the highest-leverage
              activation lever: type here, submit, and land in the Studio already
              generating (heroStudioUrl → /studio?desc=..., Studio's existing
              ?desc= arrival path, Task 4/15). A real (visually-hidden) <label>,
              not just the placeholder (task-21 a11y sweep — upgraded from the
              aria-label Task 20 shipped as an interim a11y basic). */}
          <form onSubmit={submitHeroDescribe} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="hero-describe-input" style={srOnly}>Describe someone, to design their coat of arms</label>
            <input
              id="hero-describe-input"
              value={heroDesc}
              onChange={(e) => setHeroDesc(e.target.value)}
              onFocus={() => setHeroFocused(true)}
              onBlur={() => setHeroFocused(false)}
              placeholder={heroPlaceholder}
              style={{ flex: '1 1 260px', minWidth: 220, background: C.panel2, border: `1px solid ${C.lineHi}`, borderRadius: 8, padding: '14px 16px', color: C.cream, fontSize: 15.5, fontFamily: F.sans }}
            />
            <HoverBtn type="submit" style={{ ...goldBtn, padding: '15px 28px', fontSize: 16, whiteSpace: 'nowrap' }} hoverStyle={goldBtnHover}>Describe someone →</HoverBtn>
          </form>
          <div style={{ marginTop: 14 }}>
            <a href="#how" style={{ color: C.cream, textDecoration: 'none', fontSize: 15, paddingBottom: 3, borderBottom: `1px solid ${C.lineHi}` }}>See how it works</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 30, color: C.label, fontSize: 12.5, letterSpacing: '.3px', flexWrap: 'wrap' }}>
            <span>No heraldry needed</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.lineHi }} />
            <span>2,000+ real heraldic symbols</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.lineHi }} />
            <span>Ready to frame</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, ...(isTablet ? { order: 2 } : null) }}>
          {/* Caption: the described person (reel) — or a cue that they're driving */}
          <div style={{ width: '100%', maxWidth: 392, minHeight: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {driving ? (
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '1.6px', color: C.gold, marginBottom: 7, textTransform: 'uppercase' }}>Your design</div>
                <div style={{ fontSize: 14, lineHeight: 1.4, color: C.muted }}>Tap a part to change it — or watch the examples again.</div>
              </div>
            ) : (
              <div key={sceneIdx} style={{ animation: 'fadein .5s ease' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '1.6px', color: C.gold, marginBottom: 7, textTransform: 'uppercase' }}>From a single sentence</div>
                <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 18.5, lineHeight: 1.34, color: C.cream }}>“{scene.sentence}”</div>
              </div>
            )}
          </div>

          {/* The coat of arms — framed like a manuscript plate. Reel view shows a
              full precomputed achievement (task-20 brief §4); the moment the
              visitor takes the wheel (taps a control below), this swaps to the
              exact same live interactive shield editing has always used. */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 392, padding: '22px 22px 14px', border: `1px solid ${C.line}`, borderRadius: 14, background: 'radial-gradient(circle at 50% 40%, rgba(201,162,75,.10), rgba(15,24,38,.5) 70%)' }}>
            <FrameCorners />
            {driving ? (
              <Shield
                design={hero}
                interactive
                autoHint={false}
                hoverPart={hoverPart}
                onHover={setHoverPart}
                onField={cycleField}
                onOrdinary={cycleOrdinary}
                onCharge={cycleSymbol}
              />
            ) : reelAchievements[sceneIdx]}
          </div>

          {/* The result: motto + the one-line reason (reel only) */}
          <div style={{ width: '100%', maxWidth: 392, minHeight: 50, textAlign: 'center' }}>
            {!driving && (
              <div key={sceneIdx} style={{ animation: 'fadein .5s ease' }}>
                <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 17, color: C.gold }}>“{scene.motto}”</div>
                <div style={{ fontSize: 12.5, color: C.label, marginTop: 4 }}>{scene.reason}</div>
              </div>
            )}
          </div>

          {/* Progress dots + a way back to the reel */}
          <div style={{ width: '100%', maxWidth: 392, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            {REEL.map((s, i) => (
              <button
                key={i}
                aria-label={`Example ${i + 1}`}
                onClick={() => goToScene(i)}
                style={{ width: !driving && i === sceneIdx ? 22 : 8, height: 8, borderRadius: 20, border: 'none', padding: 0, cursor: 'pointer', background: !driving && i === sceneIdx ? C.gold : 'rgba(201,162,75,.32)', transition: 'width .25s, background .25s' }}
              />
            ))}
            {(driving || paused) && (
              <HoverBtn onClick={watchExamples} style={{ marginLeft: 8, background: 'none', border: 'none', color: C.gold, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }} hoverStyle={{ color: C.cream }}>↻ Watch examples</HoverBtn>
            )}
          </div>

          <div style={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, letterSpacing: '1.5px', color: C.label }}>TAP A PART TO CHANGE IT</span>
              <HoverBtn
                onClick={surprise}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(201,162,75,.12)', border: `1px solid ${C.lineHi}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: C.gold, fontSize: 12.5, fontWeight: 600 }}
                hoverStyle={{ background: 'rgba(201,162,75,.24)', border: `1px solid ${C.gold}`, color: C.cream }}
              >⚄ Surprise me</HoverBtn>
            </div>

            <HoverBtn onClick={cycleField} onMouseEnter={() => setHoverPart('field')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
              <span style={{ width: 17, height: 17, borderRadius: '50%', flex: 'none', background: TINCTURES[hero.field].hex, border: '1px solid rgba(236,230,216,.25)' }} />
              <span style={ctrlLabel}>FIELD</span>
              <span style={ctrlValue}>{hero.field}</span>
              {cycleGlyph}
            </HoverBtn>
            <HoverBtn onClick={cycleOrdinary} onMouseEnter={() => setHoverPart('ord')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
              <span style={{ width: 17, height: 17, flex: 'none', borderRadius: 4, border: `1.5px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gold }}>✕</span>
              <span style={ctrlLabel}>STRUCTURE</span>
              <span style={ctrlValue}>{hero.ordinary ? cap(hero.ordinary) : 'None'}</span>
              {cycleGlyph}
            </HoverBtn>
            <HoverBtn onClick={cycleSymbol} onMouseEnter={() => setHoverPart('chg')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
              <span style={hero.charges.length
                ? { width: 17, height: 17, borderRadius: '50%', flex: 'none', background: TINCTURES[hero.charges[0].tincture].hex, border: '1px solid rgba(236,230,216,.25)' }
                : { width: 17, height: 17, borderRadius: '50%', flex: 'none', background: 'transparent', border: '1px dashed rgba(236,230,216,.35)' }} />
              <span style={ctrlLabel}>SYMBOL</span>
              <span style={ctrlValue}>{symbolName}</span>
              {cycleGlyph}
            </HoverBtn>
          </div>

          {/* Mini blazon bar — the language↔image thesis, in miniature */}
          <div style={{ width: '100%', maxWidth: 392, background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 11, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <LangToggle value={lang} onFormal={() => setLang('formal')} onPlain={() => setLang('plain')} />
            {lang === 'formal'
              ? <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontWeight: 500, fontSize: 18, color: C.cream, lineHeight: 1.25 }}>{blazon(hero, 'formal')}</span>
              : <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.35 }}>{blazon(hero, 'plain')}</span>}
          </div>
        </div>
      </section>

      {/* ── The heirloom vignette — the arms in situ, composed entirely from
          our own SVG renderer (no stock imagery). Frames REEL[0]'s design —
          the same grandmother the hero placeholder is busy typing about — so
          the page reads: sentence → arms → framed on the family wall. The
          scene is aria-hidden decoration; the copy column carries the same
          content in words (sentence, blazon, and the framed-heirloom idea). */}
      <section style={{ ...sectionWrap, padding: isMobile ? `8px ${PAD}px 30px` : `20px ${PAD}px 46px` }}>
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1.06fr', alignItems: 'stretch', borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.lineMid}`, background: C.bg2, boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          {/* Copy side */}
          <div style={{ padding: isMobile ? '32px 24px 28px' : '52px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div style={eyebrow}>Where it ends up</div>
            <h2 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 29 : 38, lineHeight: 1.08, margin: '14px 0 14px', letterSpacing: '-.3px', textWrap: 'balance' }}>One sentence becomes the thing on the family wall.</h2>
            <p style={{ color: C.muted, fontSize: 15.5, lineHeight: 1.62, margin: '0 0 28px', maxWidth: '30em' }}>
              “{REEL[0].sentence}” That was the whole brief. The arms it became — <span style={{ fontFamily: F.serif, fontStyle: 'italic', color: C.cream }}>{blazon(HEIRLOOM, 'formal')}</span> — now
              hang over the mantel, and they will still mean her to her great-grandchildren.
            </p>
            <HoverBtn onClick={() => onOpenStudio('heirloom_cta')} style={{ ...goldBtn, padding: '14px 26px', fontSize: 15.5 }} hoverStyle={goldBtnHover}>Make one for your family →</HoverBtn>
          </div>

          {/* Scene side: wall, picture light, corded gold frame, mantel, candle */}
          <div aria-hidden style={{ position: 'relative', minHeight: isMobile ? 400 : 460, background: 'linear-gradient(180deg, #16110A 0%, #0F0B06 72%, #090603 100%)', overflow: 'hidden' }}>
            {/* Picture-light glow washing down the wall */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(340px 240px at 50% 16%, rgba(201,162,75,.20), transparent 72%)' }} />
            {/* Laid-plaster texture, same recipe as the parchment surface */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(115deg, rgba(201,162,75,.03) 0 2px, transparent 2px 9px)' }} />

            {/* Cord + frame hang as one unit, seated just above the mantel */}
            <div style={{ position: 'absolute', bottom: 'calc(11% + 26px)', left: '50%', transform: 'translateX(-50%)', width: 'min(56%, 230px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg viewBox="0 0 100 26" style={{ width: '86%', overflow: 'visible', display: 'block' }}>
                <circle cx="50" cy="2.5" r="2" fill={C.gold} />
                <path d="M50,3 L4,26 M50,3 L96,26" stroke="rgba(201,162,75,.45)" strokeWidth="1" fill="none" />
              </svg>
              <div style={{ width: '100%', padding: 9, borderRadius: 3, background: 'linear-gradient(145deg, #DCBB66, #7A5E22 38%, #C9A24B 62%, #5E4718)', boxShadow: '0 26px 44px rgba(0,0,0,.62), 0 5px 12px rgba(0,0,0,.5)' }}>
                <div style={{ background: C.parch, backgroundImage: 'repeating-linear-gradient(135deg, rgba(120,100,60,.05) 0 2px, transparent 2px 7px)', padding: '14px 10px 8px', boxShadow: 'inset 0 1px 7px rgba(60,45,15,.42)' }}>
                  <Achievement design={HEIRLOOM} width="100%" />
                </div>
              </div>
            </div>

            {/* Mantel shelf + the hearth wall beneath it */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '11%', height: 15, background: 'linear-gradient(180deg, #55421F, #2E2210 85%)', boxShadow: '0 12px 20px rgba(0,0,0,.55), 0 -1px 0 rgba(220,187,102,.25)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '11%', background: 'linear-gradient(180deg, #251B0C, #130E06)' }} />

            {/* A candle on the mantel — one warm point of life in the scene */}
            <div style={{ position: 'absolute', bottom: 'calc(11% + 15px)', right: '13%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 5, height: 9, borderRadius: '50% 50% 45% 45%', background: 'radial-gradient(circle at 50% 65%, #F3D98B, #C9A24B 75%)', boxShadow: '0 0 18px 7px rgba(220,187,102,.30)' }} />
              <div style={{ width: 9, height: 30, borderRadius: 2, background: 'linear-gradient(180deg, #E4DCC8, #B7AD92)', marginTop: 1 }} />
              <div style={{ width: 16, height: 4, borderRadius: 2, background: '#7A5E22', marginTop: -1 }} />
            </div>
          </div>
        </div>
      </section>

      {/* How it works — depth continuum (replaces the old persona "modes") */}
      <section style={sec} id="how">
        <GildedRule />
        <div style={{ textAlign: 'center', margin: '0 auto 12px', maxWidth: '42em' }}>
          <div style={eyebrow}>As shallow or as deep as you like</div>
          <h2 style={h2Style}>Begin with a sentence. Stop there — or go all the way down.</h2>
          <p style={{ color: C.muted, fontSize: 16.5, lineHeight: 1.55, margin: '0 auto', maxWidth: '36em' }}>Most people describe a person, love what comes back, and frame it. But every choice is yours to make by hand — right down to the words of the blazon itself. You decide how far in to go.</p>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, 1fr)', gap: 26, marginTop: 46 }}>
          {!isTablet && <div style={{ position: 'absolute', top: 19, left: '12%', right: '12%', height: 2, background: `linear-gradient(90deg, rgba(201,162,75,.2), ${C.gold} 50%, rgba(201,162,75,.2))` }} />}
          {DEPTH_STEPS.map((s) => (
            <div key={s.n} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', zIndex: 2, width: 40, height: 40, margin: '0 auto 18px', borderRadius: '50%', background: C.bg, border: `1.6px solid ${C.gold}`, color: C.gold, fontFamily: F.serif, fontWeight: 600, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</div>
              <div style={{ fontSize: 10.5, letterSpacing: '1.8px', color: C.label, marginBottom: 5, textTransform: 'uppercase' }}>{s.kicker}</div>
              <h3 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 24, margin: '0 0 16px' }}>{s.title}</h3>
              <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 13, padding: 18, minHeight: 118, display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center', textAlign: 'left', marginBottom: 16 }}>
                {s.demo}
                <div style={{ fontSize: 11, color: C.label, letterSpacing: '.3px' }}>{s.cap}</div>
              </div>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.55, margin: '0 auto', maxWidth: '21em' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 16, fontFamily: F.serif, fontStyle: 'italic' }}>
          <b style={{ color: C.cream, fontWeight: 600, fontStyle: 'normal', fontFamily: F.sans, fontSize: 15 }}>However far in you go, nothing is locked and nothing is lost.</b>
        </div>
      </section>

      {/* Gallery — parchment "certificates" */}
      <section style={sec} id="gallery">
        <GildedRule />
        <h2 style={h2Style}>Made with Blazon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 26, marginTop: 44 }}>
          {GALLERY.map((g) => (
            <LibraryCard key={g.title} design={g.design} title={g.title} />
          ))}
        </div>
      </section>

      {/* Pricing — reconciled to what actually ships (task-20 brief §1): Free,
          the $19 Files purchase (highlighted — the one buyable thing), and a
          muted, non-buy "coming soon" print card whose only affordance is the
          print_interest_clicked demand signal. No Membership tier, no API
          footnote — neither is in MVP scope (Task 6 review). */}
      <section style={sec} id="pricing">
        <GildedRule />
        <h2 style={h2Style}>Pricing</h2>
        <p style={{ textAlign: 'center', color: C.muted, fontSize: 16.5, lineHeight: 1.55, margin: '0 auto', maxWidth: '34em' }}>Design for free. Take the finished files for $19 when you love what you’ve made — the print edition is on its way.</p>
        {/* Tablet (721–1000px) gets its own 2-col treatment (task-21 Minor,
            folded in from Task 20's review) — 3-up read as cramped at that
            width. The lone coming-soon "Printed & framed" card spans the
            full row beneath the two real (buyable/free) tiers rather than
            sitting alone in a half-empty second row. */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 18, marginTop: 44 }}>
          {PRICING_TIERS.map((p) => {
            const cardStyle = {
              background: p.highlight ? `linear-gradient(180deg, ${C.panel}, ${C.bg2})` : C.bg2,
              border: p.highlight ? `1.5px solid ${C.gold}` : `1px solid ${C.line}`,
              borderRadius: 14, padding: '28px 24px', position: 'relative',
              opacity: p.comingSoon ? 0.6 : 1,
              width: '100%', textAlign: 'left', fontFamily: 'inherit',
              gridColumn: isTablet && !isMobile && p.comingSoon ? '1 / -1' : undefined,
            };
            return (
              <Lift
                key={p.id}
                as={p.comingSoon ? 'button' : 'div'}
                // aria-disabled, not the native `disabled` attribute (task-21
                // — closes a Task 6 review Minor forward-noted for M5 a11y):
                // a real `disabled` button loses focus the instant it flips,
                // which would fling a keyboard user's focus back to <body>
                // right after they activated it. notePrintInterest is
                // already idempotent-guarded (`if (printNoted) return`), so
                // nothing relies on the native attribute for correctness.
                {...(p.comingSoon ? { type: 'button', onClick: notePrintInterest, 'aria-disabled': printNoted || undefined } : {})}
                style={{ ...cardStyle, cursor: p.comingSoon ? (printNoted ? 'default' : 'pointer') : 'default' }}
              >
                {p.highlight && <div style={{ position: 'absolute', top: -11, left: 24, background: C.gold, color: C.goldInk, fontSize: 10, fontWeight: 700, letterSpacing: '1px', padding: '4px 11px', borderRadius: 20 }}>OWN IT</div>}
                <div style={{ fontSize: 13.5, fontWeight: 600, color: p.highlight ? C.gold : C.muted }}>{p.tier}{p.comingSoon && ' · coming soon'}</div>
                <div style={{ fontFamily: F.serif, fontSize: 38, fontWeight: 600, margin: '10px 0 16px' }}>
                  {p.priceLabel}{p.priceSuffix && <small style={{ fontSize: 15, color: C.label, fontFamily: F.sans }}> {p.priceSuffix}</small>}
                </div>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, margin: 0 }}>{p.body}</p>
                {p.comingSoon && (
                  // role="status" (task-21 — the other half of the same Task
                  // 6 Minor): announces the "Noted" confirmation to screen
                  // reader users, who otherwise get no feedback at all that
                  // their tap registered.
                  <div role="status" style={{ fontSize: 12, color: printNoted ? C.gold : C.label, marginTop: 14, textDecoration: printNoted ? 'none' : 'underline' }}>
                    {printNoted ? 'Noted — we’ll let you know.' : 'Tap to say you’d buy this →'}
                  </div>
                )}
              </Lift>
            );
          })}
        </div>
      </section>

      {/* Gift CTA — illuminated parchment banner */}
      <section style={sec}>
        <div style={{ ...parchSurface, position: 'relative', borderRadius: 10, padding: isMobile ? 36 : '50px 54px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 44, overflow: 'hidden' }}>
          <ParchInset inset={10} />
          <div>
            <h2 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 30 : 40, margin: '0 0 10px', color: C.parchInk }}>Give someone a coat of arms.</h2>
            <p style={{ fontSize: 16, color: C.parchInk2, margin: 0, maxWidth: '34em', lineHeight: 1.55 }}>A coat of arms made for one person — send them the link, or take the files and frame it yourself. The most personal gift you can design in ten minutes.</p>
          </div>
          <HoverBtn onClick={() => onOpenStudio('gift_banner')} style={{ ...goldBtn, padding: '16px 32px', fontSize: 16, whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', boxShadow: '0 8px 22px rgba(120,90,30,.3)' }} hoverStyle={goldBtnHover}>Design a gift</HoverBtn>
        </div>
      </section>

      <footer style={{ padding: `36px ${PAD}px 40px`, textAlign: 'center', color: C.label, fontSize: 13 }}>
        <GildedRule maxWidth={340} filled />
        <div style={{ marginTop: 16 }}>Blazon — heraldry for everyone. · <span style={{ fontFamily: F.serif, fontStyle: 'italic' }}>Per fess Or and Azure</span></div>
        <div style={{ marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Every coat of arms here is an original you design and adopt — not an official grant, and not the “arms of a surname” (heraldry has never worked that way). Blazon is a design studio, not a heraldic authority, and isn’t affiliated with one.
        </div>
        <div style={{ marginTop: 14 }}><CreditsLink /></div>
      </footer>
    </div>
  );
}

// The three depths of the single experience (progressive disclosure made literal).
const DEPTH_STEPS = [
  {
    n: 'I', kicker: 'A sentence', title: 'Describe a person', cap: '→ arms in seconds',
    body: 'Tell us about someone. We turn it into a real coat of arms and hand it back, finished.',
    demo: <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '11px 13px', fontSize: 13.5, color: C.cream, fontStyle: 'italic', fontFamily: F.serif }}>“A grandmother who loved the sea and kept bees.”</div>,
  },
  {
    n: 'II', kicker: 'The pieces', title: 'Change anything', cap: 'tap to swap a colour or symbol',
    body: 'Swap any colour, shape or symbol from a library of two thousand. We keep it correct so you never have to learn the rules.',
    demo: (
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {[['Field', '#1F4E7A'], ['Chevron', '#D4AF52'], ['Bee ×3', '#E7E1D3']].map(([t, c]) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.panel2, border: '1px solid rgba(201,162,75,.3)', borderRadius: 7, padding: '6px 10px', fontSize: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />{t}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: 'III', kicker: 'The blazon', title: 'Down to the words', cap: 'the formal description — yours to edit',
    body: 'Every coat of arms has a formal written description — its blazon. Read it, edit it, and watch the shield change to match.',
    demo: (
      <div style={{ fontFamily: F.mono, fontSize: 12.5, lineHeight: 1.7 }}>
        <span style={{ color: C.gold }}>Azure</span><span style={{ color: C.muted }}>, a chevron </span><span style={{ color: '#D4AF52' }}>Or</span><span style={{ color: C.muted }}> between three bees </span><span style={{ color: C.cream }}>Argent</span>
      </div>
    ),
  },
];
