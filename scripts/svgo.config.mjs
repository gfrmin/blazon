// SVGO config for vendored charges: optimize hard, but KEEP the viewBox (we
// scale charges into slots) and drop width/height. Strips editor metadata.
export default {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
    'removeDimensions',
  ],
};
