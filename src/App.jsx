import React, { useEffect, useState } from 'react';
import Landing from './Landing.jsx';
import Studio from './Studio.jsx';
import { useRoute, navigate } from './router.js';
import { decodeCoat } from './share/codec.js';
import { setSuperProps } from './analytics.js';

// Source handoff for the `studio_opened` event (task-7 brief §2). Landing's
// several CTAs each know which surface opened the Studio; a bare navigate()
// carries no payload, so we stash it one hop ahead in sessionStorage and
// Studio's mount effect reads + clears it. Query-free per the brief ("a
// module-level setter or sessionStorage handoff is fine"). Key must match
// the read in Studio.jsx.
const STUDIO_SOURCE_KEY = 'blazon:studio_source';

function openStudio(source) {
  try { sessionStorage.setItem(STUDIO_SOURCE_KEY, source); } catch { /* storage unavailable — Studio defaults to 'direct' */ }
  navigate('/studio');
}

export default function App() {
  const { path } = useRoute();

  if (path === '/studio') {
    return <Studio onBack={() => navigate('/')} />;
  }

  if (path.startsWith('/a/')) {
    return <ShareArrival payload={path.slice(3)} />;
  }

  // TODO(M3): /library view
  if (path === '/library') {
    return <Landing onOpenStudio={openStudio} />;
  }

  // '/' and any unknown path → Landing. No 404 handling by design (brief).
  return <Landing onOpenStudio={openStudio} />;
}

// Decodes a /a/<payload> share link and hands off into Studio pre-loaded
// with the shared design, then swaps the URL to /studio#<payload> so the
// link behaves like a normal (restorable) studio session going forward.
// TODO(/a/ presentation view — task M3): this should become a dedicated
// read-only presentation route instead of forwarding into Studio.
function ShareArrival({ payload }) {
  const [coat, setCoat] = useState(null);

  useEffect(() => {
    let cancelled = false;
    decodeCoat(payload)
      .then((decoded) => {
        if (cancelled) return;
        setCoat(decoded);
        // Analytics super-prop (task-7 brief §1): booting from a /a/ share link.
        // Set both the persisted flag (read by _computeInitialSuperProps on a
        // future load) AND the live super-prop directly (review round 1,
        // Finding 2) — this component client-side-navigates into Studio with
        // no reload, so analytics.js's module-eval snapshot of sessionStorage
        // is already stale by the time this runs; without the direct call
        // here, arrived_via_share stays false for the entire session it's
        // meant to describe.
        try { sessionStorage.setItem('blazon:arrived_via_share', '1'); } catch { /* storage unavailable */ }
        setSuperProps({ arrived_via_share: true });
        navigate('/studio#' + payload, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate('/', { replace: true });
      });
    return () => { cancelled = true; };
  }, [payload]);

  // Decoding is synchronous-fast (no network); render nothing during the
  // brief window before the redirect above lands.
  if (!coat) return null;
  return <Studio initialDesign={coat} arrivedViaShare onBack={() => navigate('/')} />;
}
