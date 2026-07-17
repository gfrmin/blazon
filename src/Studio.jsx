import React, { useState, useEffect, useRef } from 'react';
import Shield, { canRenderLocally } from './Shield.jsx';
import Achievement from './Achievement.jsx';
import Turnstile, { turnstileConfigured } from './components/Turnstile.jsx';
import DownloadDialog from './components/DownloadDialog.jsx';
import CreditsLink from './Credits.jsx';
import { catalogKeys, humanize } from './charges/manifest.js';
import { Swatch, Pill, LangToggle, Disclosure, SubLabel, MenuPopover, MenuItem, InfoTip, srOnly } from './ui.jsx';
import { GildedRule } from './components/Ornament.jsx';
import SharePopover from './components/SharePopover.jsx';
import { useMediaQuery } from './useMediaQuery.js';
import { C, F, goldBtn } from './theme.js';
import { navigate, parseHash, parseQuery } from './router.js';
import { encodeCoat, decodeCoat, designHash } from './share/codec.js';
import { saveDesign, listDesigns, findByHash, setUnlocked as setLibraryUnlocked } from './library.js';
import { recordUnlock, CHECKOUT_PENDING_KEY } from './unlock.js';
import { headerControls } from './header-layout.js';
import { track } from './analytics.js';
import { raceWithTimeout } from './timeoutRace.js';
import {
  TINCTURES, TINCTURE_ORDER, FURS, STAINS,
  DIVISION_ORDER, LINE_ORDER, ORDINARY_ORDER, SUBORDINARIES,
  CHARGES, CHARGE_ORDER, ATTITUDES, validAttitudesFor, defaultAttitudeFor,
  HELMETS,
  blazon, computeWarn, cap, PRESETS, pickPreset, drawShieldURL, withDefaultAchievement,
  // Coat selectors + mutators (the single home for AST edits)
  fieldTincture, isDivided, division, primaryGroup, chargeGroup,
  setFieldTincture, setDivision, clearDivision, setDivisionPart, setDivisionLine,
  setOrdinary, clearOrdinary, setOrdinaryTincture, setOrdinaryLine,
  setCharge, clearCharge, setChargeTincture, setChargeAttitude, setChargeNumber, setArrangement,
  setMotto,
  // Achievement selectors + mutators (Task 9/11) — the single home for
  // achievement-part edits, same immutable-edit vocabulary as the shield above.
  crest, helm, torse, mantling, supporters, compartment, hasAchievement,
  setCrest, setCrestTincture, setCrestAttitude, clearCrest,
  setHelm, setTorse, setMantling,
  setSupporters, setSupporterSide, clearSupporters,
  setCompartment, clearCompartment,
  restoreFullAchievement, stripAchievement,
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
// Beasts — the classic "crest"/"supporter" figure; reused as the quick-pick
// list for both. Ascending helm rank (achievement.js's HELMETS `tier`).
const BEASTS = (CHARGES_BY_CATEGORY.find(([catName]) => catName === 'beast') || [null, []])[1];
const HELM_ORDER = ['esquire', 'knight', 'baronet', 'peer', 'royal'];

// Static herald one-liners — shown when generation didn't supply a per-part
// rationale (task-14 brief §2, forward-note "Rationale copy").
const CREST_FALLBACK_RATIONALE = 'The figure that crowns the helm — the last flourish above the shield.';
const SUPPORTERS_FALLBACK_RATIONALE = 'The figures who hold the shield up — an honour once reserved for the few. Yours to bestow.';
const CHAPTER_INTRO = 'A shield rarely rides alone — crest, supporters and motto complete the achievement. Keep them, change them, or set them aside.';

// ── Shared card styling (hoisted so PartCard/GhostRow — MODULE-level
//    components, see below — can use them; also reused inline by the design
//    step for one-off blocks). ──
const cardStyle = { background: C.ink, border: `1px solid ${C.lineMid}`, borderRadius: 12, padding: 18, marginBottom: 14 };
const cardTagStyle = { fontSize: 11.5, letterSpacing: '1.6px', color: 'rgba(201,162,75,.85)', fontWeight: 600 };
const rationaleStyle = { fontSize: 13, color: C.muted, lineHeight: 1.5, margin: '0 0 13px' };
const valueStyle = { fontFamily: F.serif, fontStyle: 'italic', fontSize: 16, color: C.cream };
const pillRow = { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 };

// ── PartCard — the header+value+rationale+controls pattern shared by every
// card in both chapters (task-14 brief §2, "PartCard extraction"). MUST be a
// MODULE-level component (not defined inside Studio()) — Studio() re-renders
// on every edit, and a component redefined on every render gets a fresh
// function identity each time, which React treats as a different component
// type: any Disclosure nested in `children` would then remount (losing its
// open/closed state) on every keystroke. Kept faithful to the pre-extraction
// markup exactly: when `onSetAside` is omitted (THE SHIELD's three cards),
// the header renders the SAME two bare <span>s as before — no wrapping div,
// no behavioural or DOM change for FIELD/STRUCTURE/SYMBOL.
function PartCard({ tag, valueText, rationale, onSetAside, children }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={cardTagStyle}>{tag}</span>
        {onSetAside ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={valueStyle}>{valueText}</span>
            <button onClick={onSetAside} style={{ background: 'none', border: 'none', color: 'rgba(236,230,216,.45)', fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: F.sans, padding: 0 }}>Set aside</button>
          </div>
        ) : (
          <span style={valueStyle}>{valueText}</span>
        )}
      </div>
      <p style={rationaleStyle}>{rationale}</p>
      {children}
    </div>
  );
}

