import React, { useState } from 'react';
import Landing from './Landing.jsx';
import Studio from './Studio.jsx';

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'studio'

  return view === 'landing'
    ? <Landing onOpenStudio={() => setView('studio')} />
    : <Studio onBack={() => setView('landing')} />;
}
