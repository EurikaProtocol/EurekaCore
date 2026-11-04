import { sha256, toUtf8Bytes } from 'ethers';
import {
  BUILDER_CONTRACT_VERSION, BUILDER_TASK_STATUSES, BuilderError, MAX_BUILDER_FILE_BYTES, MAX_BUILDER_FILES, MAX_BUILDER_REQUIREMENTS, MAX_BUILDER_TOTAL_BYTES,
  manifestDigest, parseBuilderPlan,
  type BuilderManifest, type BuilderTaskStatus, type BuilderTaskView, type ManifestEntry, type ProjectBuilderProvider,
} from '../core/builder';
import { parseTinanAiConfig, type TinanAiConfig } from './tinanai-provider';

/**
 * Server-side adapter for the existing TINAN AI Builder, written from the TinanAi repository (main) routes:
 *   POST {base}/api/projects                      {requirements}             -> 202 {task}      (planning)
 *   GET  {base}/api/projects/tasks/:id                                       -> {task}
 *   POST {base}/api/projects/tasks/:id/approval   {approved:true, planDigest} -> 202 {task}      (409 PLAN_DIGEST_MISMATCH on a different plan)
 *   GET  {base}/api/projects/tasks/:id/manifest                              -> {manifest}      (completed tasks; paths, bytes, sha256; contract v1.1)
 *   POST {base}/api/projects/tasks/:id/cancel     {}                         -> {task}
 *   GET  {base}/api/projects/:id                                             -> {project}       (file PATHS only, no contents)
 *   GET  {base}/api/projects/:id/files?path=...                              -> {path, content} (one file)
 * `/api/projects/:id` does NOT return file contents and `/export` returns a zip, so contents are read one file at a time
 * from `/files`. This adapter never sends `projectId` (so it can never overwrite an existing project) and never sends
 * `confirmOverwrite`.
 *
 * Ownership: TINAN AI is single-owner. It derives `ownerId = hex(sha256(TINAN_AUTH_USERNAME))` and stores it on every
 * task and project. The adapter derives the same value from the server-side username and REFUSES any record whose
 * `ownerId` differs. This is a defence-in-depth check, not per-user isolation (see docs/TINANAI_INTEGRATION_CONTRACT.md).
 *
 * RUN ONLY IN A WORKER/SERVER. Credentials never leave server-side secrets. UNVERIFIED against a live TINAN AI instance.
 */
export type TinanAiBuilderConfig = TinanAiConfig & {
  maxFileResponseBytes?: number;
  /**
   * Optional per-user delegation (TINAN AI `x-eureka-delegation`, HMAC-SHA256, <= 300 s). `subject` must be a verified, pseudonymous
   * EurekaCore user id (never browser-supplied). The Basic credential stays mandatory. Requires TINAN_MULTI_USER_ENABLED on TINAN AI.
   */
  delegation?: { secret: string; subject: string };
  /** Bounded retries for idempotent GETs only (network, 503, 429). Default 0 here; the Worker factory uses 2. */
  getRetries?: number;
  retryDelayMs?: number;
};

const UUIDISH = /^[0-9a-f-]{36}$/i;
const DIGEST = /^0x[0-9a-f]{64}$/;
const STATUSES = new Set<string>(BUILDER_TASK_STATUSES);

function basicAuth(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `Basic ${btoa(bin)}`;
}

/** Same derivation as TINAN AI's proxy.ts: SHA-256 of the configured username, lowercase hex. */
export const deriveServiceOwnerId = (username: string): string => sha256(toUtf8Bytes(username)).slice(2);

/** Same derivation as TINAN AI's lib/delegation.ts `delegatedOwnerId`. */
export const deriveDelegatedOwnerId = (subject: string): string => sha256(toUtf8Bytes(`tinan-delegated-owner:v1:${subject}`)).slice(2);

const SUBJECT = /^[a-z0-9._@+-]{3,200}$/;
const b64u = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Pseudonymous, charset-safe delegation subject for a verified EurekaCore identity (the email never leaves EurekaCore). */
export const delegationSubjectFor = (email: string): string => `eureka.${sha256(toUtf8Bytes(email.trim().toLowerCase())).slice(2, 42)}`;

