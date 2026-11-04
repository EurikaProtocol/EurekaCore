/**
 * Minimal, deliberately restricted GitHub client (REST v3, fetch-based, Worker-safe).
 * Guardrails enforced here, independent of callers:
 *  - only repositories on an explicit allowlist;
 *  - writes only to branches named `eureka/...` that are not the default branch;
 *  - no merge, no force update, no delete, no repository administration methods exist.
 * The token is a server-side secret and never appears in errors or results.
 */
export type RepoRef = { owner: string; name: string };

export class GitHubError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'FORBIDDEN' | 'INVALID' | 'UPSTREAM' | 'NOT_FOUND', message: string) {
    super(message);
    this.name = 'GitHubError';
  }
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH = /^eureka\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
export const MAX_FILE_BYTES = 200_000;

export function parseRepo(input: string): RepoRef {
  const m = /^(?:https:\/\/github\.com\/)?([A-Za-z0-9._-]{1,100})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(input.trim());
  if (!m || m[1] === '.' || m[1] === '..' || m[2] === '.' || m[2] === '..') throw new GitHubError('INVALID', 'Invalid repository reference.');
  return { owner: m[1], name: m[2] };
}

export const repoKey = (r: RepoRef) => `${r.owner}/${r.name}`.toLowerCase();

export function isSafeBranchName(name: string): boolean {
  return name.length <= 200 && BRANCH.test(name) && !name.includes('..') && !name.endsWith('.lock') && !name.endsWith('/') && !name.endsWith('.');
}

/** Generated file paths must be relative, normalised and outside CI, git and dependency directories. */
export function isSafeFilePath(path: string): boolean {
  if (typeof path !== 'string' || !path || path.length > 200 || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  const parts = path.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || !/^[A-Za-z0-9._@+-]+$/.test(p))) return false;
  const lower = parts.map((p) => p.toLowerCase());
  if (lower.some((p) => ['.git', '.github', '.gitmodules', 'node_modules', '.env'].includes(p) || p.startsWith('.env'))) return false;
  return true;
}

export type GitHubConfig = { token: string; allowedRepos: string[]; fetch?: typeof fetch; apiBase?: string; timeoutMs?: number };

export function parseGitHubConfig(env: { GITHUB_TOKEN?: string; GITHUB_ALLOWED_REPOS?: string }): GitHubConfig {
  const token = env.GITHUB_TOKEN?.trim();
  const allowed = (env.GITHUB_ALLOWED_REPOS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !allowed.length) throw new GitHubError('NOT_CONFIGURED', 'GITHUB_TOKEN and GITHUB_ALLOWED_REPOS must be set as server-side configuration.');
  return { token, allowedRepos: allowed.map((r) => repoKey(parseRepo(r))) };
}

export class GitHubClient {
  private readonly allowed: Set<string>;
  private readonly base: string;
  constructor(private readonly config: GitHubConfig) {
    this.allowed = new Set(config.allowedRepos.map((r) => repoKey(parseRepo(r))));
    this.base = config.apiBase ?? 'https://api.github.com';
  }

  private assertAllowed(repo: RepoRef) {
    if (!SEGMENT.test(repo.owner) || !SEGMENT.test(repo.name) || !this.allowed.has(repoKey(repo))) {
      throw new GitHubError('FORBIDDEN', `Repository ${repo.owner}/${repo.name} is not on the allowlist.`);
    }
  }

