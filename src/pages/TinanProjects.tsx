import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TINANProject } from '../core/tinan-blueprint';
import { PageHero, PageSection, StatusPill } from '../components/ui';
import { findProject, listProjects, saveProject } from '../services/tinan-projects';
import { tinanAIProvider } from '../services/tinan-ai';
import { BlueprintView } from './TinanStudio';

export function TINANProjectsPage() {
  const [projects, setProjects] = useState<TINANProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      setProjects(listProjects());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Saved projects are unavailable.');
    }
    setLoaded(true);
  }, []);

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Projects' title='Your project workspace.' description='Projects are stored in this browser only. No server sync or blockchain deployment is enabled.' actions={<Link className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black' to='/create'>Create project</Link>} />
      {!loaded ? <PageSection aria-live='polite'>Loading browser projects…</PageSection> : error ? <PageSection role='alert'>{error}</PageSection> : projects.length === 0 ? (
        <PageSection className='text-center'>
          <p className='text-lg font-semibold'>No saved projects yet</p>
          <p className='mt-2 text-sm text-white/60'>Start with a project idea and save an analysis to see it here.</p>
          <Link className='mt-4 inline-flex rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black' to='/create'>Create your first project</Link>
        </PageSection>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {projects.map((project) => (
            <PageSection key={project.id} className='p-5'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex min-w-0 items-center gap-3'>
                  <img alt='' className='h-10 w-10 shrink-0' src='/assets/tinan-logo.svg' />
                  <div className='min-w-0'>
                    <h2 className='text-lg font-semibold'>{project.title}</h2>
                    <p className='mt-1 text-xs text-white/55'>Updated {new Date(project.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
                <StatusPill>{project.status}</StatusPill>
              </div>
              <p className='mt-3 line-clamp-3 text-sm leading-6 text-white/70'>{project.idea}</p>
              <p className='mt-3 text-xs text-white/50'>{project.blueprint ? `${project.blueprint.category} · readiness ${project.blueprint.readinessScore}/100` : 'Draft · not analyzed'}</p>
              <Link className='mt-4 inline-flex text-sm font-semibold text-tinan-cyan' to={`/project/${project.id}`}>View project →</Link>
            </PageSection>
          ))}
        </div>
      )}
    </div>
  );
}

export function TINANProjectPage() {
  const { id = '' } = useParams();
  const [project, setProject] = useState<TINANProject | null>(null);
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = findProject(id);
      setProject(stored);
      setIdea(stored?.idea ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The project could not be loaded.');
    }
    setLoaded(true);
  }, [id]);

  async function analyzeProject() {
    setLoading(true);
    setError('');
    try {
      const blueprint = await tinanAIProvider.analyze(idea);
      const saved = saveProject(idea, blueprint, id);
      setProject(saved);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'The project analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return <PageSection aria-live='polite'>Loading project from this browser…</PageSection>;
  }

  if (!project) {
    return (
      <PageSection role='status'>
        <h1 className='text-xl font-semibold'>Project not found</h1>
        <p className='mt-2 text-sm text-white/65'>This browser may not have the saved project, or local storage is unavailable.</p>
        <Link className='mt-4 inline-flex text-sm text-tinan-cyan' to='/projects'>Return to projects</Link>
      </PageSection>
    );
  }

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow={`Project · ${project.status}`} title={project.title} description='Edit the project description or generate an updated demo blueprint. Changes remain in this browser.' actions={<Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/projects'>All projects</Link>} />
      <PageSection>
        <label className='block text-sm font-medium' htmlFor='project-idea'>Project description</label>
        <textarea className='mt-3 min-h-32 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm' id='project-idea' maxLength={4000} onChange={(event) => setIdea(event.target.value)} value={idea} />
        {error ? <p className='mt-3 text-sm text-rose-200' role='alert'>{error}</p> : null}
        <button className='mt-3 rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50' disabled={loading} onClick={() => void analyzeProject()} type='button'>{loading ? 'Analyzing…' : 'Analyze and save changes'}</button>
      </PageSection>
      {project.tokenizationPlan ? (
        <PageSection>
          <div className='flex items-center gap-3'>
            <img alt='' className='h-9 w-9' src='/assets/tinan-logo.svg' />
            <div>
              <p className='text-xs uppercase tracking-wider text-tinan-cyan'>Saved locally · demo plan</p>
              <h2 className='text-lg font-semibold'>Tokenization configuration</h2>
            </div>
          </div>
          <dl className='mt-4 grid gap-3 sm:grid-cols-2'>
            <div className='rounded-xl border border-white/10 p-3'><dt className='text-xs text-white/50'>Model</dt><dd className='mt-1 text-sm'>{project.tokenizationPlan.model}</dd></div>
            <div className='rounded-xl border border-white/10 p-3'><dt className='text-xs text-white/50'>Network</dt><dd className='mt-1 text-sm'>{project.tokenizationPlan.network}</dd></div>
            <div className='rounded-xl border border-white/10 p-3'><dt className='text-xs text-white/50'>Token name / symbol</dt><dd className='mt-1 text-sm'>{project.tokenizationPlan.name} ({project.tokenizationPlan.symbol})</dd></div>
            <div className='rounded-xl border border-white/10 p-3'><dt className='text-xs text-white/50'>Decimals / supply draft</dt><dd className='mt-1 text-sm'>{project.tokenizationPlan.decimals} / {project.tokenizationPlan.supply || 'Not specified'}</dd></div>
            <div className='rounded-xl border border-white/10 p-3 sm:col-span-2'><dt className='text-xs text-white/50'>Utility</dt><dd className='mt-1 break-words text-sm'>{project.tokenizationPlan.utility}</dd></div>
            <div className='rounded-xl border border-white/10 p-3 sm:col-span-2'><dt className='text-xs text-white/50'>Metadata URI</dt><dd className='mt-1 break-all text-sm'>{project.tokenizationPlan.metadata || 'Not specified'}</dd></div>
          </dl>
          <p className='mt-3 text-xs text-white/50'>Planning data only. No token has been created and no blockchain transaction was sent.</p>
        </PageSection>
      ) : null}
      {project.blueprint ? <BlueprintView blueprint={project.blueprint} /> : <PageSection className='text-sm text-white/60'>This draft does not have an analysis yet.</PageSection>}
      <div className='flex flex-wrap gap-3'>
        <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/tokenize'>Build tokenization blueprint</Link>
        <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/dashboard'>Open dashboard</Link>
      </div>
    </div>
  );
}
