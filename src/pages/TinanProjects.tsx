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

  useEffect(() => {
    setProjects(listProjects());
    setLoaded(true);
  }, []);

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Projects' title='Your project workspace.' description='Projects are stored in this browser only. No server sync or blockchain deployment is enabled.' actions={<Link className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black' to='/create'>Create project</Link>} />
      {!loaded ? <PageSection aria-live='polite'>Loading browser projects…</PageSection> : projects.length === 0 ? (
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
                <div>
                  <h2 className='text-lg font-semibold'>{project.title}</h2>
                  <p className='mt-1 text-xs text-white/55'>Updated {new Date(project.updatedAt).toLocaleString()}</p>
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

  useEffect(() => {
    const stored = findProject(id);
    setProject(stored);
    setIdea(stored?.idea ?? '');
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
      {project.blueprint ? <BlueprintView blueprint={project.blueprint} /> : <PageSection className='text-sm text-white/60'>This draft does not have an analysis yet.</PageSection>}
      <div className='flex flex-wrap gap-3'>
        <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/tokenize'>Build tokenization blueprint</Link>
        <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/dashboard'>Open dashboard</Link>
      </div>
    </div>
  );
}
