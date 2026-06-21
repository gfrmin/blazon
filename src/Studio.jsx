import React, { useState, useEffect, useRef } from 'react';
import Shield, { canRenderLocally } from './Shield.jsx';
import Turnstile from './components/Turnstile.jsx';
import CreditsLink from './Credits.jsx';
import { catalogKeys, humanize } from './charges/manifest.js';
import { Swatch, Pill, LangToggle, Disclosure, SubLabel, HoverBtn } from './ui.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import { C, F, goldBtn, goldBtnHover } from './theme.js';
import {
  TINCTURES, TINCTURE_ORDER, FURS, STAINS,
  DIVISION_ORDER, LINE_ORDER, ORDINARY_ORDER, SUBORDINARIES,
  CHARGES, CHARGE_ORDER, ATTITUDES, validAttitudesFor,
  blazon, computeWarn, cap, PRESETS, pickPreset, drawShieldURL,
  // Coat selectors + mutators (the single home for AST edits)
  fieldTincture, isDivided, division, primaryGroup, chargeGroup,
  setFieldTincture, setDivision, clearDivision, setDivisionPart, setDivisionLine,
  setOrdinary, clearOrdinary, setOrdinaryTincture, setOrdinaryLine,
  setCharge, clearCharge, setChargeTincture, setChargeAttitude, setChargeNumber, setArrangement,
  setMotto,
} from './heraldry.js';

const LOGO = (
  <svg width="24" height="27" viewBox="0 0 30 34">
    <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
    <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
  </svg>
);

const SHIELD_OUTLINE = 'M18,14 H182 V108 C182,170 144,204 100,226 C56,204 18,170 18,108 Z';

// Option groups derived from the model tables (single source of truth — no
// hard-coded heraldic vocabulary lives in this component).
const FUR_STAIN = [...FURS, ...STAINS];
const MORE_STRUCTURES = ['pile', ...Object.keys(SUBORDINARIES)];
const CHARGE_CATEGORIES = ['beast', 'bird', 'fish', 'object', 'flora'];
const CHARGES_BY_CATEGORY = CHARGE_CATEGORIES
  .map((cat) => [cat, Object.keys(CHARGES).filter((k) => CHARGES[k].category === cat)])
  .filter(([, keys]) => keys.length);
const ARRANGEMENTS = ['in pale', 'in fess', 'in chief'];

