import React, { useState } from 'react';
import Shield from './Shield.jsx';
import CreditsLink from './Credits.jsx';
import { HoverBtn, LangToggle, Lift } from './ui.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import { C, F, goldBtn, goldBtnHover, eyebrow, pageWash, parchSurface } from './theme.js';
import { GildedRule, FrameCorners, ParchInset, DropCap } from './components/Ornament.jsx';
import {
  TINCTURES, ORDINARY_ORDER, CHARGES, blazon, cap,
  HERO_FIELDS, HERO_SYMBOLS, HERO_INITIAL, contrastPool, pickContrast,
} from './heraldry.js';

const LOGO = (
  <svg width="28" height="32" viewBox="0 0 30 34">
    <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
    <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
  </svg>
);

// Three gallery arms, chosen to span the full range (warm/cool, all 7 tinctures).
const GALLERY = [
  { title: 'House of Calder',     design: { field: 'Or',     ordinary: 'saltire', ordinaryTincture: 'Gules', charges: [{ type: 'roundel',  tincture: 'Azure',  qty: 1 }] } },
  { title: 'The Aldermere Arms',  design: { field: 'Azure',  ordinary: 'bend',    ordinaryTincture: 'Or',    charges: [{ type: 'crescent', tincture: 'Argent', qty: 2 }] } },
  { title: 'Família Vendral',     design: { field: 'Argent', ordinary: 'chevron', ordinaryTincture: 'Sable', charges: [{ type: 'lozenge',  tincture: 'Gules',  qty: 3 }] } },
];

// Transaction-led pricing (the product is a one-time, emotional purchase, not a
// subscription). Free to create; pay once for the file or the framed print.
// The developer API lives in a quiet footnote, off the consumer grid.
const PRICING = [
  { tier: 'Create',  price: 'Free',  body: 'Design unlimited arms on screen. Share a watermarked image and view the blazon.' },
  { tier: 'Digital', price: <>$19<small style={{ fontSize: 15, color: C.muted2, fontFamily: F.sans }}> once</small></>, body: 'Your design, clean and watermark-free — hi-res PNG, SVG and a PDF certificate.' },
  { tier: 'Printed & Framed', price: <>$49<small style={{ fontSize: 15, color: C.muted2, fontFamily: F.sans }}> +</small></>, body: 'A3 giclée, framed and posted to your door. Rolled, unframed print from $29.', highlight: true },
  { tier: 'Membership', price: <>$9<small style={{ fontSize: 15, color: C.muted2, fontFamily: F.sans }}> /mo</small></>, body: 'For frequent makers: unlimited downloads, the full library and your saved arms.' },
];

