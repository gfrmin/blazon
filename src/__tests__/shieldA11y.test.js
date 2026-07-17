import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importJSXBundle } from './helpers/bundleJSX.mjs';

// Task-21 review round 1: `role="img"` on the root <svg> collapses its
// ENTIRE subtree into one leaf per WAI-ARIA — correct for a static shield,
// but it was being applied to the `interactive` hero shield too (Landing's
// driving-mode escutcheon), silently hiding the three role="button" zones
// from assistive tech even though they stayed keyboard-focusable (which is
// why a DOM/Playwright-level drive didn't catch it). `rootA11y` is the
// extracted, pure decision function; this file locks its contract, then
// confirms the REAL rendered markup (via SSR) actually reflects it.
const shieldMod = await importJSXBundle(new URL('../Shield.jsx', import.meta.url).pathname);
const Shield = shieldMod.default;
const { rootA11y } = shieldMod;

const { default: React } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { PRESETS } = await import('../heraldry.js');

const design = PRESETS[0].design;

// ── rootA11y: the pure decision table ──────────────────────────────────────

test('rootA11y: static (non-interactive, not ariaHidden) -> role="img" — a single labelled leaf is correct for a static image', () => {
  assert.deepEqual(rootA11y(false, false), { role: 'img', labelSuffix: '' });
});

test('rootA11y: interactive (not ariaHidden) -> role="group", NOT "img" — must not collapse the button zones beneath it', () => {
  const result = rootA11y(true, false);
  assert.equal(result.role, 'group');
  assert.notEqual(result.role, 'img');
});

test('rootA11y: ariaHidden wins regardless of interactive — no role either way (Achievement\'s inner escutcheon)', () => {
  assert.deepEqual(rootA11y(false, true), { role: undefined, labelSuffix: '' });
  assert.deepEqual(rootA11y(true, true), { role: undefined, labelSuffix: '' });
});

// ── Rendered markup: prove the real component reflects the decision ───────

test('Shield SSR: non-interactive renders role="img" on the root <svg>, no role="button" zones', () => {
  const markup = renderToStaticMarkup(React.createElement(Shield, { design }));
  assert.match(markup, /<svg[^>]*\brole="img"/);
  assert.doesNotMatch(markup, /role="button"/);
});

test('Shield SSR: interactive renders role="group" on the root <svg> (not "img"), with all three zones exposed as named role="button" nodes', () => {
  const markup = renderToStaticMarkup(React.createElement(Shield, { design, interactive: true }));
  assert.match(markup, /<svg[^>]*\brole="group"/);
  assert.doesNotMatch(markup, /<svg[^>]*\brole="img"/);
  const buttonCount = (markup.match(/role="button"/g) || []).length;
  assert.equal(buttonCount, 3, 'expected exactly the field/ordinary/charge zones as role="button"');
  assert.match(markup, /aria-label="Change the field colour"/);
  assert.match(markup, /aria-label="Change the structure"/);
  assert.match(markup, /aria-label="Change the symbol"/);
});

test('Shield SSR: ariaHidden renders no role at all, regardless of interactive', () => {
  const markup = renderToStaticMarkup(React.createElement(Shield, { design, ariaHidden: true }));
  assert.doesNotMatch(markup, /<svg[^>]*\brole=/);
  assert.match(markup, /aria-hidden="true"/);
});
