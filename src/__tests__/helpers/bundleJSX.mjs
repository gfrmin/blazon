// ─────────────────────────────────────────────────────────────────────────
// Test-only helper: import a .jsx component (and its whole import graph —
// achievement-art, charges, model/…) under plain `node --test`, which has no
// JSX transform and no Vite `?raw` asset loader of its own.
//
// Uses `esbuild` — already an installed transitive dependency of `vite`
// (devDependency), not a new one — to bundle the entry point into a single
// plain-JS ESM file (jsx: 'automatic', `react`/`react-dom` kept external so
// the REAL installed react/react-dom are used, matching runtime behaviour),
// with a small plugin that resolves Vite's `?raw` suffix the same way Vite's
// own `?raw` import does (the raw file text as the module's default export —
// this is exactly what achievement-art's vendored-furniture imports need).
// The bundle is written to a throwaway file under node_modules/ (gitignored)
// so Node's own module resolution can still find `react` etc., then imported
// and deleted. Only test code should ever import this file.
// ─────────────────────────────────────────────────────────────────────────

import * as esbuild from 'esbuild';
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');
const TMP_DIR = path.join(PROJECT_ROOT, 'node_modules', '.tmp-ssr-bundle');

const REACT_EXTERNALS = ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

const rawSuffixPlugin = {
  name: 'vite-raw-suffix',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => {
      const clean = args.path.replace(/\?raw$/, '');
      const base = args.resolveDir.endsWith('/') ? args.resolveDir : `${args.resolveDir}/`;
      const resolved = new URL(clean, pathToFileURL(base)).pathname;
      return { path: resolved, namespace: 'raw-ns' };
    });
    build.onLoad({ filter: /.*/, namespace: 'raw-ns' }, async (args) => {
      const text = await readFile(args.path, 'utf8');
      return { contents: `export default ${JSON.stringify(text)};`, loader: 'js' };
    });
  },
};

/**
 * Bundle `entryAbsPath` (a .jsx file) and its import graph, then dynamically
 * import the result. Returns the module namespace (e.g. `{ default: Achievement }`).
 * @param {string} entryAbsPath  Absolute path to the JSX entry point.
 */
export async function importJSXBundle(entryAbsPath) {
  const result = await esbuild.build({
    entryPoints: [entryAbsPath],
    bundle: true,
    format: 'esm',
    jsx: 'automatic',
    platform: 'node',
    write: false,
    external: REACT_EXTERNALS,
    plugins: [rawSuffixPlugin],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;

  await mkdir(TMP_DIR, { recursive: true });
  const tmpFile = path.join(TMP_DIR, `${path.basename(entryAbsPath, path.extname(entryAbsPath))}-${randomBytes(6).toString('hex')}.mjs`);
  await writeFile(tmpFile, code, 'utf8');
  try {
    return await import(pathToFileURL(tmpFile).href);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
