import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Typewriter — the hero input's placeholder types out example sentences
// (type → hold → delete → next), so the empty field itself demonstrates
// what to write in it. Pure state machine + a thin hook, mirroring the
// hero.js pattern: the reducer is exported and unit-tested; the hook only
// schedules it.
// ─────────────────────────────────────────────────────────────────────────

export const TYPE_MS = 46;    // per character typed
export const DELETE_MS = 17;  // per character deleted (brisker than typing)
export const HOLD_MS = 2600;  // full sentence rests before deleting
export const GAP_MS = 550;    // empty field rests before the next sentence
export const START_MS = 700;  // initial beat before the first character

export const initialTypewriter = { phrase: 0, len: 0, mode: 'typing' };

/**
 * One tick of the typewriter. Returns the next state and how long to wait
 * before the tick after it. Total function — any phrase index is wrapped, so
 * a shrunk phrase list can't strand the state out of range.
 */
export function stepTypewriter(state, phrases) {
  const text = phrases[state.phrase % phrases.length] || '';
  if (state.mode === 'typing') {
    if (state.len < text.length) return { state: { ...state, len: state.len + 1 }, delay: TYPE_MS };
    return { state: { ...state, mode: 'holding' }, delay: HOLD_MS };
  }
  if (state.mode === 'holding') return { state: { ...state, mode: 'deleting' }, delay: DELETE_MS };
  if (state.len > 0) return { state: { ...state, len: state.len - 1 }, delay: DELETE_MS };
  return { state: { phrase: (state.phrase + 1) % phrases.length, len: 0, mode: 'typing' }, delay: GAP_MS };
}

/** The visible slice of the current phrase. */
export const typewriterText = (state, phrases) =>
  (phrases[state.phrase % phrases.length] || '').slice(0, state.len);

/**
 * Animated placeholder text. While `enabled`, self-schedules through the
 * reducer above; when disabled (reduced motion, focus, or text in the field)
 * it returns '' and the caller shows its static fallback. Restarts from the
 * first phrase on re-enable — cheaper than persisting mid-word state, and
 * the restart is invisible (the field was covered or ignored meanwhile).
 */
export function useTypewriter(phrases, enabled) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!enabled || !phrases.length) { setText(''); return undefined; }
    let state = initialTypewriter;
    let id;
    const tick = () => {
      const step = stepTypewriter(state, phrases);
      state = step.state;
      setText(typewriterText(state, phrases));
      id = setTimeout(tick, step.delay);
    };
    id = setTimeout(tick, START_MS);
    return () => clearTimeout(id);
  }, [enabled, phrases]);
  return enabled ? text : '';
}
