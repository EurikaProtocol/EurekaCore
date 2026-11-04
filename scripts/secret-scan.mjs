// Blocks commits that contain env files, key files or secret-looking content. Prints names/locations only, never values.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BLOCKED_PATH = [/(^|\/)\.env(\..*)?$/i, /\.(pem|key|p12|pfx|keystore)$/i, /(^|\/)id_(rsa|ed25519|ecdsa)$/, /(^|\/)\.dev\.vars$/, /(^|\/)\.vercel\//, /(^|\/)\.wrangler\//];
const ALLOWED_PATH = [/(^|\/)\.env\.example$/];
const CONTENT = [
  ['private key block', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['API key (sk-)', /\bsk-[A-Za-z0-9_-]{32,}\b/],
  ['Vercel/Cloudflare token assignment', /\b(?:VERCEL_TOKEN|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|API_KEY|SECRET|PASSWORD)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{24,}/],
  ['mnemonic/seed phrase assignment', /\b(?:mnemonic|seed[_ ]?phrase)\s*[:=]\s*['"][a-z]+(?: [a-z]+){10,}/i],
];

export function scanPaths(paths) {
  return paths.filter((p) => BLOCKED_PATH.some((r) => r.test(p)) && !ALLOWED_PATH.some((r) => r.test(p))).map((p) => ({ file: p, reason: 'forbidden file type' }));
}

/** @param {string} diff unified diff; only added lines are inspected */
export function scanDiff(diff) {
  const findings = [];
  let file = '?';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      for (const [reason, re] of CONTENT) if (re.test(line)) findings.push({ file, reason });
    }
  }
  return findings;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function scanStaged() {
  const paths = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);
  return [...scanPaths(paths), ...scanDiff(git('diff', '--cached', '--unified=0', '--no-color'))];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = scanStaged();
  if (findings.length) {
    for (const f of findings) console.error(`BLOCKED: ${f.file}: ${f.reason}`);
    process.exit(1);
  }
  console.log('Secret scan: no findings in staged changes.');
}
