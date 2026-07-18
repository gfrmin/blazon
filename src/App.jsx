import React from 'react';
import Landing from './Landing.jsx';
import Studio from './Studio.jsx';
import ShareView from './ShareView.jsx';
import Library from './Library.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useRoute, navigate } from './router.js';

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

function Router() {
  const { path } = useRoute();

  if (path === '/studio') {
    return <Studio onBack={() => navigate('/')} />;
  }

  if (path.startsWith('/a/')) {
    // The recipient presentation view (Task 18 §1) — a landing page for the
    // NEXT user, not a forward into the editor. Bad payload → decodeCoat
    // throws inside ShareView → navigate('/', {replace:true}), same safety
    // net the router has had since M0/Task 4.
    return <ShareView payload={path.slice(3)} />;
  }

  if (path === '/library') {
    return <Library onOpenStudio={openStudio} onBack={() => navigate('/')} />;
  }

  // '/' and any unknown path → Landing. No 404 handling by design (brief).
  return <Landing onOpenStudio={openStudio} />;
}

// I1 (final whole-branch review): wrap the route render in a top-level error
// boundary — see ErrorBoundary.jsx's own header for the crash this closes
// (and the null-safety fix that closes the specific known trigger).
export default function App() {
  return (
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  );
}