export default function Studio({ onBack }) {
  const isMobile = useMediaQuery('(max-width: 820px)');
  const [step, setStep] = useState('describe'); // 'describe' | 'design'
  const [desc, setDesc] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [design, setDesign] = useState(null); // a Coat AST
  const [lang, setLang] = useState('plain'); // default = plain English
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [token, setToken] = useState(null); // Turnstile token (one-shot)
  const [genNotice, setGenNotice] = useState(null); // 'rate' | 'challenge'
  const [chargeQuery, setChargeQuery] = useState(''); // search the full charge catalog
  const turnstileRef = useRef(null);
  const [dsUrl, setDsUrl] = useState(null); // debounced DrawShield fallback URL
  const [dsFailed, setDsFailed] = useState(false); // DrawShield img errored → degrade to local

  // ── Generation. Calls the Claude-backed Pages Function (spec §6.1), which
  //    returns a validated Coat. Falls back to a canned preset when the API
  //    isn't reachable / configured (offline, local dev, no key) so the
  //    experience never dead-ends. ──
  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenNotice(null);
    const started = Date.now();
    let next = null;
    let blocked = null; // 'rate' | 'challenge' — an explicit gate, not a fallback case
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: desc, turnstileToken: token }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data && data.design && data.design.field) next = data.design;
      } else if (r.status === 429) {
        blocked = 'rate';
      } else if (r.status === 403) {
        const e = await r.json().catch(() => ({}));
        // failed_challenge = bad/missing token → ask to retry the check;
        // challenge_unavailable (not configured) falls through to the preset demo.
        if (e.error === 'failed_challenge') blocked = 'challenge';
      }
      // 503 / other → fall through to the canned-preset fallback
    } catch { /* network/offline → preset fallback */ }

    // Turnstile tokens are single-use — refresh for the next attempt.
    turnstileRef.current?.reset();
    setToken(null);

    if (blocked) {
      setGenerating(false);
      setGenNotice(blocked);
      return; // stay on the describe step; don't silently preset on an explicit block
    }
    if (!next) {
      const p = pickPreset(desc, selectedPreset);
      next = JSON.parse(JSON.stringify(p.design));
    }
    const elapsed = Date.now() - started; // hold the spinner briefly so it never flashes
    if (elapsed < 900) await new Promise((res) => setTimeout(res, 900 - elapsed));
    setDesign(next);
    setGenerating(false);
    setLang('plain');
    setStep('design');
  };
  const restart = () => { setStep('describe'); setDesign(null); setDesc(''); setSelectedPreset(null); };

  // Every edit funnels through a coat.js mutator — one code path, immutable.
  const apply = (fn, ...args) => setDesign((d) => fn(d, ...args));

  // Export is code-split (it pulls in react-dom/server) — load it on click only.
  const doExport = (kind) => {
    setExportOpen(false);
    import('./export.js').then((m) => (kind === 'svg' ? m.downloadSVG(design) : m.downloadPNG(design)));
  };

  const copyBlazon = () => {
    navigator.clipboard?.writeText(blazon(design, 'formal')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const formal = design ? blazon(design, 'formal') : '';
  const local = design ? canRenderLocally(design) : true;

  // Debounced DrawShield fallback: only for the settled, non-local design — the
  // public API is rate-limited, so never fetch on every swap.
  useEffect(() => {
    if (!design || local) { setDsUrl(null); setDsFailed(false); return undefined; }
    setDsUrl(null);
    setDsFailed(false);
    // PNG, not SVG: DrawShield serves SVG as text/xml, which <img> won't render.
    const t = setTimeout(() => setDsUrl(drawShieldURL(design, { format: 'png', size: 600 })), 600);
    return () => clearTimeout(t);
  }, [formal, local, design]);

  const warn = computeWarn(design);
  const struct = design ? primaryGroup(design) : null;
  const chg = design ? chargeGroup(design) : null;
  const div = design ? division(design) : null;
  const divided = design ? isDivided(design) : false;

  const cardStyle = { background: C.ink, border: `1px solid ${C.lineMid}`, borderRadius: 12, padding: 18, marginBottom: 14 };
  const cardTag = { fontSize: 11.5, letterSpacing: '1.6px', color: 'rgba(201,162,75,.85)', fontWeight: 600 };
  const rationale = { fontSize: 13, color: C.muted, lineHeight: 1.5, margin: '0 0 13px' };
  const value = { fontFamily: F.serif, fontStyle: 'italic', fontSize: 16, color: C.cream };
  const pillRow = { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 };

  const Swatches = ({ names, active, onPick }) => (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
      {names.map((name) => (
        <Swatch key={name} hex={TINCTURES[name].hex} active={name === active} title={`${name} (${TINCTURES[name].plain})`} onClick={() => onPick(name)} />
      ))}
    </div>
  );

  return (
    <div style={{ height: isMobile ? 'auto' : '100vh', minHeight: isMobile ? '100vh' : undefined, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 16px' : '14px 24px', background: '#101A2A', borderBottom: '1px solid rgba(201,162,75,.25)', flex: 'none', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }} onClick={onBack}>
          {LOGO}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 21 }}>Blazon</span>
        </div>
        {/* No mode selector by design: the personas (Gifter / Enthusiast / Serious) are an
            internal UX-design instrument, not in-product furniture. Depth is reached through
            progressive disclosure (the Blazon Bar's plain↔formal toggle, "swap this element",
            the per-card "more…" reveals) — never a self-classification switch on arrival. */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ background: 'transparent', color: C.cream, border: `1px solid ${C.lineHi}`, padding: '9px 16px', borderRadius: 7, fontSize: 13.5, cursor: 'pointer', fontFamily: F.sans }}>Save</button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => design && setExportOpen((o) => !o)}
              style={{ ...goldBtn, padding: '9px 18px', fontSize: 13.5, cursor: design ? 'pointer' : 'default', opacity: design ? 1 : .5 }}
            >Export ▾</button>
            {exportOpen && design && (
              <>
                <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#101A2A', border: '1px solid rgba(201,162,75,.3)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 20, minWidth: 188, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                  <button onClick={() => doExport('svg')} style={{ background: 'transparent', border: 'none', color: '#ECE6D8', textAlign: 'left', padding: '9px 12px', borderRadius: 6, fontSize: 13.5, cursor: 'pointer' }}>Download SVG</button>
                  <button onClick={() => doExport('png')} style={{ background: 'transparent', border: 'none', color: '#ECE6D8', textAlign: 'left', padding: '9px 12px', borderRadius: 6, fontSize: 13.5, cursor: 'pointer' }}>Download PNG · print</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        {/* Left — live preview */}
        <div style={{ flex: isMobile ? 'none' : 1, height: isMobile ? 320 : undefined, background: 'radial-gradient(circle at 50% 42%, #1A2C44, #0B0E16)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
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
              <div style={{ width: isMobile ? 188 : 300 }}>
                {local || dsFailed ? (
                  <Shield design={design} />
                ) : dsUrl ? (
                  <img src={dsUrl} alt={formal} onError={() => setDsFailed(true)} style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 16px 34px rgba(0,0,0,.5))' }} />
                ) : (
                  <div style={{ height: isMobile ? 226 : 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid rgba(201,162,75,.25)', borderTopColor: '#C9A24B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
              {!local && dsUrl && !dsFailed && (
                <div style={{ fontSize: 11, color: 'rgba(236,230,216,.4)', marginTop: 10, letterSpacing: '.3px' }}>rendered via DrawShield</div>
              )}
              {design.motto && design.motto.trim() && (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, color: '#C9A24B', marginTop: 26, letterSpacing: '.5px' }}>“{design.motto}”</div>
              )}
            </div>
          )}
        </div>

        {/* Right — control panel */}
        <aside style={{ width: isMobile ? '100%' : 466, flex: 'none', background: '#0F1826', borderLeft: isMobile ? 'none' : '1px solid rgba(201,162,75,.2)', borderTop: isMobile ? '1px solid rgba(201,162,75,.2)' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? '24px 18px 32px' : '30px 30px 40px' }}>
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
              <Turnstile ref={turnstileRef} onToken={setToken} />
              <button onClick={generate} style={{ ...goldBtn, width: '100%', marginTop: 14, padding: 15, borderRadius: 9, fontSize: 15.5, opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}>{generating ? 'Designing…' : 'Design the coat of arms'}</button>
              {genNotice && (
                <p style={{ fontSize: 12.5, color: '#E0B36A', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
                  {genNotice === 'rate'
                    ? "You're generating quickly — give it a moment, then try again."
                    : 'Please complete the verification above, then try again.'}
                </p>
              )}
              <p style={{ fontSize: 12, color: 'rgba(236,230,216,.45)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>No heraldry knowledge required. You can refine every choice afterwards.</p>
            </div>
          )}

          {step === 'design' && design && (
            <div style={{ animation: 'fadein .4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 28, margin: 0 }}>Here's what we made.</h2>
                <button onClick={restart} style={{ background: 'transparent', border: 'none', color: '#C9A24B', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Start over</button>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: '0 0 20px' }}>Tap any card to swap a colour or shape. Open “more…” when you want to go deeper — nothing here needs a single heraldic term to start.</p>

              {warn && (
                <div style={{ background: 'rgba(178,58,58,.16)', border: '1px solid #B23A3A', borderRadius: 10, padding: '13px 15px', marginBottom: 18, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ color: '#E08A8A', fontSize: 16, lineHeight: 1.2 }}>⚠</span>
                  <span style={{ fontSize: 13, color: '#F0CFCF', lineHeight: 1.5 }}>{warn}</span>
                </div>
              )}

              {/* ── Field ── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={cardTag}>THE FIELD</span>
                  <span style={value}>{divided ? cap(div.type) : fieldTincture(design)}</span>
                </div>
                <p style={rationale}>{design.rationale?.field}</p>

                {!divided ? (
                  <>
                    <Swatches names={TINCTURE_ORDER} active={fieldTincture(design)} onPick={(t) => apply(setFieldTincture, t)} />
                    <div style={{ marginTop: 13 }}>
                      <Disclosure label="More colours — furs">
                        <Swatches names={FUR_STAIN} active={fieldTincture(design)} onPick={(t) => apply(setFieldTincture, t)} />
                      </Disclosure>
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <Disclosure label="Divide the field">
                        <div style={pillRow}>
                          {DIVISION_ORDER.map((k) => (
                            <Pill key={k} active={false} onClick={() => apply(setDivision, k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={pillRow}>
                      {DIVISION_ORDER.map((k) => (
                        <Pill key={k} active={k === div.type} onClick={() => apply(setDivision, k)}>{cap(k)}</Pill>
                      ))}
                      <Pill active={false} onClick={() => apply(clearDivision)}>Plain field</Pill>
                    </div>
                    <SubLabel>First colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={div.tinctures[0]} onPick={(t) => apply(setDivisionPart, 0, t)} />
                    <SubLabel style={{ marginTop: 12 }}>Second colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={div.tinctures[1]} onPick={(t) => apply(setDivisionPart, 1, t)} />
                    <div style={{ marginTop: 13 }}>
                      <Disclosure label="Edge style">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {LINE_ORDER.map((k) => (
                            <Pill key={k} active={(div.line || 'straight') === k} onClick={() => apply(setDivisionLine, k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                  </>
                )}
              </div>

              {/* ── Structure ── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={cardTag}>THE STRUCTURE</span>
                  <span style={value}>{struct ? cap(struct.object.key) : 'None'}</span>
                </div>
                <p style={rationale}>{design.rationale?.ordinary}</p>
                <div style={pillRow}>
                  {ORDINARY_ORDER.map((k) => (
                    <Pill key={k} active={!!struct && struct.object.key === k} onClick={() => apply(setOrdinary, k)}>{cap(k)}</Pill>
                  ))}
                </div>
                <Disclosure label="More structures">
                  <div style={pillRow}>
                    {MORE_STRUCTURES.map((k) => (
                      <Pill key={k} active={!!struct && struct.object.key === k} onClick={() => apply(setOrdinary, k)}>{cap(k)}</Pill>
                    ))}
                    <Pill active={!struct} onClick={() => apply(clearOrdinary)}>None</Pill>
                  </div>
                </Disclosure>
                {struct && (
                  <>
                    <div style={{ margin: '12px 0' }}>
                      <Disclosure label="Edge style">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {LINE_ORDER.map((k) => (
                            <Pill key={k} active={(struct.object.line || 'straight') === k} onClick={() => apply(setOrdinaryLine, k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                    <SubLabel>Its colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={struct.tincture} onPick={(t) => apply(setOrdinaryTincture, t)} />
                  </>
                )}
              </div>

              {/* ── Symbol ── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={cardTag}>THE SYMBOL</span>
                  <span style={value}>{chg ? (CHARGES[chg.object.key]?.label || humanize(chg.object.key)) : 'None'}</span>
                </div>
                <p style={rationale}>{design.rationale?.charges}</p>
                <div style={pillRow}>
                  {CHARGE_ORDER.map((k) => (
                    <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => apply(setCharge, k)}>{CHARGES[k].label}</Pill>
                  ))}
                </div>
                <Disclosure label={`More symbols — search ${catalogKeys.length.toLocaleString()}`}>
                  <input
                    value={chargeQuery}
                    onChange={(e) => setChargeQuery(e.target.value)}
                    placeholder="Search charges — lion, ship, oak, sun, harp…"
                    style={{ width: '100%', background: '#0B111C', border: '1px solid rgba(201,162,75,.28)', borderRadius: 8, padding: '9px 12px', color: '#ECE6D8', fontSize: 13.5, fontFamily: 'inherit', marginBottom: 10 }}
                  />
                  {chargeQuery.trim() ? (() => {
                    const q = chargeQuery.trim().toLowerCase();
                    const hits = catalogKeys.filter((k) => k.includes(q)).slice(0, 60);
                    return hits.length ? (
                      <div style={{ ...pillRow, marginBottom: 0, maxHeight: 240, overflowY: 'auto' }}>
                        {hits.map((k) => (
                          <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => apply(setCharge, k)}>{humanize(k)}</Pill>
                        ))}
                      </div>
                    ) : <SubLabel>No charges match “{chargeQuery}”.</SubLabel>;
                  })() : (
                    CHARGES_BY_CATEGORY.map(([catName, keys]) => (
                      <div key={catName} style={{ marginBottom: 10 }}>
                        <SubLabel style={{ marginBottom: 6, textTransform: 'capitalize' }}>{catName}</SubLabel>
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {keys.map((k) => (
                            <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => apply(setCharge, k)}>{CHARGES[k].label}</Pill>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ marginTop: 12 }}><Pill active={!chg} onClick={() => apply(clearCharge)}>None</Pill></div>
                </Disclosure>

                {chg && (
                  <>
                    {validAttitudesFor(chg.object.key).length > 0 && (
                      <div style={{ marginTop: 13 }}>
                        <SubLabel>Posture</SubLabel>
                        <div style={pillRow}>
                          {validAttitudesFor(chg.object.key).map((a) => (
                            <Pill key={a} active={chg.object.attitude === a} onClick={() => apply(setChargeAttitude, a)} title={ATTITUDES[a]?.plain}>{a}</Pill>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '6px 0 13px' }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)' }}>How many</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#16273E', borderRadius: 8, padding: '5px 6px' }}>
                        <button onClick={() => apply(setChargeNumber, (chg.number || 1) - 1)} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>−</button>
                        <span style={{ fontSize: 15, minWidth: 14, textAlign: 'center', fontWeight: 600 }}>{chg.number}</span>
                        <button onClick={() => apply(setChargeNumber, (chg.number || 1) + 1)} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>+</button>
                      </div>
                    </div>
                    {(chg.number || 1) > 1 && (
                      <Disclosure label="Arrangement">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {ARRANGEMENTS.map((a) => (
                            <Pill key={a} active={chg.arrangement === a} onClick={() => apply(setArrangement, chg.arrangement === a ? null : a)}>{a}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    )}
                    <SubLabel style={{ marginTop: 13 }}>Its colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={chg.tincture} onPick={(t) => apply(setChargeTincture, t)} />
                  </>
                )}
              </div>

              {/* ── Motto ── */}
              <div style={{ background: '#0B111C', border: '1px solid rgba(201,162,75,.2)', borderRadius: 12, padding: 18 }}>
                <div style={{ ...cardTag, marginBottom: 11 }}>THE MOTTO</div>
                <input
                  value={design.motto || ''}
                  onChange={(e) => apply(setMotto, e.target.value)}
                  placeholder="A few words they lived by…"
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(201,162,75,.3)', padding: '6px 2px', color: '#ECE6D8', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 19 }}
                />
              </div>

              {/* Conversion at the result peak — free to design; the watermark lifts on purchase */}
              <div style={{ marginTop: 22, borderTop: `1px solid ${C.lineMid}`, paddingTop: 18 }}>
                <p style={{ fontSize: 12, color: C.muted2, margin: '0 0 12px', letterSpacing: '.2px' }}>Free to design — the watermark lifts when you download or order a print.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <HoverBtn style={{ ...goldBtn, flex: 1, padding: 14, borderRadius: 9, fontSize: 14.5, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }} hoverStyle={goldBtnHover}>Download<span style={{ fontWeight: 400, fontSize: 11, opacity: .75, marginTop: 2 }}>clean file · $19</span></HoverBtn>
                  <button style={{ flex: 1, padding: 14, borderRadius: 9, fontWeight: 600, fontSize: 14.5, cursor: 'pointer', background: 'transparent', color: C.cream, border: `1px solid ${C.lineHi}`, fontFamily: F.sans, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>Order a print<span style={{ fontWeight: 400, fontSize: 11, opacity: .7, marginTop: 2 }}>framed · from $49</span></button>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 14 }}><CreditsLink style={{ fontSize: 12 }} /></div>
            </div>
          )}
        </aside>
      </div>

      {/* Blazon bar — always visible */}
      <div style={{ flex: 'none', background: '#0A0D14', borderTop: '1.5px solid #C9A24B', padding: isMobile ? '14px 16px' : '16px 28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <span title="The blazon is the formal description your arms are built from — the source of truth." style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(201,162,75,.5)', color: '#C9A24B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontStyle: 'italic', cursor: 'help', fontFamily: "'Cormorant Garamond', serif", flex: 'none' }}>i</span>
          <LangToggle value={lang} onFormal={() => setLang('formal')} onPlain={() => setLang('plain')} plainLabel="Plain English" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {design
            ? (lang === 'formal'
              ? <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600, fontSize: isMobile ? 18 : 24, color: '#ECE6D8' }}>{blazon(design, 'formal')}</span>
              : <span style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(236,230,216,.82)' }}>{blazon(design, 'plain')}</span>)
            : <span style={{ fontSize: 15, color: 'rgba(236,230,216,.4)', fontStyle: 'italic' }}>Your blazon will be written here as you design.</span>}
        </div>
        <button onClick={copyBlazon} disabled={!design} style={{ flex: 'none', background: 'transparent', border: '1px solid rgba(201,162,75,.4)', color: copied ? '#C9A24B' : '#ECE6D8', padding: '9px 18px', borderRadius: 7, fontSize: 13.5, cursor: design ? 'pointer' : 'default', fontWeight: 500, opacity: design ? 1 : .5 }}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
    </div>
  );
}
