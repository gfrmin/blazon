import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialTypewriter, stepTypewriter, typewriterText,
  TYPE_MS, DELETE_MS, HOLD_MS, GAP_MS,
} from '../useTypewriter.js';

const PHRASES = ['Ab.', 'Cd.'];

/** Run the machine n ticks, collecting the visible text after each. */
function run(n, phrases = PHRASES) {
  let state = initialTypewriter;
  const frames = [];
  for (let i = 0; i < n; i += 1) {
    const step = stepTypewriter(state, phrases);
    state = step.state;
    frames.push({ text: typewriterText(state, phrases), delay: step.delay, state });
  }
  return frames;
}

test('types the first phrase character by character', () => {
  const frames = run(3);
  assert.deepEqual(frames.map((f) => f.text), ['A', 'Ab', 'Ab.']);
  assert.ok(frames.every((f) => f.delay === TYPE_MS));
});

test('holds the full sentence, then deletes faster than it typed', () => {
  const frames = run(8);
  // 3 typing + hold + enter-deleting + 3 deletions land on empty
  assert.equal(frames[3].delay, HOLD_MS);
  assert.equal(frames[3].state.mode, 'holding');
  const deletions = frames.slice(4, 8);
  assert.deepEqual(deletions.map((f) => f.text), ['Ab.', 'Ab', 'A', '']);
  assert.ok(deletions.every((f) => f.delay === DELETE_MS));
  assert.ok(DELETE_MS < TYPE_MS);
});

test('advances to the next phrase after the gap, wrapping at the end', () => {
  const frames = run(9);
  const rollover = frames[8];
  assert.equal(rollover.delay, GAP_MS);
  assert.equal(rollover.state.phrase, 1);
  assert.equal(rollover.state.mode, 'typing');
  // A full second cycle wraps back to phrase 0.
  const more = run(18);
  assert.equal(more[17].state.phrase, 0);
});

test('is total: out-of-range phrase index and empty phrases cannot throw', () => {
  const state = { phrase: 7, len: 1, mode: 'typing' };
  assert.equal(typewriterText(state, PHRASES), 'C'); // 7 % 2 = 1
  const step = stepTypewriter(state, PHRASES);
  assert.equal(step.state.len, 2);
  assert.doesNotThrow(() => stepTypewriter(initialTypewriter, ['']));
});
