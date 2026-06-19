import React, { useState } from 'react';
import Shield from './Shield.jsx';
import { HoverBtn, LangToggle } from './ui.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import {
  TINCTURES, ORDINARY_ORDER, CHARGES, blazon, cap,
  HERO_FIELDS, HERO_SYMBOLS, HERO_INITIAL, contrastPool, pickContrast,
} from './heraldry.js';

const LOGO = (
  <svg width="30" height="34" viewBox="0 0 30 34">
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

  const ctrlBase = { display: 'flex', alignItems: 'center', gap: 11, background: '#16273E', border: '1px solid rgba(201,162,75,.32)', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', color: '#ECE6D8', textAlign: 'left', width: '100%' };
  const ctrlHover = { background: '#1E3A5C', border: '1px solid #C9A24B' };
  const ctrlLabel = { fontSize: 11, letterSpacing: '.5px', color: 'rgba(236,230,216,.5)', width: 66, flex: 'none' };
  const ctrlValue = { fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: '#ECE6D8', flex: 1 };
  const cycleGlyph = <span style={{ fontSize: 15, color: '#C9A24B' }}>↻</span>;

  const PAD = isMobile ? 20 : 32;
  const sectionWrap = { maxWidth: 1200, margin: '0 auto', padding: `0 ${PAD}px` };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ ...sectionWrap, padding: `26px ${PAD}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {LOGO}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 25, letterSpacing: '.5px' }}>Blazon</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {!isMobile && <>
            <a href="#modes" style={{ color: 'rgba(236,230,216,.66)', textDecoration: 'none', fontSize: 14.5 }}>Modes</a>
            <a href="#gallery" style={{ color: 'rgba(236,230,216,.66)', textDecoration: 'none', fontSize: 14.5 }}>Gallery</a>
            <a href="#pricing" style={{ color: 'rgba(236,230,216,.66)', textDecoration: 'none', fontSize: 14.5 }}>Pricing</a>
          </>}
          <button onClick={onOpenStudio} style={{ background: '#C9A24B', color: '#0C0F17', border: 'none', padding: '11px 20px', borderRadius: 7, fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>Open the Studio</button>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ ...sectionWrap, padding: isMobile ? `30px ${PAD}px 56px` : '54px 32px 88px', display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.05fr .95fr', gap: isMobile ? 40 : 72, alignItems: 'center' }}>
        <div style={isTablet ? { order: 2 } : undefined}>
          <div style={{ fontSize: 12.5, letterSpacing: '3.5px', color: '#C9A24B', fontWeight: 600, marginBottom: 22 }}>DESIGN A COAT OF ARMS</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isMobile ? 40 : 62, lineHeight: 1.04, margin: '0 0 24px', textWrap: 'balance' }}>Every family has a story worth a coat&nbsp;of&nbsp;arms.</h1>
          <p style={{ fontSize: isMobile ? 16 : 18, lineHeight: 1.6, color: 'rgba(236,230,216,.72)', maxWidth: '30em', margin: '0 0 34px' }}>Describe someone you love. We translate it into authentic heraldry — the same grammar heralds have used for eight hundred years — and render it in bold, flat colour.</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onOpenStudio} style={{ background: '#C9A24B', color: '#0C0F17', border: 'none', padding: '15px 26px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Start with a description</button>
            <a href="#modes" style={{ color: '#ECE6D8', textDecoration: 'none', fontSize: 15.5, padding: '15px 6px', borderBottom: '1px solid rgba(201,162,75,.4)' }}>See how it works</a>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, ...(isTablet ? { order: 1 } : null) }}>
          {/* The interactive coat of arms — the product thesis */}
          <div style={{ width: '100%', maxWidth: 392, background: 'radial-gradient(circle at 50% 44%, rgba(201,162,75,.12), transparent 68%)', padding: '8px 8px 4px' }}>
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

          <div style={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column', gap: 11, marginTop: -6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, letterSpacing: '1.5px', color: 'rgba(236,230,216,.5)' }}>TAP A PART TO CHANGE IT</span>
              <HoverBtn
                onClick={surprise}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(201,162,75,.12)', border: '1px solid rgba(201,162,75,.4)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', color: '#C9A24B', fontSize: 13, fontWeight: 600 }}
                hoverStyle={{ background: 'rgba(201,162,75,.24)', border: '1px solid #C9A24B', color: '#ECE6D8' }}
              >⚄ Surprise me</HoverBtn>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <HoverBtn onClick={cycleField} onMouseEnter={() => setHoverPart('field')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', background: TINCTURES[hero.field].hex, border: '1px solid rgba(236,230,216,.25)' }} />
                <span style={ctrlLabel}>FIELD</span>
                <span style={ctrlValue}>{hero.field}</span>
                {cycleGlyph}
              </HoverBtn>
              <HoverBtn onClick={cycleOrdinary} onMouseEnter={() => setHoverPart('ord')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
                <span style={{ width: 18, height: 18, flex: 'none', borderRadius: 4, border: '1.5px solid #C9A24B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#C9A24B' }}>✕</span>
                <span style={ctrlLabel}>STRUCTURE</span>
                <span style={ctrlValue}>{cap(hero.ordinary)}</span>
                {cycleGlyph}
              </HoverBtn>
              <HoverBtn onClick={cycleSymbol} onMouseEnter={() => setHoverPart('chg')} onMouseLeave={() => setHoverPart(null)} style={ctrlBase} hoverStyle={ctrlHover}>
                <span style={hero.charges.length
                  ? { width: 18, height: 18, borderRadius: '50%', flex: 'none', background: TINCTURES[hero.charges[0].tincture].hex, border: '1px solid rgba(236,230,216,.25)' }
                  : { width: 18, height: 18, borderRadius: '50%', flex: 'none', background: 'transparent', border: '1px dashed rgba(236,230,216,.35)' }} />
                <span style={ctrlLabel}>SYMBOL</span>
                <span style={ctrlValue}>{symbolName}</span>
                {cycleGlyph}
              </HoverBtn>
            </div>
          </div>

          {/* Mini blazon bar — the language↔image thesis, in miniature */}
          <div style={{ width: '100%', maxWidth: 392, background: '#0E1726', border: '1px solid rgba(201,162,75,.22)', borderRadius: 11, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <LangToggle value={lang} onFormal={() => setLang('formal')} onPlain={() => setLang('plain')} />
            {lang === 'formal'
              ? <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 19, color: '#ECE6D8', lineHeight: 1.25 }}>{blazon(hero, 'formal')}</span>
              : <span style={{ fontSize: 14, color: 'rgba(236,230,216,.78)', lineHeight: 1.35 }}>{blazon(hero, 'plain')}</span>}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" style={{ ...sectionWrap, padding: `34px ${PAD}px 30px` }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isMobile ? 30 : 40, margin: '0 0 8px', textAlign: 'center' }}>Three ways in. One coat of arms.</h2>
        <p style={{ textAlign: 'center', color: 'rgba(236,230,216,.62)', fontSize: 16, margin: '0 0 42px' }}>The data is always the blazon. The interface is just a view over it — slide between modes any time, nothing is lost.</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 22 }}>
          <div style={{ background: '#101D30', border: '1.5px solid #C9A24B', borderRadius: 13, padding: 28, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -11, left: 24, background: '#C9A24B', color: '#0C0F17', fontSize: 11, fontWeight: 700, letterSpacing: '1px', padding: '4px 10px', borderRadius: 20 }}>YOU START HERE</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, margin: '6px 0 10px' }}>The Gifter</div>
            <p style={{ color: 'rgba(236,230,216,.74)', fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>Tell us what someone loves. We handle the heraldry and hand back something beautiful to print, frame and give.</p>
          </div>
          <div style={{ background: '#0F1826', border: '1px solid rgba(201,162,75,.2)', borderRadius: 13, padding: 28, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, margin: '6px 0 10px', color: 'rgba(236,230,216,.92)' }}>The Enthusiast</div>
            <p style={{ color: 'rgba(236,230,216,.62)', fontSize: 14.5, lineHeight: 1.55, margin: '0 0 20px' }}>Build it yourself with a real charge library. Learn the grammar of a thousand years — the rules explained as you go.</p>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 11, letterSpacing: '1px', color: 'rgba(236,230,216,.4)' }}>PALETTE</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#D4AF52', '#9F2C2C', '#1F4E7A', '#2E5A3E', '#E7E1D3'].map((c) => (
                  <span key={c} style={{ width: 15, height: 15, borderRadius: '50%', background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: '#0F1826', border: '1px solid rgba(201,162,75,.2)', borderRadius: 13, padding: 28, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, margin: '6px 0 10px', color: 'rgba(236,230,216,.92)' }}>The Serious Amateur</div>
            <p style={{ color: 'rgba(236,230,216,.62)', fontSize: 14.5, lineHeight: 1.55, margin: '0 0 20px' }}>A proper blazon editor with full grammar, live validation and rigorous output. Everything DrawShield should have been.</p>
            <div style={{ marginTop: 'auto', background: '#0A0D14', border: '1px solid rgba(201,162,75,.18)', borderRadius: 8, padding: '11px 13px', fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ color: '#D4AF52' }}>Or</span>
              <span style={{ color: 'rgba(236,230,216,.55)' }}>, a fess </span>
              <span style={{ color: '#C76B6B' }}>gules</span>
              <span style={{ color: 'rgba(236,230,216,.55)' }}> between</span>
              <br />
              <span style={{ color: 'rgba(236,230,216,.55)' }}>three roundels </span>
              <span style={{ color: 'rgba(236,230,216,.85)' }}>sable</span>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" style={{ ...sectionWrap, padding: `58px ${PAD}px 30px` }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isMobile ? 30 : 40, margin: '0 0 36px', textAlign: 'center' }}>Made with Blazon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 24 }}>
          {GALLERY.map((g) => (
            <div key={g.title} style={{ background: '#0F1826', border: '1px solid rgba(201,162,75,.18)', borderRadius: 13, padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: 130 }}><Shield design={g.design} /></div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 600, margin: '18px 0 6px' }}>{g.title}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15, color: '#C9A24B', lineHeight: 1.4 }}>{blazon(g.design, 'formal')}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ ...sectionWrap, padding: `58px ${PAD}px 30px` }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isMobile ? 30 : 40, margin: '0 0 36px', textAlign: 'center' }}>Pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18 }}>
          {[
            { tier: 'Free', price: '£0', body: 'One coat of arms, watermarked PNG, view the blazon.' },
            { tier: 'Personal', price: <>£9<span style={{ fontSize: 15, color: 'rgba(236,230,216,.5)' }}> /mo</span></>, body: 'Unlimited designs, hi-res PNG & SVG, PDF certificate, library.' },
            { tier: 'Gift', price: '£19–49', body: 'Digital download £19 · physical A3 certificate, framed and posted, £49.', highlight: true },
            { tier: 'Creator API', price: <>£29<span style={{ fontSize: 15, color: 'rgba(236,230,216,.5)' }}> /mo</span></>, body: 'REST API, SVG output, embed in your own tools.' },
          ].map((p) => (
            <div key={p.tier} style={{ background: p.highlight ? '#101D30' : '#0F1826', border: p.highlight ? '1.5px solid #C9A24B' : '1px solid rgba(201,162,75,.18)', borderRadius: 13, padding: 26, position: 'relative' }}>
              {p.highlight && <div style={{ position: 'absolute', top: -11, left: 22, background: '#C9A24B', color: '#0C0F17', fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', padding: '4px 10px', borderRadius: 20 }}>THE GIFT</div>}
              <div style={{ fontSize: 14, color: p.highlight ? '#C9A24B' : 'rgba(236,230,216,.6)', fontWeight: 600 }}>{p.tier}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 600, margin: '8px 0 14px' }}>{p.price}</div>
              <p style={{ fontSize: 13.5, color: p.highlight ? 'rgba(236,230,216,.7)' : 'rgba(236,230,216,.62)', lineHeight: 1.55, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gift CTA */}
      <section style={{ ...sectionWrap, padding: `48px ${PAD}px 80px` }}>
        <div style={{ background: 'linear-gradient(115deg,#16273E,#101D30)', border: '1px solid rgba(201,162,75,.3)', borderRadius: 16, padding: isMobile ? 28 : 52, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 40 }}>
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: isMobile ? 28 : 38, margin: '0 0 10px' }}>Give someone a coat of arms.</h2>
            <p style={{ fontSize: 16, color: 'rgba(236,230,216,.7)', margin: 0, maxWidth: '34em', lineHeight: 1.55 }}>A print-ready A3 certificate, the blazon typeset by hand, posted to your door. The most personal gift you can design in ten minutes.</p>
          </div>
          <button onClick={onOpenStudio} style={{ background: '#C9A24B', color: '#0C0F17', border: 'none', padding: '16px 30px', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto' }}>Design a gift</button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(201,162,75,.16)', padding: `28px ${PAD}px`, textAlign: 'center', color: 'rgba(236,230,216,.4)', fontSize: 13 }}>
        Blazon — the heraldic manuscript, made digital. · <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Per fess Or and Azure</span>
      </footer>
    </div>
  );
}
