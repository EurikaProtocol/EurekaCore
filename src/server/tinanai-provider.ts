import type { AgentProvider, AgentTaskRequest } from '../core/agent';
import { AGENT_CONTRACT_VERSION } from '../core/agent';

/**
 * Server-side adapter for the TinanAi HTTP API, written from TinanAi's source at commit c329cafe
 * (middleware.ts, app/api/agent/tasks/**, lib/agent/types.ts):
 *   POST {base}/api/agent/tasks           {objective<=2000}  -> 202 {task}
 *   GET  {base}/api/agent/tasks/:id                          -> {task}
 *   POST {base}/api/agent/tasks/:id/cancel                   -> {task}
 * Auth is HTTP Basic; non-GET requests must carry an Origin equal to the TinanAi origin.
 *
 * RUN ONLY IN A WORKER/SERVER. Credentials come from server-side secrets and are never logged or returned.
 * UNVERIFIED against a live TinanAi instance. It never calls TinanAi's /approval route: TinanAi-side approval is
 * not EurekaCore authorization, and a task awaiting it is reported as failed.
 */
export type TinanAiConfig = {
  baseUrl: string;
  username: string;
  password: string;
  fetch?: typeof fetch;
  pollIntervalMs?: number;
  /** Timeout for each individual HTTP request. */
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  /** Test hook. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export const TINANAI_MAX_OBJECTIVE = 2000;
const ACTIVE = new Set(['planning', 'executing']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export class TinanAiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'TinanAiError';
  }
}

export function parseTinanAiConfig(env: Record<string, string | undefined>): TinanAiConfig {
  const baseUrl = env.TINANAI_BASE_URL?.trim();
  const username = env.TINANAI_USERNAME;
  const password = env.TINANAI_PASSWORD;
  if (!baseUrl || !username || !password) {
    throw new TinanAiError('NOT_CONFIGURED', 'TINANAI_BASE_URL, TINANAI_USERNAME and TINANAI_PASSWORD must be set as server-side secrets.');
  }
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new TinanAiError('NOT_CONFIGURED', 'TINANAI_BASE_URL is not a valid URL.'); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new TinanAiError('NOT_CONFIGURED', 'TINANAI_BASE_URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  if (url.username || url.password) throw new TinanAiError('NOT_CONFIGURED', 'TINANAI_BASE_URL must not embed credentials.');
  return { baseUrl: url.origin, username, password };
}

function basicAuth(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `Basic ${btoa(bin)}`;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new TinanAiError('ABORTED', 'Aborted.')); }, { once: true });
  });

type RemoteTask = {
  id?: unknown; status?: unknown; summary?: unknown; selectedTools?: unknown; toolResults?: unknown; plan?: unknown; errors?: unknown;
};

export class TinanAiProvider implements AgentProvider {
  readonly name = 'tinanai';
  private readonly cfg: Required<Omit<TinanAiConfig, 'fetch' | 'sleep'>> & { fetch: typeof fetch; sleep: NonNullable<TinanAiConfig['sleep']> };

  constructor(config: TinanAiConfig) {
    const checked = parseTinanAiConfig({ TINANAI_BASE_URL: config.baseUrl, TINANAI_USERNAME: config.username, TINANAI_PASSWORD: config.password });
    this.cfg = {
      ...checked,
      fetch: config.fetch ?? fetch,
      pollIntervalMs: config.pollIntervalMs ?? 1500,
      requestTimeoutMs: config.requestTimeoutMs ?? 10_000,
      maxResponseBytes: config.maxResponseBytes ?? 256 * 1024,
      sleep: config.sleep ?? defaultSleep,
    };
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<{ task: RemoteTask }> {
    const headers: Record<string, string> = { Authorization: basicAuth(this.cfg.username, this.cfg.password), Accept: 'application/json' };
    if (method === 'POST') { headers['Content-Type'] = 'application/json'; headers.Origin = this.cfg.baseUrl; }
    const timeout = AbortSignal.timeout(this.cfg.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.cfg.fetch(`${this.cfg.baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw new TinanAiError('ABORTED', 'Request aborted.');
      throw new TinanAiError('NETWORK', `TinanAi request failed (${e instanceof Error ? e.name : 'error'}).`);
    }
    if (res.status === 401 || res.status === 403) throw new TinanAiError('AUTH', `TinanAi rejected the credentials or origin (HTTP ${res.status}).`);
    if (res.status === 429) throw new TinanAiError('RATE_LIMITED', 'TinanAi rate limit reached; retry later.');
    if (res.status === 404) throw new TinanAiError('NOT_FOUND', 'TinanAi task not found (its task store is process-memory and may have restarted).');
    if (res.status === 503) throw new TinanAiError('UNAVAILABLE', 'TinanAi is not configured or unavailable (HTTP 503).');
    if (!res.ok) throw new TinanAiError('HTTP', `TinanAi returned HTTP ${res.status}.`);
    const text = await res.text();
    if (text.length > this.cfg.maxResponseBytes) throw new TinanAiError('MALFORMED', 'TinanAi response is too large.');
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new TinanAiError('MALFORMED', 'TinanAi returned invalid JSON.'); }
    const task = (json as { task?: unknown } | null)?.task;
    if (!task || typeof task !== 'object' || typeof (task as RemoteTask).id !== 'string' || typeof (task as RemoteTask).status !== 'string') {
      throw new TinanAiError('MALFORMED', 'TinanAi response did not contain a valid task.');
    }
    return { task: task as RemoteTask };
  }

  private failed(request: AgentTaskRequest, code: string, message: string) {
    return { contractVersion: AGENT_CONTRACT_VERSION, taskId: request.id, status: 'failed', error: { code, message } };
  }

  async execute(request: AgentTaskRequest, signal?: AbortSignal): Promise<unknown> {
    if (request.input.length > TINANAI_MAX_OBJECTIVE) {
      return this.failed(request, 'INPUT_TOO_LONG', `TinanAi objectives are limited to ${TINANAI_MAX_OBJECTIVE} characters.`);
    }
    let remoteId: string | null = null;
    try {
      const created = await this.call('POST', '/api/agent/tasks', { objective: request.input }, signal);
      remoteId = created.task.id as string;
      let task = created.task;
      while (ACTIVE.has(task.status as string)) {
        await this.cfg.sleep(this.cfg.pollIntervalMs, signal);
        task = (await this.call('GET', `/api/agent/tasks/${encodeURIComponent(remoteId)}`, undefined, signal)).task;
      }
      return this.toResult(request, task);
    } catch (e) {
      if (remoteId && (signal?.aborted || (e instanceof TinanAiError && e.code === 'ABORTED'))) {
        // Best effort remote cancel; its failure must not mask the abort.
        await this.call('POST', `/api/agent/tasks/${encodeURIComponent(remoteId)}/cancel`, {}).catch(() => undefined);
      }
      if (e instanceof TinanAiError) {
        if (e.code === 'ABORTED') throw e;
        return this.failed(request, e.code, e.message);
      }
      throw e;
    }
  }

  private toResult(request: AgentTaskRequest, task: RemoteTask) {
    const status = task.status as string;
    if (status === 'awaiting_approval') {
      return this.failed(request, 'TINANAI_APPROVAL_REQUIRED', 'TinanAi is waiting for its own approval step, which EurekaCore does not grant. The task was left unapproved.');
    }
    if (status === 'cancelled') return this.failed(request, 'CANCELLED', 'TinanAi cancelled the task.');
    if (status === 'failed') {
      const errs = Array.isArray(task.errors) ? task.errors.filter((x): x is string => typeof x === 'string') : [];
      return this.failed(request, 'TINANAI_FAILED', errs.join('; ').slice(0, 500) || 'TinanAi reported a failure.');
    }
    if (!TERMINAL.has(status)) return this.failed(request, 'MALFORMED', `Unknown TinanAi task status: ${status.slice(0, 40)}`);
    if (typeof task.summary !== 'string') return this.failed(request, 'MALFORMED', 'TinanAi completed without a summary.');
    const results = Array.isArray(task.toolResults) ? task.toolResults : [];
    const toolsUsed = [...new Set(results.map((r) => (r as { tool?: unknown })?.tool).filter((t): t is string => typeof t === 'string'))];
    // TinanAi's plan steps are informational only: they become non-consequential notes that carry no authority.
    const steps = Array.isArray(task.plan) ? task.plan.slice(0, 20) : [];
    const proposedActions = steps.flatMap((s, i) => {
      const step = s as { title?: unknown; description?: unknown; permission?: unknown };
      if (typeof step?.title !== 'string') return [];
      return [{
        id: `plan-${i + 1}`, type: 'note',
        description: `${step.title}${typeof step.description === 'string' ? `: ${step.description}` : ''}`.slice(0, 1000),
        parameters: { permission: typeof step.permission === 'string' ? step.permission.slice(0, 32) : null },
      }];
    });
    return {
      contractVersion: AGENT_CONTRACT_VERSION, taskId: request.id, status: 'completed',
      output: { text: task.summary.slice(0, 20000), proposedActions }, toolsUsed,
    };
  }
}
