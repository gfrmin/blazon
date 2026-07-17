import React, { useState, useEffect } from 'react';
import LibraryCard from './components/LibraryCard.jsx';
import SharePopover from './components/SharePopover.jsx';
import DownloadDialog from './components/DownloadDialog.jsx';
import { HoverBtn } from './ui.jsx';
import { GildedRule } from './components/Ornament.jsx';
import { C, F, goldBtn, goldBtnHover, pageWash, eyebrow } from './theme.js';
import { useMediaQuery } from './useMediaQuery.js';
import { navigate } from './router.js';
import { listDesigns, deleteDesign } from './library.js';
import { encodeCoat } from './share/codec.js';
import { hasAchievement } from './heraldry.js';

const LOGO = (
  <svg width="26" height="30" viewBox="0 0 30 34">
    <path d="M2,3 H28 V18 C28,26 22,31 15,33 C8,31 2,26 2,18 Z" fill="#16273E" stroke="#C9A24B" strokeWidth="1.6" />
    <path d="M2,3 H9 L28,28 V33 H21 L2,8 Z" fill="#C9A24B" opacity="0.9" />
  </svg>
);

const actionBtn = { background: 'none', border: 'none', color: C.parchInk2, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', fontFamily: F.sans, padding: 0 };

// A quiet delete with a confirm step (brief: "Delete (quiet, with a
// confirm)") — no modal, just a two-click affordance that reverts itself
// after a few seconds so an accidental first click can't linger into a
// much-later accidental second one.
function DeleteAction({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return undefined;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  if (confirming) {
    return <button onClick={() => { setConfirming(false); onConfirm(); }} style={{ ...actionBtn, color: '#B2453A' }}>Confirm delete?</button>;
  }
  return <button onClick={() => setConfirming(true)} style={actionBtn}>Delete</button>;
}

function EmptyState({ onOpenStudio }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px 40px', maxWidth: 420, margin: '0 auto' }}>
      <p style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 21, color: C.muted, lineHeight: 1.55, margin: '0 0 26px' }}>
        No arms in your library yet. Describe someone, and we&rsquo;ll make the first.
      </p>
      <HoverBtn onClick={() => onOpenStudio('library_empty')} style={{ ...goldBtn, padding: '14px 28px', fontSize: 15 }} hoverStyle={goldBtnHover}>Describe someone →</HoverBtn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// /library — the saved-designs grid (Task 18 §3). listDesigns() (src/
// library.js, Task 16) is the sole data source; this component's only job is
// to render it and wire the four per-card operations (Open/Share/Download/
// Delete) plus the empty state. `entries` is local React state, re-read from
// storage after any write (Delete) — listDesigns() itself is cheap/pure, no
// need for anything fancier at MVP library sizes.
// ─────────────────────────────────────────────────────────────────────────
export default function Library({ onOpenStudio, onBack }) {
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [entries, setEntries] = useState(() => listDesigns());
  const [downloadEntry, setDownloadEntry] = useState(null); // the LibraryEntry currently open in DownloadDialog, or null

  const refresh = () => setEntries(listDesigns());

  // Reuses the SAME hash-restore path a reload/bookmark already exercises —
  // Studio's mount effect decodes the hash and, per §2b, reconnects
  // `currentId` to this very entry, so an edit-then-Save overwrites it
  // instead of forking a duplicate.
  const openEntry = async (entry) => {
    const payload = await encodeCoat(entry.envelope.coat);
    navigate('/studio#' + payload);
  };

  const handleDelete = (id) => {
    deleteDesign(localStorage, id);
    refresh();
  };

  const PAD = isMobile ? 20 : 36;

  return (
    <div style={{ minHeight: '100vh', backgroundImage: pageWash, backgroundAttachment: 'fixed' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(16px)', background: 'rgba(9,12,19,.92)', borderBottom: '1px solid rgba(201,162,75,.18)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `16px ${PAD}px` }}>
          {/* A real <button> (task-21 a11y sweep) — see Studio.jsx's header
              logo for the same fix (this was a bare onClick div). */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Blazon home"
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit' }}
          >
            {LOGO}
            <span style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 22, letterSpacing: '.4px', color: C.cream }}>Blazon</span>
          </button>
          <HoverBtn onClick={() => onOpenStudio('library_nav')} style={{ ...goldBtn, padding: '10px 18px', fontSize: 14 }} hoverStyle={goldBtnHover}>Open the Studio</HoverBtn>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: `48px ${PAD}px 70px` }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={eyebrow}>Every coat of arms you&rsquo;ve made</div>
          <h1 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: isMobile ? 32 : 44, margin: '14px 0 0', letterSpacing: '-.3px' }}>Your armoury.</h1>
        </div>

        <GildedRule maxWidth={340} />

        {entries.length === 0 ? (
          <EmptyState onOpenStudio={onOpenStudio} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 26, marginTop: 44 }}>
            {entries.map((entry) => (
              <LibraryCard
                key={entry.id}
                design={entry.envelope.coat}
                title={entry.name}
                unlocked={!!entry.unlocked}
                thumbWidth={132}
                actions={
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => openEntry(entry)} style={actionBtn}>Open</button>
                    <SharePopover
                      design={entry.envelope.coat}
                      surface="library"
                      trigger={(toggle) => <button onClick={toggle} style={actionBtn}>Share</button>}
                    />
                    <button onClick={() => setDownloadEntry(entry)} style={actionBtn}>Download</button>
                    <DeleteAction onConfirm={() => handleDelete(entry.id)} />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <DownloadDialog
        open={!!downloadEntry}
        onClose={() => setDownloadEntry(null)}
        design={downloadEntry?.envelope.coat}
        surface="library"
        currentId={downloadEntry?.id}
        hasAchievement={downloadEntry ? hasAchievement(downloadEntry.envelope.coat) : false}
      />
    </div>
  );
}
