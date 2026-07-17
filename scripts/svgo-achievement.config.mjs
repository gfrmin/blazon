// SVGO config for vendored achievement furniture (helmets, torse, mantling,
// motto scrolls, compartments) — scripts/vendor-components.mjs.
//
// Identical to scripts/svgo.config.mjs (optimize hard, keep viewBox, drop
// width/height) EXCEPT it also disables `cleanupIds`. DO NOT change
// scripts/svgo.config.mjs to match — that config must keep stripping ids for
// the 2,108 charges it serves.
//
// Why: DrawShield's PHP renderer recolours mantling/torse by matching element
// ids (e.g. "dexter1-1", "tincture2-3"), and every motto scroll carries
// id="textPath" for text-on-a-path lettering. The shared charges config's
// default `cleanupIds` (part of preset-default) silently strips every id —
// verified empirically: running the shared config over torse.svg leaves zero
// ids behind. That's invisible in a visual diff (the art still looks right)
// but destroys exactly what Task 12 (achievement composition) needs to
// recolour mantling/torse and letter a motto. Hence this separate config.
export default {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeViewBox: false, cleanupIds: false } } },
    'removeDimensions',
  ],
};
