// A cancelable timeout race — whichever of `promise` or a `ms`-delay settles
// first wins. Unlike a bare `Promise.race([p, sleep(ms)])`, the timer is
// ALWAYS cleared once the race is decided (via `.finally`), so a promise that
// resolves first never leaves a dangling `setTimeout` that could fire later
// (e.g. after the caller has moved on to a different generation/attempt).
//
// Pulled out of Studio.jsx's generate() (review round 1, Finding 1) so the
// race itself — the part that actually has a bug surface (leaked timers,
// off-by-one on which value wins) — is testable in isolation, without
// dragging in React/component state.
//
// `timeoutValue` is returned verbatim if the timer fires first; pass a
// sentinel (e.g. a module-level Symbol) if `undefined`/`null` could also be a
// legitimate value from `promise` and the two need to stay distinguishable.
export function raceWithTimeout(promise, ms, timeoutValue) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timeoutValue), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
