import { mkdtempSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Bundles a TypeScript source entry (extensionless imports, Vite env) so Node can load it. Packages stay external. */
export async function loadSource(entry) {
  const outfile = join((mkdirSync(join(root, 'node_modules/.cache'), { recursive: true }), mkdtempSync(join(root, 'node_modules/.cache/eureka-'))), 'entry.mjs');
  buildSync({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}
