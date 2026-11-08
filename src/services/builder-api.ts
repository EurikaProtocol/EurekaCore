import type {
  BuilderProjectView, HistoryEntryView, IntegrationState, IntegrationStatusView,
} from '../core/builder-project';

export type Session = { email: string; roles: string[] };
export class ApiProblem extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

/** Same-origin calls only. Identity comes from the Cloudflare Access cookie; the browser never sends an owner or user id. */
async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method, credentials: 'include',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiProblem(0, 'NETWORK', 'EUREKA CORE could not be reached.');
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    const fallback = res.status === 401 ? 'Not authenticated. Sign in through Cloudflare Access.' : res.status === 403 ? 'Your account is not permitted to do this.' : `Request failed (HTTP ${res.status}).`;
    throw new ApiProblem(res.status, j?.code ?? `HTTP_${res.status}`, j?.error ?? fallback);
  }
  return (await res.json()) as T;
}

export type ProjectResponse = { project: BuilderProjectView; integration?: { state: IntegrationState; message: string } };

export const builderApi = {
  session: () => request<Session>('GET', '/api/session'),
  status: () => request<{ integration: IntegrationStatusView }>('GET', '/api/builder/status').then((r) => r.integration),
  list: () => request<{ projects: BuilderProjectView[] }>('GET', '/api/builder/projects').then((r) => r.projects),
  create: (name: string, requirements: string) => request<{ project: BuilderProjectView }>('POST', '/api/builder/projects', { name, requirements }).then((r) => r.project),
  get: (id: string) => request<ProjectResponse>('GET', `/api/builder/projects/${encodeURIComponent(id)}`),
  approve: (id: string, planDigest: string) => request<{ project: BuilderProjectView }>('POST', `/api/builder/projects/${encodeURIComponent(id)}/approve`, { planDigest }).then((r) => r.project),
  cancel: (id: string) => request<{ project: BuilderProjectView }>('POST', `/api/builder/projects/${encodeURIComponent(id)}/cancel`, {}).then((r) => r.project),
  retry: (id: string) => request<{ project: BuilderProjectView }>('POST', `/api/builder/projects/${encodeURIComponent(id)}/retry`, {}).then((r) => r.project),
  file: (id: string, path: string) => request<{ file: { path: string; content: string; bytes: number; sha256: string } }>('GET', `/api/builder/projects/${encodeURIComponent(id)}/file?path=${encodeURIComponent(path)}`).then((r) => r.file),
  history: (id?: string) => request<{ history: HistoryEntryView[] }>('GET', id ? `/api/builder/projects/${encodeURIComponent(id)}/history` : '/api/builder/history').then((r) => r.history),
  exportUrl: (id: string) => `/api/builder/projects/${encodeURIComponent(id)}/export`,
};