// The collapsed state of a "Set aside"-able card: a slim ghost row (task-14
// brief §2). Also module-level, for the same remount-safety reason as PartCard.
function GhostRow({ tag, onRestore }) {
  return (
    <div style={{ border: `1px dashed ${C.lineMid}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={cardTagStyle}>{tag}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 14, color: C.muted2 }}>None</span>
        <button onClick={onRestore} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: F.sans, padding: 0 }}>Restore</button>
      </div>
    </div>
  );
}

// A gilded rule + a small label — the chapter divider between THE SHIELD and
// AROUND THE SHIELD (task-14 brief §2).
function ChapterRule({ label }) {
  return (
    <div style={{ margin: '30px 0 16px' }}>
      <GildedRule maxWidth={200} />
      <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: '2.6px', color: 'rgba(201,162,75,.7)', fontWeight: 600, marginTop: 9 }}>{label}</div>
    </div>
  );
}

// Generous but bounded wait for Turnstile's execute() (review round 1,
// Finding 1). 25s is comfortably longer than any real interactive challenge
// takes a human to solve (Cloudflare's own widget times out an unsolved
// challenge well before this), so a legitimately-shown challenge is never
// aborted mid-solve — but short enough that a widget which never fires ANY
// of its four terminal callbacks (script failed to load / never initialized
// — a real network-fault shape, not the already-handled "unconfigured" case,
// which resolves null immediately) doesn't strand the user on "Designing…"
// forever. Sentinel is a Symbol, not null/undefined — execute() legitimately
// resolves null when Turnstile isn't configured, and that must stay
// distinguishable from "timed out waiting for it".
const TURNSTILE_TIMEOUT_MS = 25000;
const TURNSTILE_TIMED_OUT = Symbol('turnstile-timed-out');

const AUTOSAVE_KEY = 'blazon:current';
// Read once on mount, then cleared — set by App.jsx's openStudio() before
// navigate() (task-7 brief §2, `studio_opened`). Key must match App.jsx.
const STUDIO_SOURCE_KEY = 'blazon:studio_source';

export default function Studio({ onBack }) {
  // Every entry point that lands here directly (Landing's CTAs, the /a/
  // recipient view's "Make your own"/"Open in Studio", a bare /studio visit)
  // goes through the SAME mount effect below (hash → autosave → ?desc= →
  // blank describe) — there is no separate "arrived pre-loaded" prop path
  // anymore (Task 18 retired it; see the mount effect's own comment).
  const isMobile = useMediaQuery('(max-width: 820px)');
  const [step, setStep] = useState('describe'); // 'describe' | 'design'
  const [desc, setDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [design, setDesign] = useState(null); // a Coat AST
  const [lang, setLang] = useState('plain'); // default = plain English
  const [copied, setCopied] = useState(false);
  // ── Save → library (M3/B5, task-16 brief §2) ──────────────────────────
  // `currentId` is the library entry THIS working design maps to, or null
  // for a design that's never been explicitly saved. Deliberately separate
  // state from the AUTOSAVE_KEY machinery below: autosave is continuous,
  // silent crash protection (every settled edit, no user intent implied);
  // `currentId`/`saved` below track an EXPLICIT save action. Neither reads
  // nor writes the other's storage key.
  const [currentId, setCurrentId] = useState(null);
  const [saved, setSaved] = useState(false); // "Saved ✓" confirmation — see the design-keyed effect below
  const [naming, setNaming] = useState(false); // inline "name this design" prompt (save-AS only)
  const [nameDraft, setNameDraft] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSurface, setDownloadSurface] = useState('header'); // 'header' | 'result_peak' — which CTA opened it (analytics)
  const [genNotice, setGenNotice] = useState(null); // 'rate' | 'challenge'
  const [chargeQuery, setChargeQuery] = useState(''); // search the full charge catalog
  const turnstileRef = useRef(null);
  const [dsUrl, setDsUrl] = useState(null); // debounced DrawShield fallback URL
  const [dsFailed, setDsFailed] = useState(false); // DrawShield img errored → degrade to local
  const [autoGenPending, setAutoGenPending] = useState(false); // queued ?desc= auto-generation

  // ── Analytics bookkeeping (task-7 brief §2) — refs, not state: none of
  //    these should trigger a re-render on their own. ──
  const studioOpenedRef = useRef(false);   // guards the mount-once studio_opened (survives StrictMode's double-invoke)
  const describeStartedRef = useRef(false); // describe_started fires once per Studio mount
  const submitStartRef = useRef(0);         // performance.now() at the most recent generate() submit
  const pendingFirstRenderRef = useRef(false); // true between a generate() success and the design's first paint
  const hasEditedRef = useRef(false);       // has design_edited fired yet for the *current* design
  const editsCountRef = useRef(0);          // count of design_edited fires for the *current* design — download_opened{edits_count} (task-19 brief §6)
  const searchPickedRef = useRef(false);    // did the current charge-search session already end in a pick

  // ── M4 unlock return-leg (task-19 brief §4) — a verified-but-not-yet-
  // finalized purchase: set once /api/verify-payment confirms `paid:true`,
  // consumed by the finalize effect below once `design` has settled to the
  // SAME hash Stripe's metadata carried. The hash-restore mount effect and
  // this ?cs= verification are two independent effects that can resolve in
  // EITHER order — this ref is what lets them rendezvous. `unlockTick` is
  // the other half of that: in the (common) case where `design` finishes
  // loading BEFORE verify-payment resolves, the finalize effect's `[design]`
  // dependency has already run once (finding pendingUnlockRef still null)
  // and — `design` itself not changing again — would otherwise never
  // re-run; bumping this counter the instant pendingUnlockRef is actually
  // set forces that re-check regardless of which side arrived first (caught
  // live: the design-loads-first ordering is the actual common case, since
  // decodeCoat is local/synchronous-ish while verify-payment is a real
  // network round trip). ──
  const pendingUnlockRef = useRef(null); // { hash, token } | null
  const [unlockTick, setUnlockTick] = useState(0);

  // studio_opened — once per mount, with the CTA source Landing recorded
  // (or 'direct' for a bare /studio visit / refresh / share arrival).
  useEffect(() => {
    if (studioOpenedRef.current) return;
    studioOpenedRef.current = true;
    let source = null;
    try {
      source = sessionStorage.getItem(STUDIO_SOURCE_KEY);
      sessionStorage.removeItem(STUDIO_SOURCE_KEY);
    } catch { /* storage unavailable — defaults to 'direct' */ }
    track('studio_opened', { source: source || 'direct' });
  }, []);

  // ── Generation. Calls the Claude-backed Pages Function (spec §6.1), which
  //    returns a validated Coat. Falls back to a canned preset when the API
  //    isn't reachable / configured (offline, local dev, no key) so the
  //    experience never dead-ends. This is the DESCRIBE path only — a preset
  //    chip pick never reaches this function (see selectPreset below). ──
  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenNotice(null);
    const started = Date.now();
    submitStartRef.current = performance.now();
    track('generate_submitted', { desc_length: desc.length });
    // Execute Turnstile on submit (invisible unless it needs to challenge —
    // see components/Turnstile.jsx) and await its one-shot token before
    // POSTing. Not configured / not ready yet → resolves null, same fail-safe
    // as before (the server gate treats a missing token as unconfigured).
    //
    // Raced against TURNSTILE_TIMEOUT_MS (review round 1, Finding 1): if the
    // widget never fires any of its four terminal callbacks — a real
    // network-fault shape (script failed to load / never initialized), not
    // the already-handled "unconfigured" case above — the bare await used to
    // hang forever, leaving `generating` stuck true with no route back to the
    // preset fallback. A timeout is treated exactly like "the challenge
    // subsystem is unavailable": skip the network round trip entirely (a
    // token-less POST could otherwise come back as a bogus failed_challenge
    // block) and fall straight through to the SAME preset-fallback tail every
    // other unreachable-API case already uses below — no new notice, no new
    // outcome, no new code path.
    const tokenResult = await raceWithTimeout(
      turnstileRef.current?.execute() ?? Promise.resolve(null),
      TURNSTILE_TIMEOUT_MS,
      TURNSTILE_TIMED_OUT,
    );
    const timedOut = tokenResult === TURNSTILE_TIMED_OUT;
    const tok = timedOut ? null : tokenResult;
    let next = null;
    let blocked = null; // 'rate' | 'challenge' — an explicit gate, not a fallback case
    if (!timedOut) {
      try {
        const r = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ description: desc, turnstileToken: tok }),
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
          // Toxic half-config (server secret set, no client site key): no widget
          // ever rendered, so token is always null and failed_challenge is really
          // an unavailable challenge, not something the user can complete.
          if (e.error === 'failed_challenge' && turnstileConfigured) blocked = 'challenge';
        }
        // 503 / other → fall through to the canned-preset fallback
      } catch { /* network/offline → preset fallback */ }
    }
    // (timedOut → next/blocked stay at their initial null, which the shared
    // tail below already treats as "no AI design" → preset fallback.)

    // Turnstile tokens are single-use — refresh for the next attempt. Safe to
    // call even after a timeout: reset() is a no-op if the widget never
    // finished rendering (see components/Turnstile.jsx).
    turnstileRef.current?.reset();

    if (blocked) {
      setGenerating(false);
      setGenNotice(blocked);
      track('generate_result', { outcome: blocked === 'rate' ? 'rate_limited' : 'challenge_failed', latency_ms: Math.round(performance.now() - submitStartRef.current) });
      return; // stay on the describe step; don't silently preset on an explicit block
    }
    const fromAi = !!next;
    if (!next) {
      const p = pickPreset(desc);
      // Canned presets predate the achievement model — backfill so the
      // fallback path also produces a full achievement, same as the AI path
      // (generate.js runs withDefaultAchievement() server-side).
      next = withDefaultAchievement(JSON.parse(JSON.stringify(p.design)));
    }
    const elapsed = Date.now() - started; // hold the spinner briefly so it never flashes
    if (elapsed < 900) await new Promise((res) => setTimeout(res, 900 - elapsed));
    hasEditedRef.current = false;        // a freshly generated design — no edits yet
    editsCountRef.current = 0;
    pendingFirstRenderRef.current = true; // consumed by the first_render effect below
    setDesign(next);
    setGenerating(false);
    setLang('plain');
    setStep('design');
    track('generate_result', { outcome: fromAi ? 'ai' : 'preset_fallback', latency_ms: Math.round(performance.now() - submitStartRef.current) });
  };

  // ── Preset selection — the OTHER fork (task-15 brief §1). A preset chip's
  //    design is already a known, complete AST (PRESETS below), so this
  //    paints it straight away: no fetch, no Turnstile, no generate()
  //    machinery, no spinner. Deliberately a separate function from
  //    generate() — the two paths only share the withDefaultAchievement
  //    backfill and the "settle into the design step" tail, both inlined
  //    here rather than threading a preset flag through the async fetch
  //    path. Guarded by `generating` only so a mid-flight describe submit
  //    (rare: chips stay clickable while "Designing…" shows) can't have its
  //    eventual result silently clobber a preset the user picked in the
  //    meantime, or vice versa. ──
  const selectPreset = (i) => {
    if (generating) return;
    track('preset_selected', { index: i });
    const next = withDefaultAchievement(JSON.parse(JSON.stringify(PRESETS[i].design)));
    hasEditedRef.current = false;         // a freshly picked design — no edits yet
    editsCountRef.current = 0;
    pendingFirstRenderRef.current = true; // consumed by the first_render effect below
    submitStartRef.current = performance.now();
    setDesign(next);
    setLang('plain');
    setStep('design');
  };

  const restart = () => {
    setStep('describe');
    setDesign(null);
    setDesc('');
    setCurrentId(null); // "Start over" always starts a fresh, unsaved design
    setNaming(false);
    navigate('/studio', { replace: true });
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch { /* storage unavailable — ignored silently */ }
  };

  // Every edit funnels through a coat.js mutator — one code path, immutable.
  // `part`/`control` drive design_edited (task-7 brief §2) — centralized
  // here so every call-site below stays a plain `apply(fn, part, control,
  // ...args)` one-liner instead of a separate track() call each.
  const apply = (fn, part, control, ...args) => {
    setDesign((d) => fn(d, ...args));
    const isFirstEdit = !hasEditedRef.current;
    hasEditedRef.current = true;
    editsCountRef.current += 1;
    track('design_edited', { part, control, is_first_edit: isFirstEdit });
  };

  const openDownload = (surface) => {
    if (!design) return;
    setDownloadSurface(surface);
    setDownloadOpen(true);
  };

  const copyBlazon = () => {
    navigator.clipboard?.writeText(blazon(design, 'formal')).catch(() => {});
    setCopied(true);
    track('blazon_copied');
    setTimeout(() => setCopied(false), 1600);
  };

  // Writes to the library (`blazon:library:v1`, via src/library.js) and
  // flips the "Saved ✓" confirmation. `name` is omitted on an overwrite —
  // saveDesign keeps the entry's existing name in that case (no re-prompt).
  const commitSave = (name) => {
    const result = saveDesign(localStorage, { id: currentId || undefined, name, coat: design });
    if (!result) return; // quota/write failure — no toast system; Save just stays clickable, unclaimed
    setCurrentId(result.id);
    setSaved(true);
    // library_size is a COUNT, not the design's name/coat — see analytics.js's SAFE_PROPS.
    track('design_saved', { library_size: listDesigns(localStorage).length });
  };

  // Save button click. An already-saved design (currentId set) overwrites
  // straight away — no prompt. An unsaved design opens the inline save-AS
  // name prompt, defaulted to the same slug export.js's PNG download uses
  // (don't hand-roll a second one). export.js is code-split (pulls in
  // react-dom/server, per DownloadDialog.jsx) — load it on click only, same
  // pattern as the Download button.
  const startSave = async () => {
    if (!design) return;
    if (currentId) { commitSave(); return; }
    const { slug } = await import('./export.js');
    setNameDraft(slug(design));
    setNaming(true);
  };

  const confirmSaveAs = () => {
    commitSave(nameDraft.trim() || undefined); // empty → saveDesign's own "Untitled" default
    setNaming(false);
  };

  const cancelSaveAs = () => setNaming(false);

  // ── URL state: restore on mount, then keep the URL/autosave in sync with
  //    `design` afterwards. ──
  //
  // Restore precedence: hash payload, then localStorage autosave, then (if
  // neither exists) a `?desc=` to prefill + auto-generate, else blank
  // describe. A decode failure at any stage falls through to the next one —
  // the describe step is the ultimate safety net, never a crash. Every path
  // that lands a design here — Open-from-library, /a/'s "Open in Studio", a
  // reload restoring from hash — goes through the hash branch below (all
  // three ultimately arrive as /studio#<payload>); the autosave branch
  // covers the same case for the rarer "hash missing/cleared, autosave
  // still present" situation.
  useEffect(() => {
    let cancelled = false;

    // Task 18 §2b — the save-identity reconnect (a HARD requirement handed
    // off by Task 16: `currentId` is in-memory-only React state, so any path
    // that LOADS a design here has no way to know it might already be a
    // saved library entry; without this, the next Save would fork a
    // duplicate instead of overwriting). Fire-and-forget, right after a
    // design is set: hash it, look it up in the library, and if it's
    // already there, reconnect `currentId` to that entry.
    const reconnectSaveIdentity = (coat) => {
      designHash(coat)
        .then((hash) => findByHash(localStorage, hash))
        .then((entry) => { if (!cancelled && entry) setCurrentId(entry.id); })
        .catch(() => { /* hashing/lookup failure — currentId just stays null; Save still works (save-as) */ });
    };

    (async () => {
      const hashPayload = parseHash(window.location.hash);
      if (hashPayload) {
        try {
          const coat = await decodeCoat(hashPayload);
          if (cancelled) return;
          hasEditedRef.current = false; // a freshly loaded design — no edits yet
          editsCountRef.current = 0;
          setDesign(coat);
          setLang('plain');
          setStep('design');
          reconnectSaveIdentity(coat);
          return;
        } catch { /* bad hash payload — fall through to autosave/describe */ }
      }

      try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        const envelope = raw ? JSON.parse(raw) : null;
        if (envelope && envelope.v === 1 && envelope.coat) {
          if (cancelled) return;
          hasEditedRef.current = false; // a freshly loaded design — no edits yet
          editsCountRef.current = 0;
          setDesign(envelope.coat);
          setLang('plain');
          setStep('design');
          reconnectSaveIdentity(envelope.coat);
          return;
        }
      } catch { /* corrupt/missing autosave — ignored silently */ }

      const q = parseQuery(window.location.search);
      if (q.desc) {
        if (cancelled) return;
        setDesc(q.desc);
        setAutoGenPending(true);
        navigate('/studio', { replace: true }); // strip ?desc= once consumed
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fire the queued ?desc= auto-generation once `desc` has actually settled
  // to the query value — generate() reads `desc` via closure and awaits
  // turnstileRef.current.execute() itself (no `token` state — Task 15
  // removed it), so this needs a render past the setDesc above to see the
  // right text; same path a manual submit uses (Turnstile handling, notices,
  // fallback).
  useEffect(() => {
    if (!autoGenPending) return;
    setAutoGenPending(false);
    generate();
  }, [autoGenPending]);

  // ── M4 unlock return leg (task-19 brief §4) — the Stripe Checkout
  // `?cs=<session_id>` success redirect. Independent of, and possibly
  // resolving before OR after, the hash-restore effect above (both fire on
  // mount) — see pendingUnlockRef's own comment for how they rendezvous.
  // Runs once per mount; `?cs=` is stripped below regardless of outcome, so
  // a re-render never re-triggers this (and a genuine remount — e.g. the
  // user hits refresh before the strip completes — safely re-verifies the
  // SAME session_id, which /api/verify-payment treats idempotently).
  useEffect(() => {
    let cancelled = false;
    const q = parseQuery(window.location.search);
    (async () => {
      if (q.cs) {
        try {
          const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session_id: q.cs }),
          });
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            if (res.ok && data.paid && data.token && data.designHash) {
              pendingUnlockRef.current = { hash: data.designHash, token: data.token };
              // Force the finalize effect below to (re-)check NOW — the
              // common case is `design` already settled (a local decode)
              // well before this network round trip returns, so its own
              // `[design]` dependency won't fire again on its own; see
              // pendingUnlockRef's comment.
              setUnlockTick((t) => t + 1);
            } else {
              // Verified but unpaid/unknown session — treat like a cancel
              // return (no partial/half-unlocked state is ever shown).
              track('checkout_abandoned');
            }
          }
        } catch { /* network failure verifying — fail-safe: no crash, no false unlock */ }
        try { sessionStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* storage unavailable */ }
        // Strip ?cs= either way — a one-shot session id must never linger in
        // the address bar/history. Keeps whatever hash payload is present.
        navigate('/studio' + window.location.hash, { replace: true });
      } else {
        let pending = false;
        try { pending = sessionStorage.getItem(CHECKOUT_PENDING_KEY) === '1'; } catch { /* storage unavailable */ }
        if (pending) {
          track('checkout_abandoned'); // returned via cancel_url (or closed the Stripe tab) — no ?cs= at all
          try { sessionStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* storage unavailable */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Finalize a verified-but-pending unlock once `design` has settled to the
  // SAME hash Stripe's metadata carried (set by the effect above; consumed
  // here rather than there so this works regardless of which effect resolves
  // first — see pendingUnlockRef's own comment). Depends on `unlockTick` as
  // well as `design`: `design` becoming available and verify-payment
  // resolving are two independent async events, and either can happen
  // second — this effect must re-run on WHICHEVER one arrives last, not
  // just on `design` changing. A mismatch (design hasn't caught up yet, or
  // — defensively — never will) just leaves the ref set; it costs nothing
  // to wait, and this NEVER unlocks the wrong design.
  useEffect(() => {
    if (!pendingUnlockRef.current || !design) return undefined;
    const pending = pendingUnlockRef.current;
    let cancelled = false;
    designHash(design).then((h) => {
      if (cancelled || h !== pending.hash) return;
      pendingUnlockRef.current = null;
      recordUnlock(h, pending.token, { v: 1, coat: design });
      // Ensure the purchased design lives in the library too (task-19 brief
      // §4: "the purchased snapshot stays downloadable from the library"),
      // flagged unlocked — overwrites the current entry if this design is
      // already saved (currentId), else creates one so a purchase is never
      // silently unsaved-and-unfindable.
      const result = saveDesign(localStorage, { id: currentId || undefined, coat: design });
      if (result) {
        setCurrentId(result.id);
        setLibraryUnlocked(localStorage, result.id, true);
      }
      track('checkout_completed', { value: 19 });
      setDownloadSurface('header');
      setDownloadOpen(true); // reopens in the unlocked state — DownloadDialog re-derives it from isUnlocked(hash)
    }).catch(() => { /* hashing failure — pendingUnlockRef stays set; costs nothing to leave it */ });
    return () => { cancelled = true; };
    // currentId is read, not depended-on-for-re-running: this effect's job is
    // "design caught up to the pending hash OR a pending unlock just
    // arrived", which only design/unlockTick changing can ever newly satisfy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, unlockTick]);

  // first_render — once per generation, when the design step actually paints
  // the new design (useEffect runs after commit/paint, not before). The
  // pendingFirstRenderRef guard is what makes this "once per generation" and
  // not "on every subsequent edit" — apply() also changes `design`, but only
  // generate() sets the flag this effect consumes.
  useEffect(() => {
    if (!pendingFirstRenderRef.current || !design) return;
    pendingFirstRenderRef.current = false;
    track('first_render', { ms_since_submit: Math.round(performance.now() - submitStartRef.current) });
  }, [design]);

  // "Saved ✓" reflects the CURRENT design only — ANY change to `design`
  // (an edit, Start over, a fresh generate/preset pick, a hash/autosave
  // restore) invalidates it. Keyed off the `design` reference itself, not a
  // timer — unlike the Copy button's timed revert (below), the brief calls
  // for "until the next edit", not "for N seconds". A successful save does
  // NOT change `design`, so this never fires right after setSaved(true).
  useEffect(() => { setSaved(false); }, [design]);

  // Debounced hash + autosave write, ~400ms after the design settles. Always
  // replaceState — never pushState per edit (no history spam).
  useEffect(() => {
    if (!design) return undefined;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ v: 1, coat: design }));
      } catch { /* storage unavailable/full — ignored silently */ }
      encodeCoat(design)
        .then((payload) => navigate('/studio#' + payload, { replace: true }))
        .catch(() => { /* encoding failure shouldn't crash the editor */ });
    }, 400);
    return () => clearTimeout(t);
  }, [design]);

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

  // ── Achievement — derived values for the AROUND THE SHIELD chapter. Full
  // by default (every generated/preset design already carries one); `false`
  // only after the chapter-level "Just the shield" strip. Fallbacks
  // (`|| {…}`) guard the rare shape where crest exists but helm/torse/
  // mantling don't (no UI path produces this today, but a hand-crafted/
  // decoded share link could) — never crash the "more…" disclosure. ──
  const showAchievement = design ? hasAchievement(design) : false;
  const crestG = design ? crest(design) : null;
  const helmG = (design && helm(design)) || { style: 'esquire' };
  const torseG = (design && torse(design)) || { tinctures: ['Or', 'Gules'] };
  const mantlingG = (design && mantling(design)) || { tinctures: ['Gules', 'Or'] };
  const suppG = design ? supporters(design) : null;
  const sinisterG = suppG ? (suppG.sinister || suppG.dexter) : null;

  // Achievement-part edits use the same one-liner `apply()` for design_edited
  // (part ∈ crest|helm|torse|mantling|supporters|compartment), but Set
  // aside/Restore/Just-the-shield are their OWN taxonomy events (task-14
  // brief §3) — dedicated call-sites, not folded into apply()/design_edited.
  const setAsidePart = (part, clearFn) => {
    setDesign((d) => clearFn(d));
    editsCountRef.current += 1; // counted alongside apply()'s edits — see download_opened{edits_count}
    track('achievement_part_removed', { part });
  };
  // Restore always re-seeds via restoreFullAchievement (coat.js) — it only
  // fills parts that are MISSING, so restoring one just-cleared part never
  // overwrites any other part that's still set (forward-note: "Restore
  // re-seeds via the relevant set* default").
  const restorePart = (part) => {
    setDesign((d) => restoreFullAchievement(d));
    editsCountRef.current += 1;
    track('achievement_part_restored', { part });
  };
  const toggleJustShield = () => {
    editsCountRef.current += 1;
    if (hasAchievement(design)) {
      setDesign((d) => stripAchievement(d));
      track('just_shield_toggled', { on: true });
    } else {
      setDesign((d) => restoreFullAchievement(d));
      track('just_shield_toggled', { on: false });
    }
  };

  // ── Preview shield slot — the achievement's escutcheon inset. When the
  // design draws locally, `null` lets <Achievement> render its own <Shield>
  // (instant, no debounce — task-14 brief §1's hard requirement). An
  // out-of-vocab escutcheon needs the SAME debounce/onError/note behaviour
  // the plain shield-only preview below already has (the public DrawShield
  // API is rate-limited — never fetch on every edit) — <Achievement>'s own
  // built-in fallback has no debounce, so this overrides its `shieldSlot`
  // with Studio's existing `dsUrl`/`dsFailed` state instead of duplicating
  // that machinery inside the composition. `<image>` (SVG), not an HTML
  // <img> — this renders as a direct child of an <svg>. An empty <g/> during
  // the pending 600ms window blocks <Achievement>'s own undebounced default
  // (passing `null` here would fall through to it) without hammering the API.
  const shieldSlot = design && !local
    ? (dsFailed
      ? <Shield design={design} width="100%" ariaHidden />
      : dsUrl
        ? <image href={dsUrl} x={0} y={0} width={200} height={240} onError={() => setDsFailed(true)} />
        : <g />)
    : null;

  // Charge search + charge_search_used (task-7 brief §2). A "session" is
  // scoped to the current (non-empty) chargeQuery; searchPickedRef tracks
  // whether it already reported a pick, so closing the picker afterwards
  // doesn't double-report the same session as an abandon.
  const searchHits = (q) => catalogKeys.filter((k) => k.includes(q.trim().toLowerCase()));
  // pickFromSearch is guarded by searchPickedRef too (not just set by it) —
  // picking a second result from the same search session must not re-report
  // picked:true (review round 1, Finding 4).
  const pickFromSearch = (k) => {
    if (!searchPickedRef.current) {
      searchPickedRef.current = true;
      track('charge_search_used', { query_len: chargeQuery.trim().length, hits: searchHits(chargeQuery).length, picked: true });
    }
    apply(setCharge, 'symbol', 'search', k);
  };
  // Clears chargeQuery (and the picked flag) once the session is reported —
  // closing the picker again with no new input then hits the `!q` guard
  // instead of re-reporting the same query as a fresh abandon (review round
  // 1, Finding 4: reopen→close with no new typing used to double-fire).
  const endChargeSearch = () => {
    const q = chargeQuery.trim();
    if (q && !searchPickedRef.current) {
      track('charge_search_used', { query_len: q.length, hits: searchHits(q).length, picked: false });
    }
    setChargeQuery('');
    searchPickedRef.current = false;
  };

  const Swatches = ({ names, active, onPick }) => (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
      {names.map((name) => (
        <Swatch key={name} hex={TINCTURES[name].hex} active={name === active} title={`${name} (${TINCTURES[name].plain})`} onClick={() => onPick(name)} />
      ))}
    </div>
  );

  // ── Header layout (task-18 brief §2) — pure inline-vs-overflow decision
  // lives in header-layout.js; the ONE thing that's runtime data, not
  // layout, is whether Library even has anything to link to. Re-read on
  // every render (cheap; picks up a Save that just happened for free). ──
  const libraryNonEmpty = listDesigns(localStorage).length > 0;
  const { inline: headerInline, overflow: headerOverflow } = headerControls(isMobile);
  const quietBtnStyle = { background: 'none', border: 'none', color: C.muted, padding: '9px 6px', fontSize: 13.5, cursor: 'pointer', fontFamily: F.sans };

  return (
    <div style={{ height: isMobile ? 'auto' : '100vh', minHeight: isMobile ? '100vh' : undefined, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 16px' : '14px 24px', background: '#101A2A', borderBottom: '1px solid rgba(201,162,75,.25)', flex: 'none', gap: 12 }}>
        {/* A real <button> (task-21 a11y sweep) — this was a bare onClick
            div, the only way back to Landing, and entirely unreachable from
            the keyboard. */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Blazon home"
          style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit' }}
        >
          {LOGO}
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 21 }}>Blazon</span>
        </button>
        {/* No mode selector by design: the personas (Gifter / Enthusiast / Serious) are an
            internal UX-design instrument, not in-product furniture. Depth is reached through
            progressive disclosure (the Blazon Bar's plain↔formal toggle, "swap this element",
            the per-card "more…" reveals) — never a self-classification switch on arrival. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {naming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmSaveAs();
                  if (e.key === 'Escape') cancelSaveAs();
                }}
                onBlur={cancelSaveAs}
                placeholder="Name this design…"
                style={{ background: '#0B111C', border: `1px solid ${C.lineHi}`, borderRadius: 7, padding: '8px 10px', color: C.cream, fontSize: 13, fontFamily: F.sans, width: isMobile ? 118 : 160 }}
              />
              {/* onMouseDown preventDefault (not onClick alone): a plain click would
                  blur the input FIRST (cancelSaveAs), unmounting this button before its
                  own click could fire — this keeps the input focused through the click. */}
              <button onMouseDown={(e) => e.preventDefault()} onClick={confirmSaveAs} style={{ ...goldBtn, padding: '9px 14px', fontSize: 13 }}>Save</button>
            </div>
          ) : (
            <>
              {/* Library — quiet, only when there's something to see there. */}
              {headerInline.includes('library') && libraryNonEmpty && (
                <button onClick={() => navigate('/library')} style={quietBtnStyle}>Library</button>
              )}
              {headerInline.includes('save') && (
                <button
                  onClick={startSave}
                  style={{ background: 'transparent', color: saved ? C.gold : C.cream, border: `1px solid ${C.lineHi}`, padding: '9px 16px', borderRadius: 7, fontSize: 13.5, cursor: design ? 'pointer' : 'default', opacity: design ? 1 : .5, fontFamily: F.sans }}
                >{saved ? 'Saved ✓' : 'Save'}</button>
              )}
              {headerInline.includes('share') && design && (
                <SharePopover design={design} surface="header" />
              )}
              {/* Mobile: Library/Save/Share collapse into a "⋯" overflow using
                  the same MenuPopover primitive Share itself is built on
                  (task-18 brief §2). Share, nested inside, is the exact same
                  <SharePopover> component (its own MenuPopover flyout) —
                  not a second hand-rolled copy/native-share implementation. */}
              {headerOverflow.length > 0 && (
                <MenuPopover
                  label="More"
                  align="right"
                  trigger={(toggle) => (
                    <button onClick={toggle} aria-label="More options" style={{ background: 'transparent', color: C.cream, border: `1px solid ${C.lineHi}`, borderRadius: 7, padding: '8px 13px', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>⋯</button>
                  )}
                >
                  {(close) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 170 }}>
                      {headerOverflow.includes('library') && libraryNonEmpty && (
                        <MenuItem onClick={() => { close(); navigate('/library'); }}>Library</MenuItem>
                      )}
                      {headerOverflow.includes('save') && (
                        <MenuItem onClick={() => { close(); startSave(); }} style={{ opacity: design ? 1 : .5 }}>{saved ? 'Saved ✓' : 'Save'}</MenuItem>
                      )}
                      {headerOverflow.includes('share') && design && (
                        <SharePopover
                          design={design}
                          surface="header"
                          align="left"
                          trigger={(t) => <MenuItem onClick={t}>Share</MenuItem>}
                        />
                      )}
                    </div>
                  )}
                </MenuPopover>
              )}
            </>
          )}
          <button
            onClick={() => openDownload('header')}
            style={{ ...goldBtn, padding: '9px 18px', fontSize: 13.5, cursor: design ? 'pointer' : 'default', opacity: design ? 1 : .5 }}
          >Download</button>
        </div>
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        {/* Left — live preview. On mobile during the describe step there is nothing to
            preview yet, so the prompt (aside) leads and the empty preview follows. */}
        <div style={{ flex: isMobile ? 'none' : 1, order: isMobile && step === 'describe' ? 2 : 1, height: isMobile ? 'auto' : undefined, minHeight: isMobile ? 300 : undefined, maxHeight: isMobile ? '62vh' : undefined, background: 'radial-gradient(circle at 50% 42%, #1A2C44, #0B0E16)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 11, letterSpacing: '2.5px', color: 'rgba(201,162,75,.7)', fontWeight: 600 }}>LIVE PREVIEW</div>

          {!generating && !design && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, opacity: .5 }}>
              <svg width="160" height="192" viewBox="0 0 200 240"><path d={SHIELD_OUTLINE} fill="none" stroke="rgba(201,162,75,.5)" strokeWidth="2" strokeDasharray="7 8" /></svg>
              <span style={{ fontSize: 14, color: 'rgba(236,230,216,.6)' }}>Your arms will appear here.</span>
            </div>
          )}

          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(201,162,75,.25)', borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 19, color: 'rgba(236,230,216,.85)', maxWidth: '18em', textAlign: 'center', lineHeight: 1.4 }}>Reading your story and drawing the arms…</span>
            </div>
          )}

          {!generating && design && showAchievement && (
            // The default path — every generated/preset design is a full
            // achievement. Local parts (mantling/helm/torse/crest/
            // supporters/motto scroll) always render synchronously; only the
            // escutcheon INSIDE it can ever defer to DrawShield (shieldSlot,
            // above) — no debounce machinery gates this outer swap itself.
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadein .5s ease' }}>
              <div style={{ width: isMobile ? 240 : 460 }}>
                {/* backfill={false}: Studio's `design` already carries the
                    achievement exactly as the user left it (Set aside/Restore,
                    Just the shield) — the default auto-fill would silently
                    re-seed a part the user just cleared (see Achievement.jsx's
                    docblock). */}
                <Achievement design={design} shieldSlot={shieldSlot} width="100%" backfill={false} />
              </div>
              {!local && dsUrl && !dsFailed && (
                <div style={{ fontSize: 11, color: 'rgba(236,230,216,.4)', marginTop: 10, letterSpacing: '.3px' }}>artwork by DrawShield</div>
              )}
              {/* The motto scroll inside <Achievement> already carries the motto —
                  no separate caption here (would double-show it; task-14 brief §1). */}
            </div>
          )}

          {!generating && design && !showAchievement && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadein .5s ease' }}>
              <div style={{ width: isMobile ? 188 : 300 }}>
                {local || dsFailed ? (
                  <Shield design={design} />
                ) : dsUrl ? (
                  <img src={dsUrl} alt={formal} onError={() => setDsFailed(true)} style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 16px 34px rgba(0,0,0,.5))' }} />
                ) : (
                  <div style={{ height: isMobile ? 226 : 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid rgba(201,162,75,.25)', borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
              {!local && dsUrl && !dsFailed && (
                <div style={{ fontSize: 11, color: 'rgba(236,230,216,.4)', marginTop: 10, letterSpacing: '.3px' }}>artwork by DrawShield</div>
              )}
              {design.motto && design.motto.trim() && (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, color: C.gold, marginTop: 26, letterSpacing: '.5px' }}>“{design.motto}”</div>
              )}
            </div>
          )}
        </div>

        {/* Right — control panel */}
        <aside style={{ width: isMobile ? '100%' : 466, flex: 'none', order: isMobile && step === 'describe' ? 1 : 2, background: '#0F1826', borderLeft: isMobile ? 'none' : '1px solid rgba(201,162,75,.2)', borderTop: isMobile && step !== 'describe' ? '1px solid rgba(201,162,75,.2)' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? '24px 18px 32px' : '30px 30px 40px' }}>
          {step === 'describe' && (
            <div style={{ animation: 'fadein .4s ease' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 30, margin: '0 0 10px' }}>Tell us their story.</h2>
              <p style={{ fontSize: 14.5, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: '0 0 22px' }}>A name, a place, what they loved, what they were like. The more human, the better the arms — we do the rest.</p>
              {/* A real (visually-hidden) <label>, not just the placeholder
                  (task-21 a11y sweep — a placeholder alone is not an
                  accessible name: it vanishes once there's text and isn't
                  reliably exposed as a label by every screen reader). */}
              <label htmlFor="describe-textarea" style={srOnly}>Tell us their story</label>
              <textarea
                id="describe-textarea"
                value={desc}
                onChange={(e) => {
                  if (!describeStartedRef.current) { describeStartedRef.current = true; track('describe_started'); }
                  setDesc(e.target.value);
                }}
                placeholder="My grandmother was from the Highlands of Scotland. She loved astronomy and the night sky, and she was the steady one who held the family together…"
                style={{ width: '100%', minHeight: 150, background: '#0B111C', border: '1px solid rgba(201,162,75,.28)', borderRadius: 10, padding: 16, color: '#ECE6D8', fontSize: 15, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 12, color: 'rgba(236,230,216,.5)', margin: '16px 0 9px', letterSpacing: '.5px' }}>OR TRY ONE OF THESE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => selectPreset(i)} style={{ textAlign: 'left', background: '#0B111C', border: '1px solid rgba(201,162,75,.2)', borderRadius: 9, padding: '11px 14px', color: 'rgba(236,230,216,.82)', fontSize: 13.5, cursor: 'pointer' }}>{p.chip}</button>
                ))}
              </div>
              <Turnstile ref={turnstileRef} />
              {/* disabled={generating} (review round 1, Finding 1) — not just styled-disabled: the
                  describe-submit path now awaits a Turnstile round trip (raced against a
                  timeout, see TURNSTILE_TIMEOUT_MS above) before it can clear `generating`,
                  so a merely-styled-disabled button left a re-submit route open during any
                  slow/stuck stretch. generate() itself also short-circuits on `generating`
                  (belt-and-braces), but a real `disabled` is what actually stops the click/
                  keyboard-Enter from reaching onClick at all. */}
              <button onClick={generate} disabled={generating} style={{ ...goldBtn, width: '100%', marginTop: 14, padding: 15, borderRadius: 9, fontSize: 15.5, opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}>{generating ? 'Designing…' : 'Create the coat of arms'}</button>
              {genNotice && (
                <p style={{ fontSize: 12.5, color: '#E0B36A', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
                  {genNotice === 'rate'
                    ? "You're generating quickly — give it a moment, then try again."
                    : 'Please complete the verification above, then try again.'}
                </p>
              )}
              <p style={{ fontSize: 12, color: 'rgba(236,230,216,.45)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>No heraldry knowledge required — you can change every choice afterwards.</p>
            </div>
          )}

          {step === 'design' && design && (
            <div style={{ animation: 'fadein .4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 28, margin: 0 }}>Here's what we made.</h2>
                <button onClick={restart} style={{ background: 'transparent', border: 'none', color: C.gold, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Start over</button>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: '0 0 20px' }}>Tap any card to change a colour or shape. Open “more…” to go further — you don’t need to know a single heraldic word to start.</p>

              {warn && (
                <div style={{ background: 'rgba(178,58,58,.16)', border: '1px solid #B23A3A', borderRadius: 10, padding: '13px 15px', marginBottom: 18, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ color: '#E08A8A', fontSize: 16, lineHeight: 1.2 }}>⚠</span>
                  <span style={{ fontSize: 13, color: '#F0CFCF', lineHeight: 1.5 }}>{warn}</span>
                </div>
              )}

              <ChapterRule label="THE SHIELD" />

              {/* ── Field ── */}
              <PartCard tag="THE FIELD" valueText={divided ? cap(div.type) : fieldTincture(design)} rationale={design.rationale?.field}>
                {!divided ? (
                  <>
                    <Swatches names={TINCTURE_ORDER} active={fieldTincture(design)} onPick={(t) => apply(setFieldTincture, 'field', 'swatch', t)} />
                    <div style={{ marginTop: 13 }}>
                      <Disclosure label="More colours — furs">
                        <Swatches names={FUR_STAIN} active={fieldTincture(design)} onPick={(t) => apply(setFieldTincture, 'field', 'swatch', t)} />
                      </Disclosure>
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <Disclosure label="Divide the field">
                        <div style={pillRow}>
                          {DIVISION_ORDER.map((k) => (
                            <Pill key={k} active={false} onClick={() => apply(setDivision, 'division', 'pill', k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={pillRow}>
                      {DIVISION_ORDER.map((k) => (
                        <Pill key={k} active={k === div.type} onClick={() => apply(setDivision, 'division', 'pill', k)}>{cap(k)}</Pill>
                      ))}
                      <Pill active={false} onClick={() => apply(clearDivision, 'division', 'pill')}>Plain field</Pill>
                    </div>
                    <SubLabel>First colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={div.tinctures[0]} onPick={(t) => apply(setDivisionPart, 'division', 'swatch', 0, t)} />
                    <SubLabel style={{ marginTop: 12 }}>Second colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={div.tinctures[1]} onPick={(t) => apply(setDivisionPart, 'division', 'swatch', 1, t)} />
                    <div style={{ marginTop: 13 }}>
                      <Disclosure label="Edge style">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {LINE_ORDER.map((k) => (
                            <Pill key={k} active={(div.line || 'straight') === k} onClick={() => apply(setDivisionLine, 'division', 'pill', k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                  </>
                )}
              </PartCard>

              {/* ── Structure ── */}
              <PartCard tag="THE STRUCTURE" valueText={struct ? cap(struct.object.key) : 'None'} rationale={design.rationale?.ordinary}>
                <div style={pillRow}>
                  {ORDINARY_ORDER.map((k) => (
                    <Pill key={k} active={!!struct && struct.object.key === k} onClick={() => apply(setOrdinary, 'structure', 'pill', k)}>{cap(k)}</Pill>
                  ))}
                </div>
                <Disclosure label="More structures">
                  <div style={pillRow}>
                    {MORE_STRUCTURES.map((k) => (
                      <Pill key={k} active={!!struct && struct.object.key === k} onClick={() => apply(setOrdinary, 'structure', 'pill', k)}>{cap(k)}</Pill>
                    ))}
                    <Pill active={!struct} onClick={() => apply(clearOrdinary, 'structure', 'pill')}>None</Pill>
                  </div>
                </Disclosure>
                {struct && (
                  <>
                    <div style={{ margin: '12px 0' }}>
                      <Disclosure label="Edge style">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {LINE_ORDER.map((k) => (
                            <Pill key={k} active={(struct.object.line || 'straight') === k} onClick={() => apply(setOrdinaryLine, 'structure', 'pill', k)}>{cap(k)}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    </div>
                    <SubLabel>Its colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={struct.tincture} onPick={(t) => apply(setOrdinaryTincture, 'structure', 'swatch', t)} />
                  </>
                )}
              </PartCard>

              {/* ── Symbol ── */}
              <PartCard tag="THE SYMBOL" valueText={chg ? (CHARGES[chg.object.key]?.label || humanize(chg.object.key)) : 'None'} rationale={design.rationale?.charges}>
                <div style={pillRow}>
                  {CHARGE_ORDER.map((k) => (
                    <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => apply(setCharge, 'symbol', 'pill', k)}>{CHARGES[k].label}</Pill>
                  ))}
                </div>
                <Disclosure
                  label={`More symbols — search ${catalogKeys.length.toLocaleString()}`}
                  onToggle={(open) => { if (!open) endChargeSearch(); }}
                >
                  <input
                    value={chargeQuery}
                    onChange={(e) => { searchPickedRef.current = false; setChargeQuery(e.target.value); }}
                    placeholder="Search charges — lion, ship, oak, sun, harp…"
                    aria-label="Search the charge catalog"
                    style={{ width: '100%', background: '#0B111C', border: '1px solid rgba(201,162,75,.28)', borderRadius: 8, padding: '9px 12px', color: '#ECE6D8', fontSize: 13.5, fontFamily: 'inherit', marginBottom: 10 }}
                  />
                  {chargeQuery.trim() ? (() => {
                    const allHits = searchHits(chargeQuery);
                    const shown = allHits.slice(0, 60);
                    return shown.length ? (
                      <div style={{ ...pillRow, marginBottom: 0, maxHeight: 240, overflowY: 'auto' }}>
                        {shown.map((k) => (
                          <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => pickFromSearch(k)}>{humanize(k)}</Pill>
                        ))}
                      </div>
                    ) : <SubLabel>No charges match “{chargeQuery}”.</SubLabel>;
                  })() : (
                    CHARGES_BY_CATEGORY.map(([catName, keys]) => (
                      <div key={catName} style={{ marginBottom: 10 }}>
                        <SubLabel style={{ marginBottom: 6, textTransform: 'capitalize' }}>{catName}</SubLabel>
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {keys.map((k) => (
                            <Pill key={k} active={!!chg && chg.object.key === k} onClick={() => apply(setCharge, 'symbol', 'pill', k)}>{CHARGES[k].label}</Pill>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ marginTop: 12 }}><Pill active={!chg} onClick={() => apply(clearCharge, 'symbol', 'pill')}>None</Pill></div>
                </Disclosure>

                {chg && (
                  <>
                    {validAttitudesFor(chg.object.key).length > 0 && (
                      <div style={{ marginTop: 13 }}>
                        <SubLabel>Posture</SubLabel>
                        <div style={pillRow}>
                          {validAttitudesFor(chg.object.key).map((a) => (
                            <Pill key={a} active={chg.object.attitude === a} onClick={() => apply(setChargeAttitude, 'symbol', 'pill', a)} title={ATTITUDES[a]?.plain}>{a}</Pill>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '6px 0 13px' }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(236,230,216,.5)' }}>How many</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#16273E', borderRadius: 8, padding: '5px 6px' }}>
                        <button aria-label="Fewer" onClick={() => apply(setChargeNumber, 'symbol', 'stepper', (chg.number || 1) - 1)} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>−</button>
                        <span style={{ fontSize: 15, minWidth: 14, textAlign: 'center', fontWeight: 600 }}>{chg.number}</span>
                        <button aria-label="More" onClick={() => apply(setChargeNumber, 'symbol', 'stepper', (chg.number || 1) + 1)} style={{ background: 'none', border: 'none', color: '#ECE6D8', fontSize: 18, cursor: 'pointer', width: 24 }}>+</button>
                      </div>
                    </div>
                    {(chg.number || 1) > 1 && (
                      <Disclosure label="Arrangement">
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {ARRANGEMENTS.map((a) => (
                            <Pill key={a} active={chg.arrangement === a} onClick={() => apply(setArrangement, 'symbol', 'pill', chg.arrangement === a ? null : a)}>{a}</Pill>
                          ))}
                        </div>
                      </Disclosure>
                    )}
                    <SubLabel style={{ marginTop: 13 }}>Its colour</SubLabel>
                    <Swatches names={TINCTURE_ORDER} active={chg.tincture} onPick={(t) => apply(setChargeTincture, 'symbol', 'swatch', t)} />
                  </>
                )}
              </PartCard>

              <ChapterRule label="AROUND THE SHIELD" />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, margin: '0 0 18px' }}>
                <p style={{ fontSize: 13.5, color: 'rgba(236,230,216,.66)', lineHeight: 1.55, margin: 0, flex: 1 }}>{CHAPTER_INTRO}</p>
                <button
                  onClick={toggleJustShield}
                  style={{ flex: 'none', background: 'none', border: 'none', color: C.gold, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', marginTop: 2, fontFamily: F.sans, padding: 0 }}
                >{showAchievement ? 'Just the shield' : 'Full achievement'}</button>
              </div>

              {/* ── Motto ── */}
              <PartCard tag="THE MOTTO" valueText={design.motto && design.motto.trim() ? `“${design.motto}”` : 'None'} rationale={design.rationale?.motto}>
                <input
                  value={design.motto || ''}
                  onChange={(e) => apply(setMotto, 'motto', 'text', e.target.value)}
                  placeholder="A few words they lived by…"
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(201,162,75,.3)', padding: '6px 2px', color: '#ECE6D8', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 19 }}
                />
              </PartCard>

              {/* ── Crest & Helm ── */}
              {crestG ? (
                <PartCard
                  tag="CREST & HELM"
                  valueText={CHARGES[crestG.object.key]?.label || humanize(crestG.object.key)}
                  rationale={design.rationale?.crest || CREST_FALLBACK_RATIONALE}
                  onSetAside={() => setAsidePart('crest', clearCrest)}
                >
                  <div style={pillRow}>
                    {BEASTS.map((k) => (
                      <Pill key={k} active={crestG.object.key === k} onClick={() => apply(setCrest, 'crest', 'pill', k)}>{CHARGES[k].label}</Pill>
                    ))}
                  </div>
                  <Disclosure label="More charges">
                    {CHARGES_BY_CATEGORY.filter(([catName]) => catName !== 'beast').map(([catName, keys]) => (
                      <div key={catName} style={{ marginBottom: 10 }}>
                        <SubLabel style={{ marginBottom: 6, textTransform: 'capitalize' }}>{catName}</SubLabel>
                        <div style={{ ...pillRow, marginBottom: 0 }}>
                          {keys.map((k) => (
                            <Pill key={k} active={crestG.object.key === k} onClick={() => apply(setCrest, 'crest', 'pill', k)}>{CHARGES[k].label}</Pill>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Disclosure>
                  {validAttitudesFor(crestG.object.key).length > 0 && (
                    <div style={{ marginTop: 13 }}>
                      <SubLabel>Posture</SubLabel>
                      <div style={pillRow}>
                        {validAttitudesFor(crestG.object.key).map((a) => (
                          <Pill key={a} active={crestG.object.attitude === a} onClick={() => apply(setCrestAttitude, 'crest', 'pill', a)} title={ATTITUDES[a]?.plain}>{a}</Pill>
                        ))}
                      </div>
                    </div>
                  )}
                  <SubLabel style={{ marginTop: 13 }}>Its colour</SubLabel>
                  <Swatches names={TINCTURE_ORDER} active={crestG.tincture} onPick={(t) => apply(setCrestTincture, 'crest', 'swatch', t)} />
                  <div style={{ marginTop: 13 }}>
                    <Disclosure label="more…">
                      <SubLabel>Helm rank</SubLabel>
                      <div style={pillRow}>
                        {HELM_ORDER.map((r) => (
                          <Pill key={r} active={helmG.style === r} onClick={() => apply(setHelm, 'helm', 'pill', r)} title={HELMETS[r]?.plain}>{cap(r)}</Pill>
                        ))}
                      </div>
                      <SubLabel style={{ marginTop: 12 }}>Torse — the twisted wreath on the helm</SubLabel>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div>
                          <SubLabel style={{ fontSize: 10.5 }}>First</SubLabel>
                          <Swatches names={TINCTURE_ORDER} active={torseG.tinctures[0]} onPick={(t) => apply(setTorse, 'torse', 'swatch', [t, torseG.tinctures[1]])} />
                        </div>
                        <div>
                          <SubLabel style={{ fontSize: 10.5 }}>Second</SubLabel>
                          <Swatches names={TINCTURE_ORDER} active={torseG.tinctures[1]} onPick={(t) => apply(setTorse, 'torse', 'swatch', [torseG.tinctures[0], t])} />
                        </div>
                      </div>
                      <SubLabel style={{ marginTop: 12 }}>Mantling — the cloth behind the shield</SubLabel>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div>
                          <SubLabel style={{ fontSize: 10.5 }}>First</SubLabel>
                          <Swatches names={TINCTURE_ORDER} active={mantlingG.tinctures[0]} onPick={(t) => apply(setMantling, 'mantling', 'swatch', [t, mantlingG.tinctures[1]])} />
                        </div>
                        <div>
                          <SubLabel style={{ fontSize: 10.5 }}>Second</SubLabel>
                          <Swatches names={TINCTURE_ORDER} active={mantlingG.tinctures[1]} onPick={(t) => apply(setMantling, 'mantling', 'swatch', [mantlingG.tinctures[0], t])} />
                        </div>
                      </div>
                    </Disclosure>
                  </div>
                </PartCard>
              ) : (
                <GhostRow tag="CREST & HELM" onRestore={() => restorePart('crest')} />
              )}

              {/* ── Supporters ── */}
              {suppG ? (
                <PartCard
                  tag="SUPPORTERS"
                  valueText={CHARGES[suppG.dexter.object.key]?.label || humanize(suppG.dexter.object.key)}
                  rationale={design.rationale?.supporters || SUPPORTERS_FALLBACK_RATIONALE}
                  onSetAside={() => setAsidePart('supporters', clearSupporters)}
                >
                  <div style={pillRow}>
                    {BEASTS.map((k) => (
                      <Pill key={k} active={suppG.dexter.object.key === k} onClick={() => apply(setSupporters, 'supporters', 'pill', k)}>{CHARGES[k].label}</Pill>
                    ))}
                  </div>
                  <SubLabel style={{ marginTop: 13 }}>Their colour</SubLabel>
                  <Swatches names={TINCTURE_ORDER} active={suppG.dexter.tincture} onPick={(t) => apply(setSupporterSide, 'supporters', 'swatch', 'dexter', { tincture: t })} />
                  <div style={{ marginTop: 13 }}>
                    <Disclosure label="Different on each side">
                      <SubLabel>Dexter — the shield's own right (your left, facing it)</SubLabel>
                      <div style={pillRow}>
                        {BEASTS.map((k) => (
                          <Pill key={k} active={suppG.dexter.object.key === k} onClick={() => apply(setSupporterSide, 'supporters', 'pill', 'dexter', { object: { kind: 'charge', key: k, attitude: defaultAttitudeFor(k) || undefined } })}>{CHARGES[k].label}</Pill>
                        ))}
                      </div>
                      <Swatches names={TINCTURE_ORDER} active={suppG.dexter.tincture} onPick={(t) => apply(setSupporterSide, 'supporters', 'swatch', 'dexter', { tincture: t })} />
                      <SubLabel style={{ marginTop: 12 }}>Sinister — the shield's own left (your right, facing it)</SubLabel>
                      <div style={pillRow}>
                        {BEASTS.map((k) => (
                          <Pill key={k} active={sinisterG.object.key === k} onClick={() => apply(setSupporterSide, 'supporters', 'pill', 'sinister', { object: { kind: 'charge', key: k, attitude: defaultAttitudeFor(k) || undefined } })}>{CHARGES[k].label}</Pill>
                        ))}
                      </div>
                      <Swatches names={TINCTURE_ORDER} active={sinisterG.tincture} onPick={(t) => apply(setSupporterSide, 'supporters', 'swatch', 'sinister', { tincture: t })} />
                      <SubLabel style={{ marginTop: 14 }}>Standing on a mound</SubLabel>
                      <div style={pillRow}>
                        <Pill
                          active={!!compartment(design)}
                          onClick={() => {
                            if (compartment(design)) apply(clearCompartment, 'compartment', 'pill');
                            else apply((d) => setCompartment(d, 'mound', 'Vert'), 'compartment', 'pill');
                          }}
                        >{compartment(design) ? 'Remove the mound' : 'Add a mound'}</Pill>
                      </div>
                    </Disclosure>
                  </div>
                </PartCard>
              ) : (
                <GhostRow tag="SUPPORTERS" onRestore={() => restorePart('supporters')} />
              )}

              {/* Conversion at the result peak — one honest line, no dead paid CTAs */}
              <div style={{ marginTop: 22, borderTop: `1px solid ${C.lineMid}`, paddingTop: 18 }}>
                <button
                  onClick={() => openDownload('result_peak')}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: C.muted2, textDecoration: 'underline', cursor: 'pointer', fontFamily: F.sans, lineHeight: 1.5, letterSpacing: '.2px' }}
                >Free to design and share. Downloads are free with a small mark — clean print files are coming.</button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 14 }}><CreditsLink style={{ fontSize: 12 }} /></div>
            </div>
          )}
        </aside>
      </div>

      {/* Blazon bar — always visible */}
      <div style={{ flex: 'none', background: '#0A0D14', borderTop: `1.5px solid ${C.gold}`, padding: isMobile ? '14px 16px' : '16px 28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          {/* A real focusable/clickable popover (task-21 a11y sweep) —
              replaces a `title`-only tooltip, which never reaches a keyboard
              or screen-reader user. */}
          <InfoTip label="What is a blazon?" placement="top">The blazon is the official written description of your arms — every coat of arms has one.</InfoTip>
          <LangToggle value={lang} onFormal={() => { setLang('formal'); track('blazon_lang_toggled'); }} onPlain={() => { setLang('plain'); track('blazon_lang_toggled'); }} plainLabel="Plain English" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {design
            ? (lang === 'formal'
              ? <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600, fontSize: isMobile ? 18 : 24, color: '#ECE6D8' }}>{blazon(design, 'formal')}</span>
              : <span style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(236,230,216,.82)' }}>{blazon(design, 'plain')}</span>)
            : <span style={{ fontSize: 15, color: 'rgba(236,230,216,.4)', fontStyle: 'italic' }}>Your blazon will be written here as you design.</span>}
        </div>
        <button onClick={copyBlazon} disabled={!design} style={{ flex: 'none', background: 'transparent', border: '1px solid rgba(201,162,75,.4)', color: copied ? C.gold : '#ECE6D8', padding: '9px 18px', borderRadius: 7, fontSize: 13.5, cursor: design ? 'pointer' : 'default', fontWeight: 500, opacity: design ? 1 : .5 }}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>

      <DownloadDialog
        open={downloadOpen && !!design}
        onClose={() => setDownloadOpen(false)}
        design={design}
        surface={downloadSurface}
        currentId={currentId}
        editsCount={editsCountRef.current}
        hasAchievement={showAchievement}
      />
    </div>
  );
}
