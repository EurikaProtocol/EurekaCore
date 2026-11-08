import {
  MAX_BUILDER_ATTEMPTS, MAX_PROJECT_NAME, BUILDER_TERMINAL,
  type BuilderAttemptView, type BuilderPlanView, type BuilderProjectView, type BuilderUiStatus, type FileCheckView, type HistoryEntryView,
  type IntegrationState, type IntegrationStatusView, type ManifestFileView, type ValidationReportView,
} from '../core/builder-project';
import {
  BUILDER_CONTRACT_VERSION, MAX_BUILDER_REQUIREMENTS, BuilderError, byteLength, contentDigest, manifestDigest, planDigest,
  type BuilderTaskStatus, type BuilderTaskView, type ProjectBuilderProvider,
} from '../core/builder';
import { createZip } from '../core/zip';
import type { AuditLog } from '../core/audit';
import type { D1DatabaseLike } from './d1';
import { validateBuilderPaths } from './builder-executors';

/** Builder provider plus the optional authenticated reachability probe implemented by `TinanAiBuilderProvider`. */
export type BuilderClient = ProjectBuilderProvider & { probe?(signal?: AbortSignal): Promise<void> };

export class BuilderApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = 'BuilderApiError'; }
}

/** Persisted record. `ownerEmail` comes only from the verified Access identity and is never serialised to clients. */
export type BuilderProjectRecord = {
  id: string;
  ownerEmail: string;
  name: string;
  requirements: string;
  status: BuilderUiStatus;
  attempt: number;
  tinanTaskId: string | null;
  tinanProjectId: string | null;
  plan: BuilderPlanView | null;
  planDigest: string | null;
  approval: { approvedBy: string; at: string; digest: string; forwarded: boolean } | null;
  manifest: { planDigest: string; manifestDigest: string; totalBytes: number; files: ManifestFileView[] } | null;
  validation: ValidationReportView | null;
  errors: string[];
  attempts: BuilderAttemptView[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export interface BuilderProjectStore {
  get(id: string): Promise<BuilderProjectRecord | null>;
  list(ownerEmail: string): Promise<BuilderProjectRecord[]>;
  create(record: BuilderProjectRecord): Promise<boolean>;
  update(record: BuilderProjectRecord, expectedVersion: number): Promise<boolean>;
}

function changes(r: { meta?: { changes?: number } }): number {
  if (typeof r.meta?.changes !== 'number') throw new Error('D1 did not report the number of changed rows; refusing to continue.');
  return r.meta.changes;
}

export class D1BuilderProjectStore implements BuilderProjectStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(id: string) {
    const row = await this.db.prepare('SELECT record_json FROM builder_projects WHERE id = ?').bind(id).first<{ record_json: string }>();
    return row ? (JSON.parse(row.record_json) as BuilderProjectRecord) : null;
  }
  async list(ownerEmail: string) {
    const r = await this.db.prepare('SELECT record_json FROM builder_projects WHERE owner_email = ? ORDER BY updated_at DESC LIMIT 100').bind(ownerEmail).all<{ record_json: string }>();
    return (r.results ?? []).map((row) => JSON.parse(row.record_json) as BuilderProjectRecord);
  }
  async create(rec: BuilderProjectRecord) {
    return changes(await this.db.prepare('INSERT INTO builder_projects (id, owner_email, status, version, record_json, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(rec.id, rec.ownerEmail, rec.status, rec.version, JSON.stringify(rec), rec.updatedAt).run()) === 1;
  }
  async update(rec: BuilderProjectRecord, expectedVersion: number) {
    return changes(await this.db.prepare('UPDATE builder_projects SET status = ?, version = ?, record_json = ?, updated_at = ? WHERE id = ? AND owner_email = ? AND version = ?')
      .bind(rec.status, rec.version, JSON.stringify(rec), rec.updatedAt, rec.id, rec.ownerEmail, expectedVersion).run()) === 1;
  }
}

export class InMemoryBuilderProjectStore implements BuilderProjectStore {
  private readonly rows = new Map<string, BuilderProjectRecord>();
  async get(id: string) { const r = this.rows.get(id); return r ? structuredClone(r) : null; }
  async list(owner: string) { return [...this.rows.values()].filter((r) => r.ownerEmail === owner).map((r) => structuredClone(r)); }
  async create(rec: BuilderProjectRecord) { if (this.rows.has(rec.id)) return false; this.rows.set(rec.id, structuredClone(rec)); return true; }
  async update(rec: BuilderProjectRecord, v: number) { const cur = this.rows.get(rec.id); if (!cur || cur.version !== v || cur.ownerEmail !== rec.ownerEmail) return false; this.rows.set(rec.id, structuredClone(rec)); return true; }
}

const MAX_PROJECTS_PER_OWNER = 50;
const SYNC_TIMEOUT_MS = 25_000;
const FILE_CONCURRENCY = 4;
const DIGEST = /^0x[0-9a-f]{64}$/;
/** Problems that say nothing about the generated files: the task's state must not change because of them. */
const RETRIABLE = new Set(['NETWORK', 'UNAVAILABLE', 'RATE_LIMITED', 'HTTP', 'ABORTED', 'AUTH']);
const isRetriable = (e: unknown) => e instanceof BuilderError && RETRIABLE.has(e.code);

export const PROJECT_ID = /^bp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function integrationStateOf(e: unknown): IntegrationState {
  if (e instanceof BuilderError && e.code === 'AUTH') return 'authentication_failed';
  return 'unavailable';
}

const mapStatus = (s: BuilderTaskStatus): BuilderUiStatus => (s === 'committing' ? 'validating' : s);

export function toProjectView(r: BuilderProjectRecord): BuilderProjectView {
  return {
    id: r.id, name: r.name, status: r.status, requirements: r.requirements, attempt: r.attempt, maxAttempts: MAX_BUILDER_ATTEMPTS,
    plan: r.plan, planDigest: r.planDigest, approval: r.approval, manifest: r.manifest, validation: r.validation, buildValidation: 'not-run',
    errors: r.errors, attempts: r.attempts, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export type BuilderServiceDeps = {
  store: BuilderProjectStore;
  audit: AuditLog;
  /** Per-user client. In delegated mode it signs for that verified user; in single-owner mode all users share one TINAN AI owner. */
  builderFor: (email: string) => BuilderClient | undefined;
  authMode?: 'single-owner' | 'delegated';
  transport?: 'service-binding' | 'https';
  now?: () => Date;
  newId?: () => string;
};

export type VerifyInput = { projectId: string; manifest: { planDigest: string; manifestDigest: string; files: ManifestFileView[] }; approvedDigest: string | null; listed: string[]; contents: Map<string, string | null>; now: string };

/** Pure verification of retrieved bytes against the Builder manifest. Nothing here trusts the Builder's own claims. */
export function verifyGeneratedFiles(i: VerifyInput): ValidationReportView {
  const problems: string[] = [];
  const files: FileCheckView[] = i.manifest.files.map((f) => {
    const c = i.contents.get(f.path);
    if (typeof c !== 'string') { problems.push(`${f.path}: content could not be retrieved`); return { path: f.path, ok: false, expectedSha256: f.sha256, actualSha256: null, reason: 'content missing' }; }
    const actual = contentDigest(c);
    const ok = actual === f.sha256 && byteLength(c) === f.bytes && !c.includes('\0');
    if (!ok) problems.push(`${f.path}: SHA-256 or size does not match the manifest`);
    return { path: f.path, ok, expectedSha256: f.sha256, actualSha256: actual, reason: ok ? null : 'hash or size mismatch' };
  });
  const manifestPaths = i.manifest.files.map((f) => f.path).sort();
  const listed = [...i.listed].sort();
  const fileSetMatches = manifestPaths.length === listed.length && manifestPaths.every((p, n) => p === listed[n]);
  if (!fileSetMatches) problems.push('The project file list differs from the manifest');
  const planDigestMatchesApproval = i.approvedDigest !== null && i.manifest.planDigest === i.approvedDigest;
  if (!planDigestMatchesApproval) problems.push('The manifest plan digest differs from the plan a human approved');
  const actualEntries = i.manifest.files.map((f, n) => ({ path: f.path, bytes: files[n].actualSha256 ? byteLength(i.contents.get(f.path) as string) : -1, sha256: files[n].actualSha256 ?? '0x' }));
  const manifestDigestMatches = manifestDigest(i.manifest.planDigest, actualEntries) === i.manifest.manifestDigest;
  if (!manifestDigestMatches) problems.push('The manifest digest does not match the retrieved file bytes');
  return { checkedAt: i.now, passed: problems.length === 0, planDigestMatchesApproval, manifestDigestMatches, fileSetMatches, files, problems };
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const n = next++; out[n] = await fn(items[n]); }
  }));
  return out;
}

export class BuilderProjectService {
  private readonly now: () => Date;
  private readonly newId: () => string;
  constructor(private readonly d: BuilderServiceDeps) {
    this.now = d.now ?? (() => new Date());
    this.newId = d.newId ?? (() => `bp-${crypto.randomUUID()}`);
  }

  private iso() { return this.now().toISOString(); }
  private log(actor: string, action: string, projectId: string, detail: Record<string, string | number | boolean | null> = {}) {
    return this.d.audit.append({ at: this.iso(), actor, action, subject: `builder:${projectId}`, detail });
  }
  private client(email: string): BuilderClient {
    const c = this.d.builderFor(email);
    if (!c) throw new BuilderApiError(503, 'BUILDER_NOT_CONFIGURED', 'TINAN AI Builder is not enabled: set TINANAI_BUILDER_ENABLED=true with TINANAI_BASE_URL, TINANAI_USERNAME and TINANAI_PASSWORD (server-side secrets). Nothing is simulated.');
    return c;
  }

  /** Not-found for both missing and foreign records, so existence of another user's project is never revealed. */
  private async owned(email: string, id: string): Promise<BuilderProjectRecord> {
    const r = PROJECT_ID.test(id) ? await this.d.store.get(id) : null;
    if (!r || r.ownerEmail !== email) throw new BuilderApiError(404, 'NOT_FOUND', 'Project not found.');
    return r;
  }

  private async save(rec: BuilderProjectRecord): Promise<BuilderProjectRecord> {
    const expected = rec.version;
    const next = { ...rec, version: expected + 1, updatedAt: this.iso() };
    if (!(await this.d.store.update(next, expected))) throw new BuilderApiError(409, 'CONFLICT', 'The project was modified concurrently; reload and retry.');
    return next;
  }

  async status(email: string): Promise<IntegrationStatusView> {
    const base = { contractVersion: BUILDER_CONTRACT_VERSION, authMode: this.d.authMode ?? 'single-owner', transport: this.d.transport ?? 'https', checkedAt: this.iso() } as const;
    const c = this.d.builderFor(email);
    if (!c) return { ...base, state: 'not_configured', detail: 'TINANAI_BUILDER_ENABLED is not "true" or the TINANAI_* server secrets are missing.' };
    if (!c.probe) return { ...base, state: 'unavailable', detail: 'The configured Builder client cannot be probed; connectivity is unverified.' };
    try {
      await c.probe(AbortSignal.timeout(8000));
      return { ...base, state: 'connected', detail: 'TINAN AI accepted the server-to-server credentials. Contract v1.1 compatibility is verified per task when its manifest is retrieved.' };
    } catch (e) {
      return { ...base, state: integrationStateOf(e), detail: e instanceof BuilderError ? e.message : 'TINAN AI is unreachable.' };
    }
  }

  async list(email: string): Promise<BuilderProjectView[]> {
    return (await this.d.store.list(email)).map(toProjectView);
  }

  async create(email: string, input: { name: unknown; requirements: unknown }): Promise<BuilderProjectView> {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const requirements = typeof input.requirements === 'string' ? input.requirements.trim() : '';
    // eslint-disable-next-line no-control-regex
    if (!name || name.length > MAX_PROJECT_NAME || /[\u0000-\u001f]/.test(name)) throw new BuilderApiError(400, 'INVALID_INPUT', `Project name must be 1-${MAX_PROJECT_NAME} printable characters.`);
    if (!requirements || requirements.length > MAX_BUILDER_REQUIREMENTS) throw new BuilderApiError(400, 'INVALID_INPUT', `Requirements must be 1-${MAX_BUILDER_REQUIREMENTS} characters.`);
    const client = this.client(email);
    if ((await this.d.store.list(email)).length >= MAX_PROJECTS_PER_OWNER) throw new BuilderApiError(429, 'PROJECT_LIMIT', `At most ${MAX_PROJECTS_PER_OWNER} projects per user.`);
    const at = this.iso();
    const rec: BuilderProjectRecord = {
      id: this.newId(), ownerEmail: email, name, requirements, status: 'queued', attempt: 1, tinanTaskId: null, tinanProjectId: null, plan: null, planDigest: null,
      approval: null, manifest: null, validation: null, errors: [], attempts: [{ n: 1, tinanTaskId: null, startedAt: at, status: 'queued', errors: [] }], createdAt: at, updatedAt: at, version: 1,
    };
    if (!(await this.d.store.create(rec))) throw new BuilderApiError(409, 'CONFLICT', 'Project id collision; retry.');
    await this.log(email, 'builder.project.created', rec.id, { attempt: 1, requirementsChars: requirements.length });
    return toProjectView(await this.submit(email, client, rec));
  }

  /** Submits the stored requirements. A failure is recorded as a real `failed` state; nothing is simulated. */
  private async submit(email: string, client: BuilderClient, rec: BuilderProjectRecord): Promise<BuilderProjectRecord> {
    let next: BuilderProjectRecord;
    try {
      const t = await client.submitRequirements(rec.requirements, AbortSignal.timeout(SYNC_TIMEOUT_MS));
      next = this.applyTask(rec, t);
      next.tinanTaskId = t.taskId;
      await this.log(email, 'builder.task.submitted', rec.id, { attempt: rec.attempt, status: t.status });
    } catch (e) {
      const msg = e instanceof BuilderError ? e.message : 'Submission failed.';
      next = { ...rec, status: 'failed', errors: [msg] };
      await this.log(email, 'builder.task.submit_failed', rec.id, { attempt: rec.attempt, code: e instanceof BuilderError ? e.code : 'ERROR' });
    }
    next.attempts = next.attempts.map((a) => (a.n === next.attempt ? { ...a, tinanTaskId: next.tinanTaskId, status: next.status, errors: next.errors } : a));
    return this.save(next);
  }

  /** Copies validated TINAN AI task fields. Plans are re-hashed by EurekaCore; an already recorded approval never survives a changed plan. */
  private applyTask(rec: BuilderProjectRecord, t: BuilderTaskView): BuilderProjectRecord {
    const next: BuilderProjectRecord = { ...rec, status: mapStatus(t.status), errors: t.errors, tinanProjectId: t.projectId ?? rec.tinanProjectId };
    if (t.plan) {
      const d = planDigest(t.plan);
      if (rec.planDigest && rec.planDigest !== d) next.approval = null;
      next.plan = t.plan;
      next.planDigest = d;
    }
    return next;
  }

  async get(email: string, id: string): Promise<{ project: BuilderProjectView; integration?: { state: IntegrationState; message: string } }> {
    const rec = await this.owned(email, id);
    if (BUILDER_TERMINAL.includes(rec.status) || !rec.tinanTaskId) return { project: toProjectView(rec) };
    return this.sync(email, rec);
  }

  private async sync(email: string, rec: BuilderProjectRecord): Promise<{ project: BuilderProjectView; integration?: { state: IntegrationState; message: string } }> {
    const client = this.client(email);
    const signal = AbortSignal.timeout(SYNC_TIMEOUT_MS);
    try {
      const t = await client.getTask(rec.tinanTaskId as string, signal);
      let next = this.applyTask(rec, t);
      if ((t.status === 'generating' || t.status === 'committing' || t.status === 'completed') && !next.approval) {
        // TINAN AI moved past planning although no human approval is recorded in EurekaCore: never accept its output.
        try { await client.cancel(rec.tinanTaskId as string, signal); } catch { /* best effort */ }
        next = { ...next, status: 'failed', errors: ['TINAN AI started generating without an approval recorded by EurekaCore. The task was cancelled and its output rejected.'] };
        await this.log(email, 'builder.approval.bypass_detected', rec.id, { tinanStatus: t.status });
      } else if (t.status === 'completed') {
        next = await this.validate(email, client, next, t, signal);
      }
      next.attempts = next.attempts.map((a) => (a.n === next.attempt ? { ...a, status: next.status, errors: next.errors } : a));
      const changed = JSON.stringify({ ...next, updatedAt: '', version: 0 }) !== JSON.stringify({ ...rec, updatedAt: '', version: 0 });
      if (!changed) return { project: toProjectView(rec) };
      const saved = await this.save(next);
      if (saved.status !== rec.status && (saved.status === 'completed' || saved.status === 'failed' || saved.status === 'cancelled')) {
        await this.log(email, `builder.task.${saved.status}`, rec.id, { attempt: rec.attempt, verification: saved.validation?.passed ?? null });
      }
      return { project: toProjectView(saved) };
    } catch (e) {
      if (e instanceof BuilderApiError) throw e;
      if (e instanceof BuilderError && (e.code === 'NOT_FOUND' || e.code === 'OWNERSHIP_MISMATCH')) {
        const msg = e.code === 'NOT_FOUND' ? 'TINAN AI no longer has this task (its task store may have restarted). The task cannot be recovered; retry to resubmit.' : e.message;
        const saved = await this.save({ ...rec, status: 'failed', errors: [msg], attempts: rec.attempts.map((a) => (a.n === rec.attempt ? { ...a, status: 'failed', errors: [msg] } : a)) });
        await this.log(email, 'builder.task.failed', rec.id, { code: e.code });
        return { project: toProjectView(saved) };
      }
      // Transient or authentication problems do not change the task's state: report them as the real integration status.
      return { project: toProjectView(rec), integration: { state: integrationStateOf(e), message: e instanceof BuilderError ? e.message : 'TINAN AI request failed.' } };
    }
  }

  /** Retrieves the manifest and every file, then verifies digests and SHA-256 hashes. Success is only ever derived from this check. */
  private async validate(email: string, client: BuilderClient, rec: BuilderProjectRecord, t: BuilderTaskView, signal: AbortSignal): Promise<BuilderProjectRecord> {
    let manifest;
    try {
      manifest = await client.getManifest(rec.tinanTaskId as string, signal);
    } catch (e) {
      if (isRetriable(e)) throw e;
      const msg = e instanceof BuilderError ? e.message : 'Manifest retrieval failed.';
      return { ...rec, status: 'failed', errors: [msg], validation: null };
    }
    const problems: string[] = [];
    let listed: string[] = [];
    try { listed = validateBuilderPaths(await client.listFiles(manifest.projectId, signal)); validateBuilderPaths(manifest.files.map((f) => f.path)); } catch (e) {
      if (isRetriable(e)) throw e;
      problems.push(e instanceof Error ? e.message : 'Invalid file list.');
    }
    if (t.projectId && t.projectId !== manifest.projectId) problems.push('The task and the manifest refer to different projects');
    const contents = new Map<string, string | null>();
    if (!problems.length) {
      await mapLimit(manifest.files, FILE_CONCURRENCY, async (f) => {
        try { contents.set(f.path, await client.readFile(manifest.projectId, f.path, signal)); } catch (e) {
          if (isRetriable(e)) throw e;
          contents.set(f.path, null);
        }
      });
    }
    const report = verifyGeneratedFiles({ projectId: manifest.projectId, manifest, approvedDigest: rec.approval?.digest ?? null, listed, contents, now: this.iso() });
    report.problems.unshift(...problems);
    report.passed = report.passed && !problems.length;
    const stored = { planDigest: manifest.planDigest, manifestDigest: manifest.manifestDigest, totalBytes: manifest.totalBytes, files: manifest.files };
    return report.passed
      ? { ...rec, status: 'completed', tinanProjectId: manifest.projectId, manifest: stored, validation: report, errors: [] }
      : { ...rec, status: 'failed', tinanProjectId: manifest.projectId, manifest: stored, validation: report, errors: report.problems.slice(0, 10) };
  }

  /** Records the human approval from the verified identity, then forwards the exact digest to TINAN AI. */
  async approve(email: string, id: string, digest: unknown): Promise<BuilderProjectView> {
    if (typeof digest !== 'string' || !DIGEST.test(digest)) throw new BuilderApiError(400, 'INVALID_INPUT', 'planDigest must be the 0x-prefixed SHA-256 digest of the plan shown for review.');
    let rec = await this.owned(email, id);
    if (rec.status !== 'awaiting_approval' || !rec.planDigest || !rec.tinanTaskId) throw new BuilderApiError(409, 'INVALID_STATE', 'The project is not awaiting plan approval.');
    if (rec.planDigest !== digest) throw new BuilderApiError(409, 'PLAN_DIGEST_MISMATCH', 'The plan changed since it was displayed. Review the current plan.');
    const client = this.client(email);
    const signal = AbortSignal.timeout(SYNC_TIMEOUT_MS);
    try {
      const fresh = await client.getTask(rec.tinanTaskId, signal);
      if (fresh.status !== 'awaiting_approval' || !fresh.plan || planDigest(fresh.plan) !== digest) {
        rec = await this.save(this.applyTask(rec, fresh));
        throw new BuilderApiError(409, 'PLAN_DIGEST_MISMATCH', 'TINAN AI reports a different plan or state than the one displayed. Nothing was approved.');
      }
    } catch (e) {
      if (e instanceof BuilderApiError) throw e;
      throw this.upstream(e);
    }
    if (!rec.approval || rec.approval.digest !== digest) {
      rec = await this.save({ ...rec, approval: { approvedBy: email, at: this.iso(), digest, forwarded: false } });
      await this.log(email, 'builder.plan.approved', rec.id, { digest });
    }
    try {
      const t = await client.forwardApproval(rec.tinanTaskId as string, digest, signal);
      const next = this.applyTask({ ...rec, approval: { ...(rec.approval as NonNullable<typeof rec.approval>), forwarded: true } }, t);
      next.attempts = next.attempts.map((a) => (a.n === next.attempt ? { ...a, status: next.status, errors: next.errors } : a));
      const saved = await this.save(next);
      await this.log(email, 'builder.approval.forwarded', rec.id, { digest, status: saved.status });
      return toProjectView(saved);
    } catch (e) {
      if (e instanceof BuilderError && e.code === 'CONFLICT') {
        await this.save({ ...rec, approval: null });
        await this.log(email, 'builder.approval.rejected_by_builder', rec.id, { digest });
        throw new BuilderApiError(409, 'PLAN_DIGEST_MISMATCH', 'TINAN AI refused the approval (plan or state differs). The approval was discarded; review and approve again.');
      }
      throw this.upstream(e);
    }
  }

  async cancel(email: string, id: string): Promise<BuilderProjectView> {
    const rec = await this.owned(email, id);
    if (BUILDER_TERMINAL.includes(rec.status)) throw new BuilderApiError(409, 'INVALID_STATE', `The task is already ${rec.status}.`);
    let note: string | null = null;
    if (rec.tinanTaskId) {
      const client = this.client(email);
      try {
        await client.cancel(rec.tinanTaskId, AbortSignal.timeout(SYNC_TIMEOUT_MS));
      } catch (e) {
        if (e instanceof BuilderError && e.code === 'NOT_FOUND') note = 'TINAN AI no longer had this task.';
        else if (e instanceof BuilderError && e.code === 'CONFLICT') return (await this.sync(email, rec)).project;
        else throw this.upstream(e);
      }
    }
    const saved = await this.save({ ...rec, status: 'cancelled', errors: note ? [note] : [], attempts: rec.attempts.map((a) => (a.n === rec.attempt ? { ...a, status: 'cancelled' } : a)) });
    await this.log(email, 'builder.task.cancelled', rec.id, { attempt: rec.attempt });
    return toProjectView(saved);
  }

  async retry(email: string, id: string): Promise<BuilderProjectView> {
    const rec = await this.owned(email, id);
    if (rec.status !== 'failed' && rec.status !== 'cancelled') throw new BuilderApiError(409, 'INVALID_STATE', 'Only failed or cancelled tasks can be retried.');
    if (rec.attempt >= MAX_BUILDER_ATTEMPTS) throw new BuilderApiError(409, 'RETRY_LIMIT', `At most ${MAX_BUILDER_ATTEMPTS} attempts per project.`);
    const client = this.client(email);
    const attempt = rec.attempt + 1;
    const at = this.iso();
    // The previous TINAN AI task and its files are left untouched; the new attempt needs its own plan and its own human approval.
    const reset = await this.save({
      ...rec, status: 'queued', attempt, tinanTaskId: null, tinanProjectId: null, plan: null, planDigest: null, approval: null, manifest: null, validation: null, errors: [],
      attempts: [...rec.attempts, { n: attempt, tinanTaskId: null, startedAt: at, status: 'queued', errors: [] }],
    });
    await this.log(email, 'builder.task.retry', rec.id, { attempt });
    return toProjectView(await this.submit(email, client, reset));
  }

  private upstream(e: unknown): BuilderApiError {
    if (e instanceof BuilderError) return new BuilderApiError(e.code === 'AUTH' ? 502 : 503, e.code === 'AUTH' ? 'TINAN_AUTH_FAILED' : 'TINAN_UNAVAILABLE', e.message);
    return new BuilderApiError(503, 'TINAN_UNAVAILABLE', 'TINAN AI request failed.');
  }

  private ensureVerified(rec: BuilderProjectRecord) {
    if (rec.status !== 'completed' || !rec.manifest || !rec.validation?.passed || !rec.tinanProjectId) {
      throw new BuilderApiError(409, 'NOT_VERIFIED', 'Files are available only after the task completed and its manifest and file hashes were verified.');
    }
    return { manifest: rec.manifest, projectId: rec.tinanProjectId };
  }

  /** Always re-fetches and re-verifies against the verified manifest: a file that changed upstream is refused, not served. */
  private async fetchVerified(email: string, rec: BuilderProjectRecord, paths: string[]): Promise<{ path: string; content: string; bytes: number; sha256: string }[]> {
    const { manifest, projectId } = this.ensureVerified(rec);
    const client = this.client(email);
    const signal = AbortSignal.timeout(SYNC_TIMEOUT_MS);
    const out = await mapLimit(paths, FILE_CONCURRENCY, async (path) => {
      const entry = manifest.files.find((f) => f.path === path);
      if (!entry) throw new BuilderApiError(404, 'NOT_FOUND', 'File is not part of the verified manifest.');
      let content: string;
      try { content = await client.readFile(projectId, path, signal); } catch (e) { throw this.upstream(e); }
      const sha = contentDigest(content);
      if (sha !== entry.sha256 || byteLength(content) !== entry.bytes) {
        await this.log(email, 'builder.file.hash_mismatch', rec.id, { path: path.slice(0, 120) });
        throw new BuilderApiError(502, 'FILE_HASH_MISMATCH', `${path} no longer matches the verified SHA-256 hash; it was not served.`);
      }
      return { path, content, bytes: entry.bytes, sha256: sha };
    });
    return out;
  }

  async file(email: string, id: string, path: unknown) {
    if (typeof path !== 'string' || !path) throw new BuilderApiError(400, 'INVALID_INPUT', 'path is required.');
    const rec = await this.owned(email, id);
    return (await this.fetchVerified(email, rec, [path]))[0];
  }

  async exportZip(email: string, id: string): Promise<{ filename: string; bytes: Uint8Array<ArrayBuffer> }> {
    const rec = await this.owned(email, id);
    const { manifest } = this.ensureVerified(rec);
    const files = await this.fetchVerified(email, rec, manifest.files.map((f) => f.path));
    await this.log(email, 'builder.project.exported', rec.id, { files: files.length, manifestDigest: manifest.manifestDigest });
    const slug = rec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
    return { filename: `${slug}-${rec.id.slice(3, 11)}.zip`, bytes: createZip(files) };
  }

  async history(email: string, id?: string): Promise<HistoryEntryView[]> {
    const projects = id ? [await this.owned(email, id)] : (await this.d.store.list(email)).slice(0, 50);
    const rows: HistoryEntryView[] = [];
    for (const p of projects) {
      for (const e of await this.d.audit.list(`builder:${p.id}`)) rows.push({ projectId: p.id, at: e.at, action: e.action, actor: e.actor, detail: e.detail });
    }
    return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 300);
  }
}
