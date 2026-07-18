import React from 'react';
import { navigate } from './router.js';
import { C, F } from './theme.js';

// ─────────────────────────────────────────────────────────────────────────
// Top-level error containment (I1, final whole-branch review). With no
// boundary above the route render, a throw deep in the tree — e.g.
// blazon()/humanize() on a charge/crest/supporter `object` missing its `key`
// (model/charges.js, the OTHER half of this same finding — a null-safety
// fix there closes the specific known crash) — unmounts the WHOLE app to a
// blank white screen. Reachable via an unvalidated /api/generate response
// (a max_tokens-truncated tool call passes generate.js's field-only shape
// check) or a hand-crafted `/a/`|`#` share payload. React error boundaries
// can only be class components (getDerivedStateFromError/componentDidCatch
// have no hook equivalent) — this is the one class component in the app,
// for exactly that reason.
//
// The fallback never surfaces the error/stack trace to the user (herald
// voice, no debugging leakage) — componentDidCatch logs to the console only,
// for whoever's watching devtools; nothing is sent anywhere.
// ─────────────────────────────────────────────────────────────────────────
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Blazon: caught a render error', error, info);
  }

  handleReturn = () => {
    this.setState({ hasError: false });
    navigate('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
          textAlign: 'center', background: C.bg, color: C.cream,
        }}
      >
        <h1 style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 28, margin: '0 0 12px' }}>
          The arms wouldn&rsquo;t come together.
        </h1>
        <p style={{ fontFamily: F.sans, fontSize: 14.5, color: C.muted, maxWidth: 420, lineHeight: 1.6, margin: '0 0 26px' }}>
          Something about this design confused the herald. Nothing was lost — head back and start fresh.
        </p>
        <button
          onClick={this.handleReturn}
          style={{
            background: C.gold, color: C.goldInk, border: 'none', borderRadius: 9,
            padding: '12px 26px', fontFamily: F.sans, fontWeight: 600, fontSize: 14.5, cursor: 'pointer',
          }}
        >
          Return to Blazon
        </button>
      </div>
    );
  }
}
