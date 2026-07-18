import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { importJSXBundle } from './helpers/bundleJSX.mjs';

// I1 (final whole-branch review): a top-level error boundary around the
// route render — a malformed design (unvalidated /api/generate output, or a
// crafted /a/|# payload) can throw deep inside <Studio>/<ShareView>'s render;
// with no boundary, React unmounts the WHOLE tree to a blank screen.
//
// React's error-boundary lifecycle (getDerivedStateFromError/componentDidCatch)
// is only honoured by the CLIENT reconciler and the NEW streaming server
// renderer — NOT by `renderToStaticMarkup`/`renderToString` (react-dom's
// "legacy" synchronous server renderer, which is what this project's test
// harness uses everywhere else): a throw during SSR there just propagates
// straight out, confirmed directly (a `renderToStaticMarkup` around a
// throwing child rejects the SAME as if there were no boundary at all).
// jsdom (the usual way to exercise the real client reconciler) isn't a
// project dependency and adding one is out of scope for this fix.
//
// So — per the brief's own fallback plan ("if cheaply testable without
// jsdom") — this instead unit-tests ErrorBoundary's OWN state-transition
// logic directly (no React reconciler involved at all): the static
// `getDerivedStateFromError` is a pure function, and `render()` is a pure
// function of `this.state`/`this.props` — both callable directly on a class
// instance. This is a standard way to test a React class component's logic
// without a renderer. Live confirmation (a malformed `#payload` in the real
// browser, fallback UI not a blank screen) is documented in the task report.
const { default: ErrorBoundary } = await importJSXBundle(new URL('../ErrorBoundary.jsx', import.meta.url).pathname);

test('ErrorBoundary.getDerivedStateFromError: any thrown error flips state to hasError:true (pure, no instance needed)', () => {
  assert.deepEqual(ErrorBoundary.getDerivedStateFromError(new Error('boom')), { hasError: true });
  assert.deepEqual(ErrorBoundary.getDerivedStateFromError(new TypeError("Cannot read properties of undefined (reading 'replace')")), { hasError: true });
});

test('ErrorBoundary.render(): with hasError:false, renders children UNCHANGED (the normal, non-error path)', () => {
  const instance = new ErrorBoundary({ children: React.createElement('div', null, 'the real app') });
  instance.state = { hasError: false };
  const out = instance.render();
  const markup = renderToStaticMarkup(out);
  assert.match(markup, />the real app</);
});

test('ErrorBoundary.render(): with hasError:true, renders the fallback UI — herald voice, a way back to "/", NO stack trace or raw error text', () => {
  const instance = new ErrorBoundary({ children: React.createElement('div', null, 'the real app — must NOT appear') });
  instance.state = { hasError: true };
  const out = instance.render();
  const markup = renderToStaticMarkup(out);

  assert.doesNotMatch(markup, /the real app/); // children are NOT rendered once tripped
  assert.match(markup, /Return to Blazon/); // the way back
  // No stack trace / raw JS error text ever surfaced to the user.
  assert.doesNotMatch(markup, /TypeError/);
  assert.doesNotMatch(markup, /at Object\.|at Module\.|\.jsx:\d/); // stack-trace-shaped text
});

test('componentDidCatch: logs to the console only (no throw, no side effect visible to the user) — belt to the null-safety braces, never a substitute for it', () => {
  const instance = new ErrorBoundary({ children: null });
  const originalError = console.error;
  let logged = null;
  console.error = (...args) => { logged = args; };
  try {
    assert.doesNotThrow(() => instance.componentDidCatch(new Error('boom'), { componentStack: 'x' }));
  } finally {
    console.error = originalError;
  }
  assert.ok(logged, 'expected componentDidCatch to log via console.error');
});
