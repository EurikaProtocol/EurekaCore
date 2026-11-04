/**
 * Sandbox boundary. Generated project code is NEVER executed in the Worker. The Worker only sends files to an
 * isolated runner service (see scripts/sandbox-service.mjs and src/sandbox/docker-runner.ts) and validates what comes back.
 */
export type SandboxFile = { path: string; content: string };
export const SANDBOX_COMMANDS = { 'node-test': ['node', '--test'] } as const;
export type SandboxCommandId = keyof typeof SANDBOX_COMMANDS;

export type SandboxRequest = { files: SandboxFile[]; command: SandboxCommandId; timeoutMs: number };
export type SandboxResult = {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** What the runner says it enforced. Reported, not independently verified by EurekaCore. */
  isolation: { runner: string; network: 'none'; readOnlyRoot: boolean };
};

export interface SandboxRunner {
  readonly name: string;
  run(request: SandboxRequest, signal?: AbortSignal): Promise<SandboxResult>;
}

export const MAX_SANDBOX_FILES = 40;
export const MAX_SANDBOX_BYTES = 1_000_000;
export const MAX_SANDBOX_TIMEOUT_MS = 120_000;
export const MAX_SANDBOX_OUTPUT = 20_000;

export class SandboxError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'INVALID' | 'UPSTREAM', message: string) {
    super(message);
    this.name = 'SandboxError';
  }
}

export function validateSandboxRequest(r: SandboxRequest): void {
  if (!r || !(r.command in SANDBOX_COMMANDS)) throw new SandboxError('INVALID', 'Unknown sandbox command.');
  if (!Array.isArray(r.files) || !r.files.length || r.files.length > MAX_SANDBOX_FILES) throw new SandboxError('INVALID', 'Invalid number of files.');
  if (!Number.isInteger(r.timeoutMs) || r.timeoutMs < 1000 || r.timeoutMs > MAX_SANDBOX_TIMEOUT_MS) throw new SandboxError('INVALID', 'Invalid timeout.');
  let total = 0;
  const seen = new Set<string>();
  for (const f of r.files) {
    const parts = typeof f?.path === 'string' ? f.path.split('/') : [];
    if (!parts.length || parts.some((p) => !/^[A-Za-z0-9._@+-]+$/.test(p) || p === '.' || p === '..') || f.path.length > 200 || typeof f.content !== 'string') {
      throw new SandboxError('INVALID', 'Invalid file entry.');
    }
    if (seen.has(f.path)) throw new SandboxError('INVALID', 'Duplicate file path.');
    seen.add(f.path);
    total += f.content.length;
  }
  if (total > MAX_SANDBOX_BYTES) throw new SandboxError('INVALID', 'Files too large.');
}

export function validateSandboxResult(raw: unknown): SandboxResult {
  const r = raw as Partial<SandboxResult> | null;
  const iso = r?.isolation;
  if (!r || typeof r !== 'object' || !(r.exitCode === null || Number.isInteger(r.exitCode)) || typeof r.timedOut !== 'boolean'
    || typeof r.stdout !== 'string' || typeof r.stderr !== 'string' || typeof r.durationMs !== 'number' || !iso
    || typeof iso.runner !== 'string' || iso.network !== 'none' || typeof iso.readOnlyRoot !== 'boolean') {
    throw new SandboxError('UPSTREAM', 'Sandbox returned a malformed result.');
  }
  return {
    exitCode: r.exitCode ?? null, timedOut: r.timedOut, stdout: r.stdout.slice(0, MAX_SANDBOX_OUTPUT), stderr: r.stderr.slice(0, MAX_SANDBOX_OUTPUT),
    durationMs: r.durationMs, isolation: { runner: iso.runner.slice(0, 100), network: 'none', readOnlyRoot: iso.readOnlyRoot },
  };
}

export type RemoteSandboxConfig = { url: string; token: string; fetch?: typeof fetch };

export function parseSandboxConfig(env: { SANDBOX_URL?: string; SANDBOX_TOKEN?: string }): RemoteSandboxConfig {
  if (!env.SANDBOX_URL || !env.SANDBOX_TOKEN) throw new SandboxError('NOT_CONFIGURED', 'SANDBOX_URL and SANDBOX_TOKEN must be set as server-side configuration.');
  const u = new URL(env.SANDBOX_URL);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.username || u.password || (u.protocol !== 'https:' && !(local && u.protocol === 'http:'))) {
    throw new SandboxError('NOT_CONFIGURED', 'SANDBOX_URL must be HTTPS without credentials (HTTP only for localhost).');
  }
  return { url: u.origin, token: env.SANDBOX_TOKEN };
}

/** Talks to an external isolated runner. It validates the response and never falls back to local execution. */
export class RemoteSandboxClient implements SandboxRunner {
  readonly name = 'remote-sandbox';
  constructor(private readonly config: RemoteSandboxConfig) {}

  async run(request: SandboxRequest, signal?: AbortSignal): Promise<SandboxResult> {
    validateSandboxRequest(request);
    const timeout = AbortSignal.timeout(request.timeoutMs + 15_000);
    let res: Response;
    try {
      res = await (this.config.fetch ?? fetch)(`${this.config.url}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      throw new SandboxError('UPSTREAM', `Sandbox unreachable: ${e instanceof Error ? e.name : 'error'}`);
    }
    if (!res.ok) throw new SandboxError('UPSTREAM', `Sandbox returned ${res.status}.`);
    return validateSandboxResult(await res.json().catch(() => null));
  }
}