export async function signDelegationToken(secret: string, subject: string, nowSeconds: number, ttlSeconds = 120): Promise<string> {
  if (secret.length < 32) throw new BuilderError('INVALID_INPUT', 'Delegation secret must be at least 32 characters.');
  if (!SUBJECT.test(subject)) throw new BuilderError('INVALID_INPUT', 'Invalid delegation subject.');
  const body = `v1.${b64u(new TextEncoder().encode(JSON.stringify({ sub: subject, aud: 'tinan-ai', iat: nowSeconds, exp: nowSeconds + ttlSeconds })))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${body}.${hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))))}`;
}

const sleepMs = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new BuilderError('ABORTED', 'Request aborted.')); }, { once: true });
});

export class TinanAiBuilderProvider implements ProjectBuilderProvider {
  readonly name = 'tinanai-builder';
  readonly contractVersion = BUILDER_CONTRACT_VERSION;
  readonly ownerId: string;
  private readonly cfg: { baseUrl: string; username: string; password: string; fetch: typeof fetch; requestTimeoutMs: number; maxResponseBytes: number; maxFileResponseBytes: number; getRetries: number; retryDelayMs: number };
  private readonly delegation?: { secret: string; subject: string };

  constructor(config: TinanAiBuilderConfig) {
    const checked = parseTinanAiConfig({ TINANAI_BASE_URL: config.baseUrl, TINANAI_USERNAME: config.username, TINANAI_PASSWORD: config.password });
    this.cfg = {
      ...checked,
      fetch: config.fetch ?? ((input, init) => fetch(input, init)),
      requestTimeoutMs: config.requestTimeoutMs ?? 10_000,
      maxResponseBytes: config.maxResponseBytes ?? 256 * 1024,
      maxFileResponseBytes: config.maxFileResponseBytes ?? 1024 * 1024,
      getRetries: Math.min(Math.max(config.getRetries ?? 0, 0), 3),
      retryDelayMs: config.retryDelayMs ?? 250,
    };
    if (config.delegation) {
      if (config.delegation.secret.length < 32 || config.delegation.secret === checked.password || !SUBJECT.test(config.delegation.subject)) {
        throw new BuilderError('INVALID_INPUT', 'Delegation needs a distinct secret of at least 32 characters and a valid subject.');
      }
      this.delegation = config.delegation;
      this.ownerId = deriveDelegatedOwnerId(config.delegation.subject);
    } else {
      this.ownerId = deriveServiceOwnerId(checked.username);
    }
  }

