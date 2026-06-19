import React, { useState, useEffect, useRef } from 'react';
import Shield from './Shield.jsx';
import { Swatch, Pill, LangToggle } from './ui.jsx';
import {
  TINCTURES, TINCTURE_ORDER, ORDINARY_ORDER, CHARGE_ORDER, CHARGES,
  blazon, computeWarn, cap, PRESETS, pickPreset,
} from './heraldry.js';

const LOGO = (
  <svg width="24" height="27" viewBox="0 0 30 34">
    <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
    <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
  </svg>
);

const SHIELD_OUTLINE = 'M18,14 H182 V108 C182,170 144,204 100,226 C56,204 18,170 18,108 Z';

export default function Studio({ onBack }) {
  const [step, setStep] = useState('describe'); // 'describe' | 'design'
  const [desc, setDesc] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [design, setDesign] = useState(null);
  const [lang, setLang] = useState('plain'); // Gifter default = plain English
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // ── Generation. PROTOTYPE: simulated delay + canned preset. In production
  //    this is the Claude API call (spec §6.1) returning a validated design. ──
  const generate = () => {
    if (generating) return;
    setGenerating(true);
    timer.current = setTimeout(() => {
      const p = pickPreset(desc, selectedPreset);
      setDesign(JSON.parse(JSON.stringify(p.design)));
      setGenerating(false);
      setLang('plain');
      setStep('design');
    }, 1700);
  };
  const restart = () => { setStep('describe'); setDesign(null); setDesc(''); setSelectedPreset(null); };

  // ── Element swaps (pure client-side, immutable; <200ms, no spinner) ──
  const patch = (fn) => setDesign((d) => fn({ ...d }));
  const setField = (n) => patch((d) => ({ ...d, field: n }));
  const setOrdinaryTincture = (n) => patch((d) => ({ ...d, ordinaryTincture: n }));
  const setOrdinaryType = (k) => patch((d) => ({ ...d, ordinary: k }));
  const setChargeTincture = (n) => patch((d) => ({ ...d, charges: [{ ...d.charges[0], tincture: n }] }));
  const setChargeType = (k) => patch((d) => ({ ...d, charges: [{ ...d.charges[0], type: k }] }));
  const incQty = () => patch((d) => ({ ...d, charges: [{ ...d.charges[0], qty: Math.min(3, (d.charges[0].qty || 1) + 1) }] }));
  const decQty = () => patch((d) => ({ ...d, charges: [{ ...d.charges[0], qty: Math.max(1, (d.charges[0].qty || 1) - 1) }] }));
  const setMotto = (v) => patch((d) => ({ ...d, motto: v }));

  const copyBlazon = () => {
    navigator.clipboard?.writeText(blazon(design, 'formal')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const warn = computeWarn(design);
  const hasCharge = design && design.charges.length > 0;
  const ch = hasCharge ? design.charges[0] : null;

  const cardStyle = { background: '#0B111C', border: '1px solid rgba(201,162,75,.2)', borderRadius: 12, padding: 18, marginBottom: 14 };
  const cardTag = { fontSize: 12, letterSpacing: '1.5px', color: 'rgba(201,162,75,.8)', fontWeight: 600 };
  const rationale = { fontSize: 13, color: 'rgba(236,230,216,.62)', lineHeight: 1.5, margin: '0 0 13px' };

  const SwatchRow = ({ active, onPick }) => (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
      {TINCTURE_ORDER.map((name) => (
        <Swatch key={name} hex={TINCTURES[name].hex} active={name === active} title={`${name} (${TINCTURES[name].plain})`} onClick={() => onPick(name)} />
      ))}
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#101A2A', borderBottom: '1px solid rgba(201,162,75,.25)', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }} onClick={onBack}>
          {LOGO}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 21 }}>Blazon</span>
        </div>
        <div style={{ display: 'flex', background: '#0C0F17', border: '1px solid rgba(201,162,75,.22)', borderRadius: 9, padding: 4, gap: 2 }}>
          <div style={{ background: '#C9A24B', color: '#0C0F17', padding: '8px 18px', borderRadius: 6, fontSize: 13.5, fontWeight: 600 }}>Gifter</div>
          <div title="Built out in this round: Gifter mode" style={{ color: 'rgba(236,230,216,.45)', padding: '8px 18px', fontSize: 13.5, cursor: 'not-allowed' }}>Enthusiast</div>
          <div title="Built out in this round: Gifter mode" style={{ color: 'rgba(236,230,216,.45)', padding: '8px 18px', fontSize: 13.5, cursor: 'not-allowed' }}>Serious</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ background: 'transparent', color: '#ECE6D8', border: '1px solid rgba(201,162,75,.35)', padding: '9px 16px', borderRadius: 7, fontSize: 13.5, cursor: 'pointer' }}>Save</button>
          <button style={{ background: '#C9A24B', color: '#0C0F17', border: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Export</button>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left — live preview */}
        <div style={{ flex: 1, background: 'radial-gradient(circle at 50% 42%, #1A2C44, #0B0E16)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 11, letterSpacing: '2.5px', color: 'rgba(201,162,75,.7)', fontWeight: 600 }}>LIVE PREVIEW</div>

          {!generating && !design && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, opacity: .5 }}>
              <svg width="160" height="192" viewBox="0 0 200 240"><path d={SHIELD_OUTLINE} fill="none" stroke="rgba(201,162,75,.5)" strokeWidth="2" strokeDasharray="7 8" /></svg>
              <span style={{ fontSize: 14, color: 'rgba(236,230,216,.6)' }}>Your arms will appear here.</span>
            </div>
          )}

          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(201,162,75,.25)', borderTopColor: '#C9A24B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 19, color: 'rgba(236,230,216,.85)', maxWidth: '18em', textAlign: 'center', lineHeight: 1.4 }}>Reading your story, consulting eight centuries of heraldry…</span>
            </div>
          )}

          {!generating && design && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadein .5s ease' }}>
              <div style={{ width: 300 }}><Shield design={design} /></div>
              {design.motto && design.motto.trim() && (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, color: '#C9A24B', marginTop: 26, letterSpacing: '.5px' }}>“{design.motto}”</div>
              )}
            </div>
          )}
        </div>

        {/* Right — control panel */}
        <aside style={{ width: 466, flex: 'none', background: '#0F1826', borderLeft: '1px solid rgba(201,162,75,.2)', overflowY: 'auto', padding: '30px 30px 40px' }}>
          {step === 'describe' && (
            <div style={{ animation: 'fadein .4s ease' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 30, margin: '0 0 10px' }}>Tell us their story.</h2>
              <p style={{ fontSize: 14.5, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: '0 0 22px' }}>A name, a place, what they love, what they're like. The more human, the better the arms. We do the heraldry.</p>
              <textarea
                value={desc}
                onChange={(e) => { setDesc(e.target.value); setSelectedPreset(null); }}
                placeholder="My grandmother was from the Highlands of Scotland. She loved astronomy and the night sky, and she was the steady one who held the family together…"
                style={{ width: '100%', minHeight: 150, background: '#0B111C', border: '1px solid rgba(201,162,75,.28)', borderRadius: 10, padding: 16, color: '#ECE6D8', fontSize: 15, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 12, color: 'rgba(236,230,216,.5)', margin: '16px 0 9px', letterSpacing: '.5px' }}>OR TRY ONE OF THESE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => { setDesc(p.desc); setSelectedPreset(i); }} style={{ textAlign: 'left', background: '#0B111C', border: '1px solid rgba(201,162,75,.2)', borderRadius: 9, padding: '11px 14px', color: 'rgba(236,230,216,.82)', fontSize: 13.5, cursor: 'pointer' }}>{p.chip}</button>
                ))}
              </div>
              <button onClick={generate} style={{ width: '100%', marginTop: 18, background: generating ? 'rgba(201,162,75,.5)' : '#C9A24B', color: '#0C0F17', border: 'none', padding: 15, borderRadius: 9, fontWeight: 600, fontSize: 15.5, cursor: generating ? 'default' : 'pointer' }}>{generating ? 'Designing…' : 'Design the coat of arms'}</button>
              <p style={{ fontSize: 12, color: 'rgba(236,230,216,.45)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>No heraldry knowledge required. You can refine every choice afterwards.</p>
            </div>
          )}

          {step === 'design' && design && (
            <div style={{ animation: 'fadein .4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 28, margin: 0 }}>Here's what we made.</h2>
                <button onClick={restart} style={{ background: 'transparent', border: 'none', color: '#C9A24B', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Start over</button>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: '0 0 20px' }}>Tap any card to swap a colour or shape. Nothing here needs a single heraldic term.</p>

              {warn && (
                <div style={{ background: 'rgba(178,58,58,.16)', border: '1px solid #B23A3A', borderRadius: 10, padding: '13px 15px', marginBottom: 18, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ color: '#E08A8A', fontSize: 16, lineHeight: 1.2 }}>⚠</span>
                  <span style={{ fontSize: 13, color: '#F0CFCF', lineHeight: 1.5 }}>{warn}</span>
                </div>
              )}

              {/* Field */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={cardTag}>THE FIELD · COLOUR</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15, color: '#ECE6D8' }}>{design.field}</span>
                </div>
                <p style={rationale}>{design.rationale.field}</p>
                <SwatchRow active={design.field} onPick={setField} />
              </div>

              {/* Structure */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={cardTag}>THE STRUCTURE</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15, color: '#ECE6D8' }}>{cap(design.ordinary)}</span>
                </div>
                <p style={rationale}>{design.rationale.ordinary}</p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
                  {ORDINARY_ORDER.map((k) => (
                    <Pill key={k} active={k === design.ordinary} onClick={() => setOrdinaryType(k)}>{cap(k)}</Pill>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)', marginBottom: 8 }}>Its colour</div>
                <SwatchRow active={design.ordinaryTincture} onPick={setOrdinaryTincture} />
              </div>

              {/* Symbol */}
              {hasCharge && (
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={cardTag}>THE SYMBOL</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15, color: '#ECE6D8' }}>{CHARGES[ch.type].label}</span>
                  </div>
                  <p style={rationale}>{design.rationale.charges}</p>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
                    {CHARGE_ORDER.map((k) => (
                      <Pill key={k} active={k === ch.type} onClick={() => setChargeType(k)}>{CHARGES[k].label}</Pill>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 13 }}>
                    <span style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)' }}>How many</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#16273E', borderRadius: 8, padding: '5px 6px' }}>
                      <button onClick={decQty} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>−</button>
                      <span style={{ fontSize: 15, minWidth: 14, textAlign: 'center', fontWeight: 600 }}>{ch.qty}</span>
                      <button onClick={incQty} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>+</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)', marginBottom: 8 }}>Its colour</div>
                  <SwatchRow active={ch.tincture} onPick={setChargeTincture} />
                </div>
              )}

              {/* Motto */}
              <div style={{ background: '#0B111C', border: '1px solid rgba(201,162,75,.2)', borderRadius: 12, padding: 18 }}>
                <div style={{ ...cardTag, marginBottom: 11 }}>THE MOTTO</div>
                <input
                  value={design.motto || ''}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="A few words they lived by…"
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(201,162,75,.3)', padding: '6px 2px', color: '#ECE6D8', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 19 }}
                />
              </div>

              <button style={{ width: '100%', marginTop: 20, background: '#C9A24B', color: '#0C0F17', border: 'none', padding: 15, borderRadius: 9, fontWeight: 600, fontSize: 15.5, cursor: 'pointer' }}>Continue to your gift →</button>
            </div>
          )}
        </aside>
      </div>

      {/* Blazon bar — always visible */}
      <div style={{ flex: 'none', background: '#0A0D14', borderTop: '1.5px solid #C9A24B', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <span title="The blazon is the formal description your arms are built from — the source of truth." style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(201,162,75,.5)', color: '#C9A24B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontStyle: 'italic', cursor: 'help', fontFamily: "'Cormorant Garamond', serif" }}>i</span>
          <LangToggle value={lang} onFormal={() => setLang('formal')} onPlain={() => setLang('plain')} plainLabel="Plain English" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {design
            ? (lang === 'formal'
              ? <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 24, color: '#ECE6D8' }}>{blazon(design, 'formal')}</span>
              : <span style={{ fontSize: 17, color: 'rgba(236,230,216,.82)' }}>{blazon(design, 'plain')}</span>)
            : <span style={{ fontSize: 15, color: 'rgba(236,230,216,.4)', fontStyle: 'italic' }}>Your blazon will be written here as you design.</span>}
        </div>
        <button onClick={copyBlazon} disabled={!design} style={{ flex: 'none', background: 'transparent', border: '1px solid rgba(201,162,75,.4)', color: copied ? '#C9A24B' : '#ECE6D8', padding: '9px 18px', borderRadius: 7, fontSize: 13.5, cursor: design ? 'pointer' : 'default', fontWeight: 500, opacity: design ? 1 : .5 }}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
    </div>
  );
}