export default function Landing({ onOpenStudio }) {
  const [hero, setHero] = useState(HERO_INITIAL);
  const [lang, setLang] = useState('formal');
  const [touched, setTouched] = useState(false);
  const [hoverPart, setHoverPart] = useState(null);

  const isMobile = useMediaQuery('(max-width: 720px)');
  const isTablet = useMediaQuery('(max-width: 1000px)');

  // ── Hero cycling (always tincture-rule valid via pickContrast) ──
  const cycleField = () => {
    setTouched(true);
    setHero((h) => {
      const next = HERO_FIELDS[(HERO_FIELDS.indexOf(h.field) + 1) % HERO_FIELDS.length];
      const ord = pickContrast(next, null);
      const charges = h.charges.length ? [{ ...h.charges[0], tincture: pickContrast(next, ord) }] : [];
      return { ...h, field: next, ordinaryTincture: ord, charges };
    });
  };
  const cycleOrdinary = () => {
    setTouched(true);
    setHero((h) => {
      const nextOrd = ORDINARY_ORDER[(ORDINARY_ORDER.indexOf(h.ordinary) + 1) % ORDINARY_ORDER.length];
      const pool = contrastPool(h.field);
      const nextT = pool[(pool.indexOf(h.ordinaryTincture) + 1) % pool.length];
      return { ...h, ordinary: nextOrd, ordinaryTincture: nextT };
    });
  };
  const cycleSymbol = () => {
    setTouched(true);
    setHero((h) => {
      const cur = h.charges.length ? `${h.charges[0].type}-${h.charges[0].qty}` : 'none';
      const keys = HERO_SYMBOLS.map((x) => (x ? `${x.type}-${x.qty}` : 'none'));
      const next = HERO_SYMBOLS[(keys.indexOf(cur) + 1) % HERO_SYMBOLS.length];
      const charges = next ? [{ type: next.type, qty: next.qty, tincture: pickContrast(h.field, h.ordinaryTincture) }] : [];
      return { ...h, charges };
    });
  };
  const surprise = () => {
    setTouched(true);
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

  const PAD = isMobile ? 20 : 36;
  const sectionWrap = { maxWidth: 1180, margin: '0 auto', padding: `0 ${PAD}px` };
  const sec = { ...sectionWrap, padding: `60px ${PAD}px` };
  const h2Style = { fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 30 : 42, margin: '14px 0 12px', textAlign: 'center', letterSpacing: '-.4px' };

  // Hero control rail row
  const ctrlBase = { display: 'flex', alignItems: 'center', gap: 12, background: C.panel2, border: '1px solid rgba(201,162,75,.28)', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', color: C.cream, textAlign: 'left', width: '100%' };
  const ctrlHover = { background: '#1E3A5C', border: `1px solid ${C.gold}` };
  const ctrlLabel = { fontSize: 10.5, letterSpacing: '.6px', color: C.muted2, width: 64, flex: 'none' };
  const ctrlValue = { fontFamily: F.serif, fontSize: 17, color: C.cream, flex: 1 };
  const cycleGlyph = <span style={{ fontSize: 15, color: C.gold }}>↻</span>;

  const navLink = { color: C.muted, textDecoration: 'none', fontSize: 14.5 };

  return (
    <div style={{ minHeight: '100vh', backgroundImage: pageWash, backgroundAttachment: 'fixed' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)', background: 'rgba(9,12,19,.74)', borderBottom: '1px solid rgba(201,162,75,.13)' }}>
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
            <HoverBtn onClick={onOpenStudio} style={{ ...goldBtn, padding: '11px 18px', fontSize: 14.5 }} hoverStyle={goldBtnHover}>Open the Studio</HoverBtn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ ...sectionWrap, padding: isMobile ? `40px ${PAD}px 36px` : '70px 36px 40px', display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.02fr .98fr', gap: isMobile ? 44 : 64, alignItems: 'center' }}>
        <div style={isTablet ? { order: 2 } : undefined}>
          <div style={eyebrow}>Design a coat of arms</div>
          <h1 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 40 : 62, lineHeight: 1.02, margin: '18px 0 24px', letterSpacing: '-.5px', textWrap: 'balance' }}>
            <DropCap>E</DropCap>very family has a story worth a coat&nbsp;of&nbsp;arms.
          </h1>
          <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.62, color: C.muted, maxWidth: '31em', margin: '0 0 32px' }}>Describe someone you love. We translate it into authentic heraldry — the same grammar heralds have used for eight hundred years — and render it in bold, flat colour.</p>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <HoverBtn onClick={onOpenStudio} style={{ ...goldBtn, padding: '15px 28px', fontSize: 16 }} hoverStyle={goldBtnHover}>Start with a description</HoverBtn>
            <a href="#how" style={{ color: C.cream, textDecoration: 'none', fontSize: 15, paddingBottom: 3, borderBottom: `1px solid ${C.lineHi}` }}>See how it works</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 30, color: C.muted2, fontSize: 12.5, letterSpacing: '.3px', flexWrap: 'wrap' }}>
            <span>No heraldry knowledge needed</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.lineHi }} />
            <span>2,000+ authentic charges</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.lineHi }} />
            <span>Print-ready</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, ...(isTablet ? { order: 1 } : null) }}>
          {/* The interactive coat of arms — framed like a manuscript plate */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 392, padding: '22px 22px 14px', border: `1px solid ${C.line}`, borderRadius: 14, background: 'radial-gradient(circle at 50% 40%, rgba(201,162,75,.10), rgba(15,24,38,.5) 70%)' }}>
            <FrameCorners />
            <Shield
              design={hero}
              interactive
              autoHint={!touched}
              hoverPart={hoverPart}
              onHover={setHoverPart}
              onField={cycleField}
              onOrdinary={cycleOrdinary}
              onCharge={cycleSymbol}
            />
          </div>

          <div style={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, letterSpacing: '1.5px', color: C.muted2 }}>TAP A PART TO CHANGE IT</span>
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
              <span style={ctrlValue}>{cap(hero.ordinary)}</span>
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

      {/* How it works — depth continuum (replaces the old persona "modes") */}
      <section style={sec} id="how">
        <GildedRule />
        <div style={{ textAlign: 'center', margin: '0 auto 12px', maxWidth: '42em' }}>
          <div style={eyebrow}>One screen, any depth</div>
          <h2 style={h2Style}>One coat of arms. As deep as you want to go.</h2>
          <p style={{ color: C.muted, fontSize: 16.5, lineHeight: 1.55, margin: '0 auto', maxWidth: '36em' }}>There are no modes to choose between. Begin with a sentence and stop there — or keep going, refining each element, right down to editing the blazon by hand. Underneath, it is always the same design.</p>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, 1fr)', gap: 26, marginTop: 46 }}>
          {!isTablet && <div style={{ position: 'absolute', top: 19, left: '12%', right: '12%', height: 2, background: `linear-gradient(90deg, rgba(201,162,75,.2), ${C.gold} 50%, rgba(201,162,75,.2))` }} />}
          {DEPTH_STEPS.map((s) => (
            <div key={s.n} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', zIndex: 2, width: 40, height: 40, margin: '0 auto 18px', borderRadius: '50%', background: C.bg, border: `1.6px solid ${C.gold}`, color: C.gold, fontFamily: F.serif, fontWeight: 600, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</div>
              <div style={{ fontSize: 10.5, letterSpacing: '1.8px', color: C.muted2, marginBottom: 5, textTransform: 'uppercase' }}>{s.kicker}</div>
              <h3 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 24, margin: '0 0 16px' }}>{s.title}</h3>
              <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 13, padding: 18, minHeight: 118, display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center', textAlign: 'left', marginBottom: 16 }}>
                {s.demo}
                <div style={{ fontSize: 11, color: C.muted2, letterSpacing: '.3px' }}>{s.cap}</div>
              </div>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.55, margin: '0 auto', maxWidth: '21em' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 16, fontFamily: F.serif, fontStyle: 'italic' }}>
          The data is always the blazon. <b style={{ color: C.cream, fontWeight: 600, fontStyle: 'normal', fontFamily: F.sans, fontSize: 15 }}>Slide deeper any time — nothing is ever lost, and there is nothing to switch.</b>
        </div>
      </section>

      {/* Gallery — parchment "certificates" */}
      <section style={sec} id="gallery">
        <GildedRule />
        <h2 style={h2Style}>Made with Blazon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 26, marginTop: 44 }}>
          {GALLERY.map((g) => (
            <Lift key={g.title} style={{ ...parchSurface, borderRadius: 6, padding: '30px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
              <ParchInset />
              <div style={{ width: 116 }}><Shield design={g.design} /></div>
              <div style={{ fontFamily: F.serif, fontSize: 23, fontWeight: 600, color: C.parchInk, margin: '18px 0 5px' }}>{g.title}</div>
              <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 14.5, color: C.parchInk2, lineHeight: 1.4 }}>{blazon(g.design, 'formal')}</div>
            </Lift>
          ))}
        </div>
      </section>

      {/* Pricing — transaction-led */}
      <section style={sec} id="pricing">
        <GildedRule />
        <h2 style={h2Style}>Pricing</h2>
        <p style={{ textAlign: 'center', color: C.muted, fontSize: 16.5, lineHeight: 1.55, margin: '0 auto', maxWidth: '34em' }}>Design for free. Pay once — for the file or the framed print — only when you love what you’ve made.</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18, marginTop: 44 }}>
          {PRICING.map((p) => (
            <Lift key={p.tier} style={{ background: p.highlight ? `linear-gradient(180deg, ${C.panel}, ${C.bg2})` : C.bg2, border: p.highlight ? `1.5px solid ${C.gold}` : `1px solid ${C.line}`, borderRadius: 14, padding: '28px 24px', position: 'relative' }}>
              {p.highlight && <div style={{ position: 'absolute', top: -11, left: 24, background: C.gold, color: C.goldInk, fontSize: 10, fontWeight: 700, letterSpacing: '1px', padding: '4px 11px', borderRadius: 20 }}>THE GIFT</div>}
              <div style={{ fontSize: 13.5, fontWeight: 600, color: p.highlight ? C.gold : C.muted }}>{p.tier}</div>
              <div style={{ fontFamily: F.serif, fontSize: 38, fontWeight: 600, margin: '10px 0 16px' }}>{p.price}</div>
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, margin: 0 }}>{p.body}</p>
            </Lift>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: C.muted2, fontSize: 13, marginTop: 24 }}>
          Building something with heraldry? <a href="#" style={{ color: C.gold, textDecoration: 'none' }}>Blazon API for developers — $29/mo →</a>
        </p>
      </section>

      {/* Gift CTA — illuminated parchment banner */}
      <section style={sec}>
        <div style={{ ...parchSurface, position: 'relative', borderRadius: 10, padding: isMobile ? 36 : '50px 54px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 44, overflow: 'hidden' }}>
          <ParchInset inset={10} />
          <div>
            <h2 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 30 : 40, margin: '0 0 10px', color: C.parchInk }}>Give someone a coat of arms.</h2>
            <p style={{ fontSize: 16, color: C.parchInk2, margin: 0, maxWidth: '34em', lineHeight: 1.55 }}>A print-ready A3 certificate, the blazon typeset by hand, posted to your door. The most personal gift you can design in ten minutes.</p>
          </div>
          <HoverBtn onClick={onOpenStudio} style={{ ...goldBtn, padding: '16px 32px', fontSize: 16, whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', boxShadow: '0 8px 22px rgba(120,90,30,.3)' }} hoverStyle={goldBtnHover}>Design a gift</HoverBtn>
        </div>
      </section>

      <footer style={{ padding: `36px ${PAD}px 40px`, textAlign: 'center', color: C.muted2, fontSize: 13 }}>
        <GildedRule maxWidth={340} filled />
        <div style={{ marginTop: 16 }}>Blazon — the heraldic manuscript, made digital. · <span style={{ fontFamily: F.serif, fontStyle: 'italic' }}>Per fess Or and Azure</span></div>
        <div style={{ marginTop: 14 }}><CreditsLink /></div>
      </footer>
    </div>
  );
}

