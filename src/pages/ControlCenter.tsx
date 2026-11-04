import { useCallback, useEffect, useState } from 'react';
import { PageHero, PageSection, StatusPill } from '../components/ui';
import { PERMISSION_LEVELS } from '../core';

type Product = { id: string; name: string; description: string; integrationStatus: string; maxPermissionLevel: number; authMethod: string; health: { status: string } };
type Integration = { status: string; detail: string; checkedAt: string | null };
type Stage = { id: string; title?: string; status: string; error?: string | null };
type Workflow = { id: string; objective: string; status: string; productId?: string; grantedLevel: number; stages: Stage[]; pendingApproval?: { stageId: string; digest: string } | null };
type Approval = { workflowId: string; objective: string; stageId: string; digest: string; review: Record<string, unknown> };
type Session = { email: string; roles: string[] };
type Data = { products: Product[]; integrations: Record<string, Integration>; workflows: Workflow[]; approvals: Approval[] };

async function get<T>(path: string): Promise<{ status: number; body: T | null }> {
  const res = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
  return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
}

const tone = (s: string) => (s === 'healthy' || s === 'completed' ? 'success' : s === 'not-configured' || s === 'pending' || s === 'cancelled' ? 'neutral' : 'warning');

/** Live view: every figure comes from the authenticated /api/* routes. Nothing is shown unless the API returned it. */
export function ControlCenterPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await get<Session>('/api/session');
      if (s.status === 401) return setProblem('Not authenticated. Sign in through Cloudflare Access to view live data.');
      if (s.status === 503) return setProblem('The API is closed: Cloudflare Access (ACCESS_TEAM_DOMAIN / ACCESS_AUD) is not configured on this deployment.');
      if (!s.body) return setProblem(`Session check failed (HTTP ${s.status}).`);
      setSession(s.body);
      const [p, i, w, a] = await Promise.all([
        get<{ products: Product[] }>('/api/products'), get<{ integrations: Record<string, Integration> }>('/api/integrations'),
        get<{ workflows: Workflow[] }>('/api/workflows'), get<{ approvals: Approval[] }>('/api/approvals'),
      ]);
      if (p.status === 403 || w.status === 403) return setProblem('Your identity is authenticated but not allowed to view orchestration data (EUREKA_VIEWERS / OPERATORS / APPROVERS).');
      if (w.status === 503) return setProblem('Persistence is not configured: the D1 binding "DB" is missing on this deployment.');
      setProblem(null);
      setData({ products: p.body?.products ?? [], integrations: i.body?.integrations ?? {}, workflows: w.body?.workflows ?? [], approvals: a.body?.approvals ?? [] });
    } catch {
      setProblem('The API could not be reached.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (a: Approval, verb: 'approve' | 'reject') => {
    setBusy(a.workflowId);
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(a.workflowId)}/${verb}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verb === 'approve' ? { stageId: a.stageId, digest: a.digest } : { stageId: a.stageId, reason: 'Rejected from Control Center' }),
      });
      if (!res.ok) setProblem(`${verb} refused (HTTP ${res.status}).`);
    } finally {
      setBusy(null);
      await load();
    }
  };
  const canApprove = session?.roles.includes('approver') ?? false;

  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='EUREKACORE CONTROL CENTER'
        title='Live registry, workflows, integration health and approvals.'
        description={session ? `Signed in as ${session.email} (${session.roles.join(', ')}). Data is fetched from the authenticated API; approvals are bound to your verified identity server-side.` : 'Data is fetched from the authenticated API. Nothing is shown unless the server returns it.'}
      />
      {problem && <PageSection><p role='alert' className='text-sm text-amber-100'>{problem}</p></PageSection>}

      {data && (<>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Pending approvals ({data.approvals.length})</p>
          {data.approvals.length === 0 && <p className='mt-3 text-sm text-white/60'>No workflow is waiting for approval.</p>}
          {data.approvals.map((a) => (
            <article key={a.workflowId} className='mt-3 rounded-2xl border border-amber-300/30 bg-black/20 p-4'>
              <h2 className='font-semibold text-white'>{a.workflowId} · {a.stageId}</h2>
              <p className='mt-2 text-sm text-white/65'>{a.objective}</p>
              <details className='mt-2 text-xs text-white/60'><summary>Review package (digest {a.digest.slice(0, 12)}…)</summary><pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap'>{JSON.stringify(a.review, null, 2)}</pre></details>
              {canApprove
                ? <div className='mt-3 flex gap-2'>
                    <button disabled={busy === a.workflowId} onClick={() => void act(a, 'approve')} className='rounded-full border border-emerald-400/40 px-4 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200'>Approve</button>
                    <button disabled={busy === a.workflowId} onClick={() => void act(a, 'reject')} className='rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/75'>Reject</button>
                  </div>
                : <p className='mt-3 text-xs text-white/50'>Your account lacks the approver role.</p>}
            </article>
          ))}
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Integration health</p>
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            {Object.entries(data.integrations).map(([k, v]) => (
              <article key={k} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
                <div className='flex items-center justify-between gap-2'><h2 className='font-semibold text-white'>{k}</h2><StatusPill tone={tone(v.status)}>{v.status}</StatusPill></div>
                <p className='mt-2 text-sm text-white/65'>{v.detail}</p>
                <p className='mt-1 text-xs text-white/40'>{v.checkedAt ? `Probed ${v.checkedAt}` : 'Not probed'}</p>
              </article>
            ))}
          </div>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Workflows ({data.workflows.length})</p>
          {data.workflows.length === 0 && <p className='mt-3 text-sm text-white/60'>No workflows exist yet.</p>}
          <div className='mt-4 grid gap-3'>
            {data.workflows.map((w) => (
              <article key={w.id} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
                <div className='flex items-center justify-between gap-2'><h2 className='font-semibold text-white'>{w.id}</h2><StatusPill tone={tone(w.status)}>{w.status}</StatusPill></div>
                <p className='mt-2 text-sm text-white/65'>{w.objective}</p>
                <ol className='mt-3 flex flex-wrap gap-2'>
                  {w.stages.map((st) => <li key={st.id} title={st.error ?? undefined}><StatusPill tone={tone(st.status)}>{st.id}: {st.status}</StatusPill></li>)}
                </ol>
              </article>
            ))}
          </div>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Registered products</p>
          <div className='mt-4 grid gap-3 md:grid-cols-2'>
            {data.products.map((p) => (
              <article key={p.id} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
                <div className='flex items-center justify-between gap-2'><h2 className='font-semibold text-white'>{p.name}</h2><StatusPill tone={p.integrationStatus === 'not-integrated' ? 'neutral' : 'warning'}>{p.integrationStatus}</StatusPill></div>
                <p className='mt-3 text-sm leading-6 text-white/65'>{p.description}</p>
                <p className='mt-2 text-xs text-white/50'>Health: {p.health.status} · Max level: {p.maxPermissionLevel} · Auth: {p.authMethod}</p>
              </article>
            ))}
          </div>
        </PageSection>
      </>)}

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Permission tiers</p>
        <ol className='mt-4 grid gap-2 text-sm text-white/70'>
          {Object.entries(PERMISSION_LEVELS).map(([level, t]) => (
            <li key={level}>Level {level} · <span className='text-white'>{t.name}</span>: {t.summary}</li>
          ))}
        </ol>
      </PageSection>
    </div>
  );
}
