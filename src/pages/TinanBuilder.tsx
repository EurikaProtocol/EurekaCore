import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { PageHero, PageSection, StatusPill, classNames } from '../components/ui';
import {
  BUILDER_TERMINAL, MAX_BUILDER_ATTEMPTS, STATUS_LABEL,
  type BuilderProjectView, type BuilderUiStatus, type HistoryEntryView, type IntegrationState, type IntegrationStatusView,
} from '../core/builder-project';
import { ApiProblem, builderApi, type Session } from '../services/builder-api';

const POLL_MS = 4000;
const MAX_REQUIREMENTS = 4000;
const TABS = [
  ['/tinan-ai/builder', 'AI Builder'],
  ['/tinan-ai/projects', 'My Projects'],
  ['/tinan-ai/tasks', 'Generation Tasks'],
  ['/tinan-ai/history', 'AI History'],
  ['/tinan-ai/integrations', 'Integrations'],
] as const;

const statusTone = (s: BuilderUiStatus) => (s === 'completed' ? 'success' : s === 'failed' ? 'warning' : s === 'cancelled' ? 'neutral' : 'warning');
const INTEGRATION_LABEL: Record<IntegrationState, string> = { connected: 'Connected', authentication_failed: 'Authentication failed', unavailable: 'TINAN AI unavailable', not_configured: 'Not configured' };

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { builderApi.session().then(setSession).catch((e: ApiProblem) => setProblem(e.message)); }, []);
  return { session, problem, canOperate: !!session?.roles.includes('operator'), canApprove: !!session?.roles.includes('approver') };
}

/** Polls `load` while `active`, never overlapping requests and always cleaning up. */
function usePoll(load: () => Promise<void>, active: boolean) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      await ref.current();
      if (!stop && active) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [active]);
}

function Shell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='TINAN AI × EUREKA CORE' title={title} description={description} />
      <nav aria-label='TINAN AI' className='flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 text-sm'>
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => classNames('flex min-h-11 items-center rounded-xl px-4 transition', isActive ? 'bg-tinan-turquoise text-black' : 'text-white/75 hover:bg-white/10')}>{label}</NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}

function Problem({ message }: { message: string | null }) {
  return message ? <PageSection><p role='alert' className='text-sm text-amber-100'>{message}</p></PageSection> : null;
}

function IntegrationBanner() {
  const [s, setS] = useState<IntegrationStatusView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { builderApi.status().then(setS).catch((e: ApiProblem) => setErr(e.message)); }, []);
  if (err) return <Problem message={err} />;
  if (!s) return null;
  return (
    <PageSection className='p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-white/75'>TINAN AI service: {s.detail}</p>
        <StatusPill tone={s.state === 'connected' ? 'success' : 'warning'}>{INTEGRATION_LABEL[s.state]}</StatusPill>
      </div>
    </PageSection>
  );
}

function ProjectCard({ p, onCancel, canOperate }: { p: BuilderProjectView; onCancel?: (id: string) => void; canOperate?: boolean }) {
  return (
    <article className='rounded-2xl border border-white/10 bg-black/20 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='font-semibold text-white'><Link className='hover:text-tinan-turquoise' to={`/tinan-ai/projects/${p.id}`}>{p.name}</Link></h2>
        <StatusPill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</StatusPill>
      </div>
      <p className='mt-2 line-clamp-2 text-sm text-white/65'>{p.requirements}</p>
      <p className='mt-2 text-xs text-white/45'>Attempt {p.attempt}/{p.maxAttempts} · updated {new Date(p.updatedAt).toLocaleString()}</p>
      <div className='mt-3 flex flex-wrap gap-2'>
        <Link className='eu-btn-ghost' to={`/tinan-ai/projects/${p.id}`}>Open workspace</Link>
        {onCancel && canOperate && !BUILDER_TERMINAL.includes(p.status) ? <button className='eu-btn-ghost' type='button' onClick={() => onCancel(p.id)}>Cancel task</button> : null}
      </div>
    </article>
  );
}

