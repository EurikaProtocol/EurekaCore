// Standalone sandbox runner service (run on an isolated host, NOT inside the Worker).
// Usage: SANDBOX_TOKEN=... PORT=8788 node scripts/sandbox-service.mjs
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { buildSync } from 'esbuild';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const token = process.env.SANDBOX_TOKEN;
if (!token || token.length < 24) throw new Error('SANDBOX_TOKEN (>= 24 chars) is required.');
const root = fileURLToPath(new URL('../', import.meta.url));
const outfile = join(mkdtempSync(join(tmpdir(), 'eureka-svc-')), 'runner.mjs');
buildSync({ entryPoints: [join(root, 'src/sandbox/docker-runner.ts')], outfile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { DockerSandboxRunner } = await import(pathToFileURL(outfile).href);
const runner = new DockerSandboxRunner();

const ok = (h) => { const a = Buffer.from(String(h ?? '')), b = Buffer.from(`Bearer ${token}`); return a.length === b.length && timingSafeEqual(a, b); };
let busy = 0;
createServer(async (req, res) => {
  const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method !== 'POST' || req.url !== '/run') return send(404, { error: 'not found' });
  if (!ok(req.headers.authorization)) return send(401, { error: 'unauthorized' });
  if (busy >= 2) return send(429, { error: 'busy' });
  let body = '';
  for await (const c of req) { body += c; if (body.length > 2_000_000) return send(413, { error: 'too large' }); }
  busy++;
  try { send(200, await runner.run(JSON.parse(body))); } catch (e) { send(400, { error: String(e.message).slice(0, 200) }); } finally { busy--; }
}).listen(Number(process.env.PORT ?? 8788), '127.0.0.1');
