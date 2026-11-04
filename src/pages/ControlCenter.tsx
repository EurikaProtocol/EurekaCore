import { PageHero, PageSection, StatusPill } from '../components/ui';
import { DEFAULT_PRODUCTS, PERMISSION_LEVELS, PROJECT_PIPELINE } from '../core';

const NOT_CONNECTED = [
  'Live workflow and task status (no Worker route or authentication model yet)',
  'GitHub integration status',
  'AI provider health and usage/cost estimates',
  'Security findings, deployment status and pending approvals',
];

/** Read-only view of static, repository-defined data. Nothing here is fetched from a live service. */
export function ControlCenterPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='EUREKACORE CONTROL CENTER'
        title='Registered products, autonomy tiers and the project pipeline.'
        description='This view shows the definitions the orchestration engine enforces. Live execution data is not connected yet, so no status below represents a running system.'
      />

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Ecosystem registry</p>
        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          {DEFAULT_PRODUCTS.map((p) => (
            <article key={p.id} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <div className='flex items-center justify-between gap-2'>
                <h2 className='font-semibold text-white'>{p.name}</h2>
                <StatusPill tone={p.integrationStatus === 'not-integrated' ? 'neutral' : 'warning'}>{p.integrationStatus}</StatusPill>
              </div>
              <p className='mt-3 text-sm leading-6 text-white/65'>{p.description}</p>
              <p className='mt-2 text-xs text-white/50'>Health: {p.health.status} · Max level: {p.maxPermissionLevel} · Auth: {p.authMethod}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Permission tiers</p>
        <ol className='mt-4 grid gap-2 text-sm text-white/70'>
          {Object.entries(PERMISSION_LEVELS).map(([level, t]) => (
            <li key={level}>Level {level} · <span className='text-white'>{t.name}</span>: {t.summary}</li>
          ))}
        </ol>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Project pipeline</p>
        <ol className='mt-4 grid gap-2 md:grid-cols-2'>
          {PROJECT_PIPELINE.map((s, i) => (
            <li key={s.id} className='flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75'>
              <span>{i + 1}. {s.title}</span>
              <StatusPill tone={s.kind === 'approval' ? 'warning' : 'neutral'}>{s.kind === 'approval' ? 'human gate' : `L${s.level}`}</StatusPill>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Not connected</p>
        <ul className='mt-4 list-disc pl-5 text-sm text-white/65'>
          {NOT_CONNECTED.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </PageSection>
    </div>
  );
}