export function BuilderHomePage() {
  const nav = useNavigate();
  const { canOperate, problem } = useSession();
  const [name, setName] = useState('');
  const [requirements, setRequirements] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const p = await builderApi.create(name, requirements);
      nav(`/tinan-ai/projects/${p.id}`);
    } catch (x) {
      setErr(x instanceof ApiProblem ? x.message : 'Could not create the project.');
      setBusy(false);
    }
  };

  return (
    <Shell title='AI Builder' description='Describe a project. TINAN AI plans it; you review the exact plan and approve it before anything is generated. Files are only shown after EUREKA CORE verifies the manifest and every SHA-256 hash.'>
      <IntegrationBanner />
      <Problem message={problem} />
      <PageSection>
        <form className='grid gap-4' onSubmit={(e) => void submit(e)}>
          <label className='grid gap-1 text-sm text-white/80'>Project name
            <input className='min-h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-white' maxLength={80} onChange={(e) => setName(e.target.value)} required value={name} />
          </label>
          <label className='grid gap-1 text-sm text-white/80'>AI requirements
            <textarea className='min-h-48 rounded-xl border border-white/15 bg-black/30 p-3 text-white' maxLength={MAX_REQUIREMENTS} onChange={(e) => setRequirements(e.target.value)} required value={requirements} />
            <span className='text-xs text-white/45'>{requirements.length}/{MAX_REQUIREMENTS}</span>
          </label>
          {err ? <p role='alert' className='text-sm text-amber-100'>{err}</p> : null}
          {!canOperate ? <p className='text-xs text-white/50'>Your account needs the operator role to create projects.</p> : null}
          <div><button className='eu-btn-primary' disabled={busy || !canOperate || !name.trim() || !requirements.trim()} type='submit'>{busy ? 'Submitting…' : 'Create project and request plan'}</button></div>
        </form>
      </PageSection>
      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>How a project moves</p>
        <ol className='mt-3 grid gap-2 text-sm text-white/70 md:grid-cols-2'>
          <li>1 · Requirements are sent server-to-server to TINAN AI (no credentials in your browser).</li>
          <li>2 · TINAN AI returns a plan; EUREKA CORE computes its SHA-256 digest.</li>
          <li>3 · An approver reviews and approves that exact digest. Nothing generates earlier.</li>
          <li>4 · EUREKA CORE verifies the manifest digest and each file hash before showing or exporting files.</li>
        </ol>
      </PageSection>
    </Shell>
  );
}

