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
export type TinanAiBuilderConfig = TinanAiConfig & { maxFileResponseBytes?: number };

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

export class TinanAiBuilderProvider implements ProjectBuilderProvider {
  readonly name = 'tinanai-builder';
  readonly contractVersion = BUILDER_CONTRACT_VERSION;
  readonly ownerId: string;
  private readonly cfg: { baseUrl: string; username: string; password: string; fetch: typeof fetch; requestTimeoutMs: number; maxResponseBytes: number; maxFileResponseBytes: number };

  constructor(config: TinanAiBuilderConfig) {
    const checked = parseTinanAiConfig({ TINANAI_BASE_URL: config.baseUrl, TINANAI_USERNAME: config.username, TINANAI_PASSWORD: config.password });
    this.cfg = {
      ...checked,
      fetch: config.fetch ?? ((input, init) => fetch(input, init)),
      requestTimeoutMs: config.requestTimeoutMs ?? 10_000,
      maxResponseBytes: config.maxResponseBytes ?? 256 * 1024,
      maxFileResponseBytes: config.maxFileResponseBytes ?? 1024 * 1024,
    };
    this.ownerId = deriveServiceOwnerId(checked.username);
  }

  private async call(method: 'GET' | 'POST', path: string, body: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: basicAuth(this.cfg.username, this.cfg.password), Accept: 'application/json' };
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
