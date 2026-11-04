// Saves finished work to GitHub: working branch only, secret scan, quality gate, commit, push, report.
//   npm run save -- "feat: short message"        (message optional; derived from the changed files otherwise)
//   npm run save -- --skip-checks "docs: ..."    (documentation-only changes; the report then says checks were SKIPPED)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { scanStaged } from './secret-scan.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const skipChecks = args.includes('--skip-checks');
let message = args.filter((a) => !a.startsWith('--')).join(' ').trim();

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (!/^eureka\/[A-Za-z0-9._\/-]+$/.test(branch)) {
  console.error(`Refusing to save from "${branch}". Work on an eureka/* branch (e.g. git switch -c eureka/my-change); main is never written automatically.`);
  process.exit(2);
}

git('add', '-A');
const changed = git('diff', '--cached', '--name-status').split('\n').filter(Boolean);
if (!changed.length) { console.log('Nothing to save.'); process.exit(0); }

const findings = scanStaged();
if (findings.length) {
  git('reset', '-q');
  for (const f of findings) console.error(`BLOCKED: ${f.file}: ${f.reason}`);
  console.error('Nothing was committed. Remove the secret, or add the file to .gitignore, then retry.');
  process.exit(3);
}

const checks = [];
const run = (name, cmd, cmdArgs) => {
  console.log(`\n> ${name}`);
  const ok = spawnSync(cmd, cmdArgs, { stdio: 'inherit' }).status === 0;
  checks.push({ name, ok });
  return ok;
};
if (!skipChecks) {
  // `verify` already covers build + routing + unit tests + wrangler dry-run, so `npm test` is not repeated.
  const ok = run('npm run verify', 'npm', ['run', 'verify']) && run('dependency audit', 'node', ['scripts/audit-check.mjs']);
  if (!ok) {
    git('reset', '-q');
    console.error('\nChecks failed: changes are NOT committed and must not be reported as ready.');
    writeReport({ branch, sha: null, status: 'checks-failed' });
    process.exit(4);
  }
}

if (!message) {
  const top = [...new Set(changed.map((l) => l.split('\t').pop().split('/')[0]))].slice(0, 3).join(', ');
  message = `chore: update ${top} (${changed.length} file${changed.length > 1 ? 's' : ''})`;
}
git('commit', '-q', '-m', `${message}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`);
const sha = git('rev-parse', 'HEAD');
const pushed = spawnSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' }).status === 0;
const status = pushed ? (skipChecks ? 'pushed-checks-skipped' : 'pushed-verified') : 'committed-push-failed';
writeReport({ branch, sha, status });
console.log(`\n${status}: ${branch} @ ${sha}\nPreview: opens automatically via the "Preview" workflow; see docs/AUTO_SAVE_PREVIEW.md`);
process.exit(pushed ? 0 : 5);

function writeReport(r) {
  mkdirSync('.agent-reports', { recursive: true });
  writeFileSync('.agent-reports/last-save.json', JSON.stringify({ ...r, checks, skippedChecks: skipChecks, at: new Date().toISOString() }, null, 2));
}
