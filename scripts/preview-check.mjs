// Verifies a deployed Preview URL really serves the expected commit and the app responds.
//   node scripts/preview-check.mjs <url> <expectedSha>
// Optional env VERCEL_AUTOMATION_BYPASS_SECRET is sent as x-vercel-protection-bypass (Vercel Deployment Protection).
const [url, sha] = process.argv.slice(2);
if (!/^https:\/\/[^/\s]+\/?$/.test(url ?? '') || !/^[0-9a-f]{40}$/.test(sha ?? '')) {
  console.error('usage: preview-check.mjs https://<preview-host> <40-char sha>');
  process.exit(2);
}
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
const base = url.replace(/\/$/, '');
const get = async (p) => { const r = await fetch(base + p, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) }); return { r, text: await r.text() }; };

let failed = false;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); if (!ok) failed = true; };

for (let i = 0; i < 6; i += 1) {
  try { const { r } = await get('/'); if (r.ok) break; } catch { /* retry while the deployment propagates */ }
  await new Promise((res) => setTimeout(res, 5000));
}
const home = await get('/').catch((e) => ({ r: { status: 0 }, text: String(e) }));
check('home page responds 200', home.r.status === 200, `HTTP ${home.r.status}`);
check('home page serves the app shell', /<div id="root"|<script[^>]+type="module"/.test(home.text));
const info = await get('/build-info.json').then((x) => JSON.parse(x.text)).catch(() => null);
check('build-info.json matches the pushed commit', info?.sha === sha, `served=${info?.sha ?? 'none'} expected=${sha}`);
check('deployment is a preview, not production', info?.target === 'preview', `target=${info?.target ?? 'none'}`);
process.exit(failed ? 1 : 0);