export function BuilderProjectsPage() {
  const [projects, setProjects] = useState<BuilderProjectView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { try { setProjects(await builderApi.list()); setErr(null); } catch (e) { setErr(e instanceof ApiProblem ? e.message : 'Could not load projects.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <Shell title='My Projects' description='Projects you own. Other users cannot see or open them.'>
      <Problem message={err} />
      <PageSection>
        <div className='flex items-center justify-between'><p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Projects ({projects?.length ?? 0})</p><Link className='eu-btn-primary' to='/tinan-ai/builder'>New project</Link></div>
        {projects && projects.length === 0 ? <p className='mt-3 text-sm text-white/60'>You have no TINAN AI projects yet.</p> : null}
        <div className='mt-4 grid gap-3 md:grid-cols-2'>{projects?.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
      </PageSection>
    </Shell>
  );
}

export function BuilderTasksPage() {
  const { canOperate } = useSession();
  const [projects, setProjects] = useState<BuilderProjectView[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const list = await builderApi.list();
      // The list endpoint returns stored state; open tasks are synchronised with TINAN AI one by one.
      const synced = await Promise.all(list.map(async (p) => (BUILDER_TERMINAL.includes(p.status) ? p : (await builderApi.get(p.id)).project)));
      setProjects(synced); setErr(null);
    } catch (e) { setErr(e instanceof ApiProblem ? e.message : 'Could not load tasks.'); }
  }, []);
  usePoll(load, true);
  const cancel = async (id: string) => { try { await builderApi.cancel(id); await load(); } catch (e) { setErr(e instanceof ApiProblem ? e.message : 'Cancel failed.'); } };
  const open = projects.filter((p) => !BUILDER_TERMINAL.includes(p.status));
  const done = projects.filter((p) => BUILDER_TERMINAL.includes(p.status));
  return (
    <Shell title='Generation Tasks' description='Live status of TINAN AI tasks, refreshed from the service. Cancelling is only shown once TINAN AI confirms it.'>
      <Problem message={err} />
      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Active ({open.length})</p>
        {open.length === 0 ? <p className='mt-3 text-sm text-white/60'>No active tasks.</p> : null}
        <div className='mt-4 grid gap-3 md:grid-cols-2'>{open.map((p) => <ProjectCard key={p.id} p={p} canOperate={canOperate} onCancel={(id) => void cancel(id)} />)}</div>
      </PageSection>
      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Finished ({done.length})</p>
        <div className='mt-4 grid gap-3 md:grid-cols-2'>{done.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
      </PageSection>
    </Shell>
  );
}

function HistoryTable({ rows }: { rows: HistoryEntryView[] }) {
  if (!rows.length) return <p className='mt-3 text-sm text-white/60'>No recorded events.</p>;
  return (
    <div className='mt-3 overflow-x-auto'>
      <table className='w-full text-left text-xs text-white/70'>
        <thead><tr className='text-white/45'><th className='py-1 pr-3'>Time</th><th className='pr-3'>Action</th><th className='pr-3'>Actor</th><th>Project</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={`${r.projectId}-${r.at}-${i}`} className='border-t border-white/10'>
            <td className='py-1 pr-3'>{new Date(r.at).toLocaleString()}</td><td className='pr-3'>{r.action}</td><td className='pr-3'>{r.actor}</td>
            <td><Link className='hover:text-tinan-turquoise' to={`/tinan-ai/projects/${r.projectId}`}>{r.projectId.slice(0, 11)}…</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function BuilderHistoryPage() {
  const [rows, setRows] = useState<HistoryEntryView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { builderApi.history().then(setRows).catch((e: ApiProblem) => setErr(e.message)); }, []);
  return (
    <Shell title='AI History' description='Hash-chained audit events for your TINAN AI projects: creation, approvals, cancellations, retries and exports.'>
      <Problem message={err} />
      <PageSection><HistoryTable rows={rows ?? []} /></PageSection>
    </Shell>
  );
}

export function BuilderIntegrationsPage() {
  const [s, setS] = useState<IntegrationStatusView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { try { setS(await builderApi.status()); setErr(null); } catch (e) { setErr(e instanceof ApiProblem ? e.message : 'Could not check the integration.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <Shell title='Integrations' description='EUREKA CORE decides who you are and what you may do. TINAN AI only plans and generates, over an authenticated server-to-server connection.'>
      <Problem message={err} />
      {s ? (
        <PageSection>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='text-xl font-semibold text-white'>TINAN AI Builder service</h2>
            <StatusPill tone={s.state === 'connected' ? 'success' : 'warning'}>{INTEGRATION_LABEL[s.state]}</StatusPill>
          </div>
          <p className='mt-2 text-sm text-white/70'>{s.detail}</p>
          <dl className='mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-3'>
            <div><dt className='text-tinan-cyan'>Contract</dt><dd>Builder v{s.contractVersion}</dd></div>
            <div><dt className='text-tinan-cyan'>Transport</dt><dd>{s.transport === 'service-binding' ? 'Cloudflare Service Binding' : 'Authenticated HTTPS'}</dd></div>
            <div><dt className='text-tinan-cyan'>Ownership</dt><dd>{s.authMode === 'delegated' ? 'Per-user (signed delegation)' : 'Single TINAN AI owner; isolation enforced by EUREKA CORE'}</dd></div>
          </dl>
          <p className='mt-3 text-xs text-white/45'>Checked {new Date(s.checkedAt).toLocaleString()}</p>
          <button className='eu-btn-ghost mt-3' onClick={() => void load()} type='button'>Re-check</button>
        </PageSection>
      ) : null}
      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Responsibilities</p>
        <div className='mt-3 grid gap-3 text-sm text-white/70 md:grid-cols-2'>
          <div><h3 className='font-semibold text-white'>EUREKA CORE</h3><p>Identity, authorization, project ownership, approval authority, audit log, workflow control and this interface.</p></div>
          <div><h3 className='font-semibold text-white'>TINAN AI</h3><p>AI reasoning, planning, code generation, file creation, testing, error repair and project export.</p></div>
        </div>
      </PageSection>
    </Shell>
  );
}

const STEPS: BuilderUiStatus[] = ['queued', 'planning', 'awaiting_approval', 'generating', 'validating', 'completed'];

function Progress({ status, attempts }: { status: BuilderUiStatus; attempts: number }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol aria-label='Generation progress' className='flex flex-wrap gap-2'>
      {STEPS.map((s, i) => (
        <li key={s}><StatusPill tone={status === s ? statusTone(s) : idx > i || status === 'completed' ? 'success' : 'neutral'}>{status === s ? '● ' : ''}{STATUS_LABEL[s]}</StatusPill></li>
      ))}
      {status === 'failed' || status === 'cancelled' ? <li><StatusPill tone={statusTone(status)}>● {STATUS_LABEL[status]} (attempt {attempts})</StatusPill></li> : null}
    </ol>
  );
}

export function BuilderProjectPage() {
  const { id = '' } = useParams();
  const { canOperate, canApprove } = useSession();
  const [p, setP] = useState<BuilderProjectView | null>(null);
  const [integration, setIntegration] = useState<{ state: IntegrationState; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState<{ path: string; content: string; sha256: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntryView[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await builderApi.get(id);
      setP(r.project); setIntegration(r.integration ?? null); setErr(null);
    } catch (e) { setErr(e instanceof ApiProblem ? (e.status === 404 ? 'Project not found.' : e.message) : 'Could not load the project.'); }
  }, [id]);
  usePoll(load, !p || !BUILDER_TERMINAL.includes(p.status));
  useEffect(() => { builderApi.history(id).then(setHistory).catch(() => setHistory([])); }, [id, p?.status, p?.approval?.at]);
  useEffect(() => { setReviewed(false); }, [p?.planDigest]);

  const run = async (label: string, fn: () => Promise<BuilderProjectView>) => {
    setBusy(label); setErr(null);
    try { setP(await fn()); } catch (e) { setErr(e instanceof ApiProblem ? e.message : `${label} failed.`); }
    setBusy(null);
  };
  const view = async (path: string) => {
    setErr(null);
    try { setPreview(await builderApi.file(id, path)); } catch (e) { setPreview(null); setErr(e instanceof ApiProblem ? e.message : 'Could not load the file.'); }
  };

  if (!p) return <Shell title='Project workspace' description='Loading the project from EUREKA CORE.'><Problem message={err} /></Shell>;
  const terminal = BUILDER_TERMINAL.includes(p.status);
  return (
    <Shell title={p.name} description={`Project workspace · attempt ${p.attempt} of ${MAX_BUILDER_ATTEMPTS}`}>
      <Problem message={err} />
      {integration ? <PageSection><p role='alert' className='text-sm text-amber-100'>{INTEGRATION_LABEL[integration.state]}: {integration.message} The task state shown is the last confirmed one.</p></PageSection> : null}
      <PageSection>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Progress attempts={p.attempt} status={p.status} />
          <div className='flex flex-wrap gap-2'>
            {canOperate && !terminal ? <button className='eu-btn-ghost' disabled={!!busy} onClick={() => void run('Cancel', () => builderApi.cancel(p.id))} type='button'>Cancel task</button> : null}
            {canOperate && (p.status === 'failed' || p.status === 'cancelled') && p.attempt < p.maxAttempts ? <button className='eu-btn-ghost' disabled={!!busy} onClick={() => void run('Retry', () => builderApi.retry(p.id))} type='button'>Retry task</button> : null}
            {p.status === 'completed' ? <a className='eu-btn-primary' href={builderApi.exportUrl(p.id)}>Download ZIP</a> : null}
          </div>
        </div>
        {p.errors.length ? (
          <div role='alert' className='mt-4 rounded-2xl border border-amber-300/30 bg-black/20 p-4'>
            <p className='text-sm font-semibold text-amber-100'>{p.status === 'failed' ? 'The task failed' : 'Reported errors'}</p>
            <ul className='mt-2 list-disc pl-5 text-sm text-white/75'>{p.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        ) : null}
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Requirements</p>
        <p className='mt-2 whitespace-pre-wrap text-sm text-white/75'>{p.requirements}</p>
      </PageSection>

      {p.plan ? (
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Project plan</p>
          <p className='mt-2 text-sm text-white/85'>{p.plan.summary}</p>
          <div className='mt-3 grid gap-3 md:grid-cols-3 text-sm text-white/70'>
            <div><h3 className='font-semibold text-white'>Technology</h3><ul className='list-disc pl-5'>{p.plan.technology.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
            <div><h3 className='font-semibold text-white'>Features</h3><ul className='list-disc pl-5'>{p.plan.features.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
            <div><h3 className='font-semibold text-white'>Steps</h3><ol className='list-decimal pl-5'>{p.plan.steps.map((t, i) => <li key={i}>{t}</li>)}</ol></div>
          </div>
          <p className='mt-3 break-all text-xs text-white/50'>Plan digest (SHA-256, computed by EUREKA CORE): {p.planDigest}</p>
          {p.status === 'awaiting_approval' ? (
            <div className='mt-4 rounded-2xl border border-amber-300/30 bg-black/20 p-4'>
              <p className='text-sm text-white/80'>Approval is required before TINAN AI generates any file. Your approval is bound to the digest above and recorded under your verified identity.</p>
              {canApprove ? (
                <>
                  <label className='mt-3 flex items-start gap-2 text-sm text-white/80'><input checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} type='checkbox' className='mt-1' />I reviewed this exact plan and approve generation.</label>
                  <button className='eu-btn-primary mt-3' disabled={!reviewed || !!busy} onClick={() => void run('Approve', () => builderApi.approve(p.id, p.planDigest as string))} type='button'>{busy === 'Approve' ? 'Approving…' : 'Approve plan'}</button>
                </>
              ) : <p className='mt-3 text-xs text-white/50'>Your account lacks the approver role.</p>}
            </div>
          ) : null}
          {p.approval ? <p className='mt-3 text-xs text-emerald-200'>Approved by {p.approval.approvedBy} at {new Date(p.approval.at).toLocaleString()}{p.approval.forwarded ? ' and forwarded to TINAN AI.' : '; not yet forwarded to TINAN AI.'}</p> : null}
        </PageSection>
      ) : null}

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Build and validation status</p>
        {p.validation ? (
          <>
            <div className='mt-3 flex flex-wrap gap-2'>
              <StatusPill tone={p.validation.passed ? 'success' : 'warning'}>Verification {p.validation.passed ? 'passed' : 'failed'}</StatusPill>
              <StatusPill tone={p.validation.manifestDigestMatches ? 'success' : 'warning'}>Manifest digest</StatusPill>
              <StatusPill tone={p.validation.planDigestMatchesApproval ? 'success' : 'warning'}>Approved plan digest</StatusPill>
              <StatusPill tone={p.validation.fileSetMatches ? 'success' : 'warning'}>File set</StatusPill>
            </div>
            {p.validation.problems.length ? <ul className='mt-3 list-disc pl-5 text-sm text-amber-100'>{p.validation.problems.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
          </>
        ) : <p className='mt-3 text-sm text-white/60'>{p.status === 'completed' ? 'No verification report.' : 'Verification runs after TINAN AI reports the task complete.'}</p>}
        <p className='mt-3 text-xs text-white/50'>Build and test execution: not run. EUREKA CORE verifies file integrity only; it does not claim the generated code builds or passes tests.</p>
      </PageSection>

      {p.manifest ? (
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>File manifest ({p.manifest.files.length} files, {p.manifest.totalBytes} bytes)</p>
          <p className='mt-2 break-all text-xs text-white/50'>Manifest digest: {p.manifest.manifestDigest}</p>
          <div className='mt-3 overflow-x-auto'>
            <table className='w-full text-left text-xs text-white/70'>
              <thead><tr className='text-white/45'><th className='py-1 pr-3'>Path</th><th className='pr-3'>Bytes</th><th className='pr-3'>SHA-256</th><th className='pr-3'>Hash check</th><th /></tr></thead>
              <tbody>{p.manifest.files.map((f) => {
                const check = p.validation?.files.find((c) => c.path === f.path);
                return (
                  <tr key={f.path} className='border-t border-white/10'>
                    <td className='py-1 pr-3 break-all'>{f.path}</td><td className='pr-3'>{f.bytes}</td><td className='pr-3 font-mono'>{f.sha256.slice(0, 14)}…</td>
                    <td className='pr-3'>{check ? (check.ok ? 'verified' : 'MISMATCH') : '—'}</td>
                    <td>{p.status === 'completed' ? <button className='underline hover:text-tinan-turquoise' onClick={() => void view(f.path)} type='button'>View</button> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {preview ? (
            <div className='mt-4'>
              <p className='text-xs text-white/50'>{preview.path} · SHA-256 re-verified {preview.sha256}</p>
              <pre className='mt-2 max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/80'>{preview.content}</pre>
            </div>
          ) : null}
        </PageSection>
      ) : null}

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Generation history</p>
        <ul className='mt-3 grid gap-1 text-sm text-white/70'>{p.attempts.map((a) => <li key={a.n}>Attempt {a.n}: {STATUS_LABEL[a.status]} · started {new Date(a.startedAt).toLocaleString()}</li>)}</ul>
        <HistoryTable rows={history} />
      </PageSection>
    </Shell>
  );
}