  private async api<T>(method: string, path: string, body?: unknown, okStatuses: number[] = [200, 201]): Promise<{ status: number; data: T | null }> {
    let res: Response;
    try {
      res = await (this.config.fetch ?? fetch)(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'EurekaCore',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      });
    } catch (e) {
      throw new GitHubError('UPSTREAM', `GitHub request failed: ${e instanceof Error ? e.name : 'error'}`);
    }
    if (res.status === 404 && okStatuses.includes(404)) return { status: 404, data: null };
    if (!okStatuses.includes(res.status)) {
      throw new GitHubError(res.status === 404 ? 'NOT_FOUND' : 'UPSTREAM', `GitHub ${method} ${path.split('?')[0]} returned ${res.status}.`);
    }
    return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
  }

  private p(repo: RepoRef) {
    return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  }

  async getRepo(repo: RepoRef) {
    this.assertAllowed(repo);
    const { data } = await this.api<{ default_branch: string; private: boolean; full_name: string; archived: boolean }>('GET', this.p(repo));
    if (!data || typeof data.default_branch !== 'string') throw new GitHubError('UPSTREAM', 'Unexpected repository response.');
    return { fullName: data.full_name, defaultBranch: data.default_branch, private: data.private, archived: data.archived };
  }

  /** Returns the branch head SHA, or null if the branch does not exist. */
  async getBranchSha(repo: RepoRef, branch: string): Promise<string | null> {
    this.assertAllowed(repo);
    const { data } = await this.api<{ object: { sha: string } }>('GET', `${this.p(repo)}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, undefined, [200, 404]);
    return data?.object?.sha ?? null;
  }

  async createBranch(repo: RepoRef, name: string) {
    this.assertAllowed(repo);
    if (!isSafeBranchName(name)) throw new GitHubError('FORBIDDEN', 'Branch names must look like "eureka/<name>".');
    const info = await this.getRepo(repo);
    if (info.archived) throw new GitHubError('FORBIDDEN', 'Repository is archived.');
    if (name === info.defaultBranch) throw new GitHubError('FORBIDDEN', 'Refusing to touch the default branch.');
    const base = await this.getBranchSha(repo, info.defaultBranch);
    if (!base) throw new GitHubError('UPSTREAM', 'Default branch not found.');
    const existing = await this.getBranchSha(repo, name);
    if (existing) return { branch: name, sha: existing, baseBranch: info.defaultBranch, created: false };
    const { data } = await this.api<{ object: { sha: string } }>('POST', `${this.p(repo)}/git/refs`, { ref: `refs/heads/${name}`, sha: base });
    return { branch: name, sha: data?.object?.sha ?? base, baseBranch: info.defaultBranch, created: true };
  }

  /** Creates or updates one file on a non-default `eureka/` branch. Returns the new commit SHA. */
  async putFile(repo: RepoRef, branch: string, path: string, content: string, message: string) {
    this.assertAllowed(repo);
    if (!isSafeBranchName(branch)) throw new GitHubError('FORBIDDEN', 'Writes are only allowed on "eureka/" branches.');
    if (!isSafeFilePath(path)) throw new GitHubError('FORBIDDEN', `Unsafe file path: ${path}`);
    if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) throw new GitHubError('INVALID', 'File too large.');
    const info = await this.getRepo(repo);
    if (branch === info.defaultBranch) throw new GitHubError('FORBIDDEN', 'Refusing to write to the default branch.');
    const encPath = path.split('/').map(encodeURIComponent).join('/');
    const existing = await this.api<{ sha: string }>('GET', `${this.p(repo)}/contents/${encPath}?ref=${encodeURIComponent(branch)}`, undefined, [200, 404]);
    const bytes = new TextEncoder().encode(content);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const { data } = await this.api<{ commit: { sha: string } }>('PUT', `${this.p(repo)}/contents/${encPath}`, {
      message: message.slice(0, 200), content: btoa(bin), branch, ...(existing.data?.sha ? { sha: existing.data.sha } : {}),
    });
    if (!data?.commit?.sha) throw new GitHubError('UPSTREAM', 'Commit SHA missing from response.');
    return { path, commitSha: data.commit.sha };
  }

  /** Reads a file's text from a branch; null if absent. Used to verify what was actually committed. */
  async getFileText(repo: RepoRef, branch: string, path: string): Promise<string | null> {
    this.assertAllowed(repo);
    if (!isSafeFilePath(path)) throw new GitHubError('INVALID', 'Unsafe file path.');
    const encPath = path.split('/').map(encodeURIComponent).join('/');
    const { data } = await this.api<{ content?: string; encoding?: string }>('GET', `${this.p(repo)}/contents/${encPath}?ref=${encodeURIComponent(branch)}`, undefined, [200, 404]);
    if (!data || data.encoding !== 'base64' || typeof data.content !== 'string') return null;
    return new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  }

  /** Opens a DRAFT pull request from an `eureka/` branch into the default branch. There is no merge method. */
  async createDraftPullRequest(repo: RepoRef, head: string, title: string, body: string) {
    this.assertAllowed(repo);
    if (!isSafeBranchName(head)) throw new GitHubError('FORBIDDEN', 'Pull requests may only come from "eureka/" branches.');
    const info = await this.getRepo(repo);
    const { data } = await this.api<{ number: number; html_url: string; draft: boolean }>('POST', `${this.p(repo)}/pulls`, {
      title: title.slice(0, 200), body: body.slice(0, 20_000), head, base: info.defaultBranch, draft: true,
    });
    if (!data || typeof data.number !== 'number') throw new GitHubError('UPSTREAM', 'Unexpected pull request response.');
    return { number: data.number, url: data.html_url, draft: data.draft, base: info.defaultBranch };
  }

  async getPullRequest(repo: RepoRef, number: number) {
    this.assertAllowed(repo);
    if (!Number.isInteger(number) || number < 1) throw new GitHubError('INVALID', 'Invalid pull request number.');
    const { data } = await this.api<{ number: number; state: string; merged: boolean; draft: boolean; html_url: string; head: { ref: string } }>('GET', `${this.p(repo)}/pulls/${number}`);
    if (!data) throw new GitHubError('UPSTREAM', 'Unexpected pull request response.');
    return { number: data.number, state: data.state, merged: data.merged === true, draft: data.draft === true, url: data.html_url, headRef: data.head?.ref };
  }
}
