import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TINANBlueprint } from '../core/tinan-blueprint';
import { assessReadiness } from '../core/tinan-blueprint';
import { PageHero, PageSection, StatusPill } from '../components/ui';
import { tinanAIProvider } from '../services/tinan-ai';
import { saveProject } from '../services/tinan-projects';

const EXAMPLE_IDEA = 'I want to tokenize solar energy production from my photovoltaic system.';

export function BlueprintView({ blueprint }: { blueprint: TINANBlueprint }) {
  const readiness = assessReadiness({ idea: blueprint.description });
  const details: Array<[string, string]> = [
    ['Problem', blueprint.problem],
    ['Proposed solution', blueprint.solution],
    ['Tokenization concept', blueprint.tokenizationModel],
    ['Token type', blueprint.tokenType],
    ['Suggested blockchain', blueprint.blockchain],
    ['Utility', blueprint.utility],
    ['Data requirements', blueprint.dataSources.join(' · ')],
    ['Energy data / evidence', blueprint.energyData],
    ['Proof concept', blueprint.proofModel],
    ['Risks', blueprint.risks.join(' · ')],
    ['Compliance notes', blueprint.complianceNotes.join(' · ')],
    ['Recommended next steps', blueprint.recommendations.join(' · ')],
  ];

  return (
    <PageSection>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Demo analysis · not verified</p>
          <h2 className='mt-2 text-2xl font-semibold'>{blueprint.title}</h2>
          <p className='mt-2 text-sm text-white/65'>{blueprint.category} · created {new Date(blueprint.createdAt).toLocaleString()}</p>
        </div>
        <div className='rounded-2xl border border-tinan-cyan/30 bg-tinan-cyan/10 px-4 py-3 text-center'>
          <p className='text-xs uppercase tracking-wider text-white/65'>Readiness</p>
          <p className='text-3xl font-semibold text-tinan-cyan'>{readiness.score}<span className='text-base'>/100</span></p>
          <p className='text-xs text-white/55'>Planning aid only</p>
        </div>
      </div>
      <p className='mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/80'>{blueprint.description}</p>
      <div className='mt-5 grid gap-3 md:grid-cols-2'>
        {details.map(([label, value]) => (
          <div key={label} className='rounded-xl border border-white/10 bg-black/20 p-4'>
            <p className='text-xs uppercase tracking-wider text-tinan-cyan'>{label}</p>
            <p className='mt-2 text-sm leading-6 text-white/80'>{value}</p>
          </div>
        ))}
      </div>
      <div className='mt-5 rounded-xl border border-white/10 p-4'>
        <h3 className='font-semibold'>How this readiness score is calculated</h3>
        <p className='mt-2 text-xs leading-5 text-white/55'>{readiness.disclaimer}</p>
        <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
          {readiness.factors.map((factor) => (
            <li key={factor.label} className='flex gap-2 text-sm text-white/75'>
              <span aria-label={factor.ready ? 'ready' : 'not ready'}>{factor.ready ? '✓' : '○'}</span>
              <span>{factor.label} · {factor.ready ? factor.points : 0}/{factor.points} points</span>
            </li>
          ))}
        </ul>
      </div>
    </PageSection>
  );
}

function AnalysisForm({ allowSave }: { allowSave: boolean }) {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [blueprint, setBlueprint] = useState<TINANBlueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function analyze() {
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      setBlueprint(await tinanAIProvider.analyze(idea));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'The analysis could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!blueprint) return;
    try {
      const project = saveProject(idea, blueprint);
      setSaved(true);
      if (allowSave) navigate(`/project/${project.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The project could not be saved.');
    }
  }

  return (
    <>
      <PageSection>
        <label className='block text-sm font-medium' htmlFor='tinan-idea'>Describe your idea, asset, energy system, data source, or Web3 project</label>
        <textarea
          className='mt-3 min-h-36 w-full rounded-2xl border border-white/15 bg-black/30 p-4 text-sm text-white outline-none focus:border-tinan-cyan'
          id='tinan-idea'
          maxLength={4000}
          onChange={(event) => setIdea(event.target.value)}
          placeholder={EXAMPLE_IDEA}
          value={idea}
        />
        <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
          <span className='text-xs text-white/55'>{idea.length}/4000 characters · Demo mode; no external AI service is called.</span>
          <button className='rounded-xl bg-tinan-cyan px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50' disabled={loading || idea.trim().length < 12} onClick={() => void analyze()} type='button'>
            {loading ? 'TINAN AI is analyzing…' : 'Analyze with TINAN AI'}
          </button>
        </div>
        {error ? <p className='mt-3 rounded-xl border border-rose-300/30 bg-rose-900/20 p-3 text-sm text-rose-100' role='alert'>{error}</p> : null}
        {loading ? <p aria-live='polite' className='mt-3 text-sm text-tinan-cyan'>Structuring your idea locally…</p> : null}
        {saved && !allowSave ? <p className='mt-3 text-sm text-emerald-200' role='status'>Project saved in this browser.</p> : null}
      </PageSection>
      {blueprint ? (
        <div className='grid gap-3'>
          <BlueprintView blueprint={blueprint} />
          <div className='flex flex-wrap gap-3'>
            <button className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black' onClick={save} type='button'>
              {allowSave ? 'Save project' : 'Save to projects'}
            </button>
            <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/tokenize'>Create tokenization blueprint</Link>
          </div>
        </div>
      ) : (
        <PageSection className='border-dashed text-sm text-white/60'>
          Enter an idea and run an analysis to see a structured blueprint. No balances, prices, transactions, or real-world measurements are generated.
        </PageSection>
      )}
    </>
  );
}

export function TINANAIStudioPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='TINAN AI · Demo mode'
        title='Not Artificial Intelligence. Natural Intelligence.'
        description='Describe an idea to receive a deterministic, locally generated project blueprint. Treat all suggestions as planning prompts—not facts, certification, legal advice, or a substitute for real data.'
      />
      <AnalysisForm allowSave={false} />
    </div>
  );
}

export function TINANCreateProjectPage() {
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Create a project' title='Start with your idea.' description='Analyze the idea first, review the generated blueprint, then explicitly save it to this browser.' />
      <AnalysisForm allowSave />
    </div>
  );
}

export function DemoModeBadge() {
  return <StatusPill tone='warning'>Demo mode</StatusPill>;
}