// The three depths of the single experience (progressive disclosure made literal).
const DEPTH_STEPS = [
  {
    n: 'I', kicker: 'A sentence', title: 'Describe it', cap: '→ arms, drawn in seconds',
    body: 'Tell us about a person. We do the heraldry and hand back something finished.',
    demo: <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '11px 13px', fontSize: 13.5, color: C.cream, fontStyle: 'italic', fontFamily: F.serif }}>“A grandmother who loved the sea and kept bees.”</div>,
  },
  {
    n: 'II', kicker: 'The elements', title: 'Refine each part', cap: 'tap any element to change it',
    body: 'Swap tinctures, structure and symbols from a real charge library. The rules guide you as you go.',
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
    n: 'III', kicker: 'The blazon', title: 'Read & edit the words', cap: 'the formal blazon — editable, validated',
    body: 'Drop to the eight-centuries-old language itself, with live validation. Everything DrawShield should have been.',
    demo: (
      <div style={{ fontFamily: F.mono, fontSize: 12.5, lineHeight: 1.7 }}>
        <span style={{ color: C.gold }}>Azure</span><span style={{ color: C.muted }}>, a chevron </span><span style={{ color: '#D4AF52' }}>Or</span><span style={{ color: C.muted }}> between three bees </span><span style={{ color: C.cream }}>Argent</span>
      </div>
    ),
  },
];
