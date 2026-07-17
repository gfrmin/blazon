import React, { useEffect, useState } from 'react';
import Landing from './Landing.jsx';
import Studio from './Studio.jsx';
import { useRoute, navigate } from './router.js';
import { decodeCoat } from './share/codec.js';

export default function App() {
  const { path } = useRoute();

  if (path === '/studio') {
    return <Studio onBack={() => navigate('/')} />;
  }

  if (path.startsWith('/a/')) {
    return <ShareArrival payload={path.slice(3)} />;
  }

  // TODO(/a/ presentation view — task M3): /library is a placeholder that
  // reuses Landing until the dedicated gallery view lands.
  if (path === '/library') {
    return <Landing onOpenStudio={() => navigate('/studio')} />;
  }

  // '/' and any unknown path → Landing. No 404 handling by design (brief).
  return <Landing onOpenStudio={() => navigate('/studio')} />;
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