  /** Idempotent GETs are retried a bounded number of times on transient failures; POSTs are never retried. */
  private async call(method: 'GET' | 'POST', path: string, body: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<unknown> {
    const retries = method === 'GET' ? this.cfg.getRetries : 0;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.callOnce(method, path, body, signal, maxBytes);
      } catch (e) {
        const transient = e instanceof BuilderError && (e.code === 'NETWORK' || e.code === 'UNAVAILABLE' || e.code === 'RATE_LIMITED');
        if (!transient || attempt >= retries) throw e;
        await sleepMs(this.cfg.retryDelayMs * 2 ** attempt, signal);
      }
    }
  }

  /** Authenticated reachability probe: an unknown task id must answer 404 (authenticated) rather than 401/403/5xx. Creates nothing. */
  async probe(signal?: AbortSignal): Promise<void> {
    try {
      await this.call('GET', '/api/projects/tasks/00000000-0000-4000-8000-000000000000', undefined, signal, this.cfg.maxResponseBytes);
    } catch (e) {
      if (e instanceof BuilderError && e.code === 'NOT_FOUND') return;
      throw e;
    }
  }

  private async callOnce(method: 'GET' | 'POST', path: string, body: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: basicAuth(this.cfg.username, this.cfg.password), Accept: 'application/json' };
    if (this.delegation) headers['x-eureka-delegation'] = await signDelegationToken(this.delegation.secret, this.delegation.subject, Math.floor(Date.now() / 1000));
    // TINAN AI refuses non-GET requests whose Origin is not its own.
    if (method === 'POST') { headers['Content-Type'] = 'application/json'; headers.Origin = this.cfg.baseUrl; }
    const timeout = AbortSignal.timeout(this.cfg.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.cfg.fetch(`${this.cfg.baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw new BuilderError('ABORTED', 'Request aborted.');
      throw new BuilderError('NETWORK', `TINAN AI request failed (${e instanceof Error ? e.name : 'error'}).`);
    }
    if (res.status === 403 && (await res.clone().json().catch(() => null) as { code?: unknown } | null)?.code === 'MULTI_USER_DISABLED') {
      throw new BuilderError('AUTH', 'TINAN AI has multi-user delegation disabled (TINAN_MULTI_USER_ENABLED); refusing to serve this user as the shared owner.');
    }
    if (res.status === 401 || res.status === 403) throw new BuilderError('AUTH', `TINAN AI rejected the credentials or origin (HTTP ${res.status}).`);
    if (res.status === 429) throw new BuilderError('RATE_LIMITED', 'TINAN AI rate limit reached; retry later.');
    if (res.status === 404) throw new BuilderError('NOT_FOUND', 'TINAN AI Builder record not found.');
    if (res.status === 503) throw new BuilderError('UNAVAILABLE', 'TINAN AI is not configured or unavailable (HTTP 503).');
    if (res.status === 409) throw new BuilderError('CONFLICT', 'TINAN AI refused the request in the current task state (HTTP 409).');
    if (!res.ok) throw new BuilderError('HTTP', `TINAN AI returned HTTP ${res.status}.`);
    const text = await res.text();
    if (text.length > maxBytes) throw new BuilderError('MALFORMED', 'TINAN AI response is too large.');
    try { return JSON.parse(text); } catch { throw new BuilderError('MALFORMED', 'TINAN AI returned invalid JSON.'); }
  }

  /** Validates a task record and enforces ownership. Anything unexpected is an error, never a guess. */
  private toView(json: unknown, expectedTaskId?: string): BuilderTaskView {
    const t = (json as { task?: Record<string, unknown> } | null)?.task;
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !UUIDISH.test(t.id) || typeof t.status !== 'string' || !STATUSES.has(t.status)) {
      throw new BuilderError('MALFORMED', 'TINAN AI response did not contain a valid Builder task.');
    }
    if (expectedTaskId !== undefined && t.id !== expectedTaskId) throw new BuilderError('OWNERSHIP_MISMATCH', 'TINAN AI returned a different task than requested.');
    if (t.ownerId !== this.ownerId) throw new BuilderError('OWNERSHIP_MISMATCH', 'The Builder task is not owned by the EurekaCore service identity.');
    const projectId = t.projectId ?? null;
    if (projectId !== null && (typeof projectId !== 'string' || !UUIDISH.test(projectId))) throw new BuilderError('MALFORMED', 'Builder task has an invalid project id.');
    let plan = null;
    if (t.plan !== null && t.plan !== undefined) {
      const parsed = parseBuilderPlan(t.plan);
      if (!parsed.ok) throw new BuilderError('MALFORMED', parsed.error.message);
      plan = parsed.value;
    }
    if (typeof t.requirements !== 'string') throw new BuilderError('MALFORMED', 'Builder task has no requirements.');
    const errors = Array.isArray(t.errors) ? t.errors.filter((e): e is string => typeof e === 'string').map((e) => e.slice(0, 300)).slice(0, 10) : [];
    return { taskId: t.id, status: t.status as BuilderTaskStatus, requirements: t.requirements, projectId: projectId as string | null, plan, errors };
  }

  async submitRequirements(requirements: string, signal?: AbortSignal): Promise<BuilderTaskView> {
    if (typeof requirements !== 'string' || !requirements.trim() || requirements.length > MAX_BUILDER_REQUIREMENTS) {
      throw new BuilderError('INVALID_INPUT', `Requirements must be 1-${MAX_BUILDER_REQUIREMENTS} characters.`);
    }
    return this.toView(await this.call('POST', '/api/projects', { requirements }, signal, this.cfg.maxResponseBytes));
  }

  async getTask(taskId: string, signal?: AbortSignal): Promise<BuilderTaskView> {
    if (!UUIDISH.test(taskId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder task id.');
    return this.toView(await this.call('GET', `/api/projects/tasks/${encodeURIComponent(taskId)}`, undefined, signal, this.cfg.maxResponseBytes), taskId);
  }

  async forwardApproval(taskId: string, planDigest: string, signal?: AbortSignal): Promise<BuilderTaskView> {
    if (!UUIDISH.test(taskId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder task id.');
    if (!DIGEST.test(planDigest)) throw new BuilderError('INVALID_INPUT', 'A 0x-prefixed SHA-256 plan digest is required to forward an approval.');
    return this.toView(await this.call('POST', `/api/projects/tasks/${encodeURIComponent(taskId)}/approval`, { approved: true, planDigest }, signal, this.cfg.maxResponseBytes), taskId);
  }

  async getManifest(taskId: string, signal?: AbortSignal): Promise<BuilderManifest> {
    if (!UUIDISH.test(taskId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder task id.');
    let raw: unknown;
    try {
      raw = await this.call('GET', `/api/projects/tasks/${encodeURIComponent(taskId)}/manifest`, undefined, signal, this.cfg.maxResponseBytes);
    } catch (e) {
      if (e instanceof BuilderError && e.code === 'NOT_FOUND') throw new BuilderError('MANIFEST_UNSUPPORTED', 'TINAN AI did not provide a manifest (contract v1.1 is not deployed or the task is not owned by this identity); refusing to continue.');
      throw e;
    }
    const m = (raw as { manifest?: Record<string, unknown> } | null)?.manifest;
    if (!m || typeof m !== 'object' || m.contractVersion !== BUILDER_CONTRACT_VERSION || m.taskId !== taskId) throw new BuilderError('MALFORMED', 'TINAN AI returned an invalid or mismatched manifest.');
    if (m.ownerId !== this.ownerId) throw new BuilderError('OWNERSHIP_MISMATCH', 'The Builder manifest is not owned by the EurekaCore service identity.');
    if (typeof m.projectId !== 'string' || !UUIDISH.test(m.projectId) || typeof m.planDigest !== 'string' || !DIGEST.test(m.planDigest) || typeof m.manifestDigest !== 'string' || !DIGEST.test(m.manifestDigest)) {
      throw new BuilderError('MALFORMED', 'Builder manifest has invalid identifiers or digests.');
    }
    if (!Array.isArray(m.files) || m.files.length < 1 || m.files.length > MAX_BUILDER_FILES) throw new BuilderError('MALFORMED', 'Builder manifest file list is missing or exceeds the file limit.');
    const files: ManifestEntry[] = [];
    let total = 0;
    for (const f of m.files as Record<string, unknown>[]) {
      if (!f || typeof f.path !== 'string' || !Number.isInteger(f.bytes) || (f.bytes as number) < 0 || (f.bytes as number) > MAX_BUILDER_FILE_BYTES || typeof f.sha256 !== 'string' || !DIGEST.test(f.sha256)) {
        throw new BuilderError('MALFORMED', 'Builder manifest contains an invalid file entry.');
      }
      total += f.bytes as number;
      files.push({ path: f.path, bytes: f.bytes as number, sha256: f.sha256 });
    }
    if (total > MAX_BUILDER_TOTAL_BYTES || m.totalBytes !== total) throw new BuilderError('MALFORMED', 'Builder manifest sizes are inconsistent or exceed the limit.');
    if (manifestDigest(m.planDigest, files) !== m.manifestDigest) throw new BuilderError('MALFORMED', 'Builder manifest digest does not match its file entries.');
    return { taskId, projectId: m.projectId, planDigest: m.planDigest, files, totalBytes: total, manifestDigest: m.manifestDigest };
  }

  async listFiles(projectId: string, signal?: AbortSignal): Promise<string[]> {
    if (!UUIDISH.test(projectId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder project id.');
    const p = ((await this.call('GET', `/api/projects/${encodeURIComponent(projectId)}`, undefined, signal, this.cfg.maxResponseBytes)) as { project?: Record<string, unknown> } | null)?.project;
    if (!p || typeof p !== 'object' || p.id !== projectId) throw new BuilderError('MALFORMED', 'TINAN AI returned a different project than requested.');
    if (p.ownerId !== this.ownerId) throw new BuilderError('OWNERSHIP_MISMATCH', 'The Builder project is not owned by the EurekaCore service identity.');
    if (!Array.isArray(p.files) || p.files.length > MAX_BUILDER_FILES || p.files.some((f) => typeof f !== 'string')) throw new BuilderError('MALFORMED', 'Builder project file list is malformed or exceeds the file limit.');
    return p.files as string[];
  }

  async readFile(projectId: string, path: string, signal?: AbortSignal): Promise<string> {
    if (!UUIDISH.test(projectId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder project id.');
    const r = (await this.call('GET', `/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(path)}`, undefined, signal, this.cfg.maxFileResponseBytes)) as { path?: unknown; content?: unknown } | null;
    if (!r || r.path !== path || typeof r.content !== 'string') throw new BuilderError('MALFORMED', 'TINAN AI returned a different or malformed file.');
    return r.content;
  }

  async cancel(taskId: string, signal?: AbortSignal): Promise<void> {
    if (!UUIDISH.test(taskId)) throw new BuilderError('INVALID_INPUT', 'Invalid Builder task id.');
    this.toView(await this.call('POST', `/api/projects/tasks/${encodeURIComponent(taskId)}/cancel`, {}, signal, this.cfg.maxResponseBytes), taskId);
  }
}
