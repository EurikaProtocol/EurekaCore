import { Link } from 'react-router-dom';
import { PageSection, StatusPill } from '../components/ui';
import { TINAN_TOKEN } from '../config/tinan-token';
import { ECOSYSTEM_ASSETS } from '../core/asset';
import { PROOF_MODULES } from '../core/proof';

const WORKFLOW = ['IDEA', 'TINAN AI', 'ANALYSIS', 'TOKENIZATION BLUEPRINT', 'BLOCKCHAIN', 'PROJECT'];

export function HomePage() {
  return (
    <div className='grid gap-5'>
      <PageSection className='cyan-outline relative overflow-hidden bg-[radial-gradient(circle_at_80%_10%,rgba(21,208,201,0.2),transparent_38%),rgba(255,255,255,0.04)] p-7 sm:p-12'>
        <p className='text-xs font-semibold uppercase tracking-[0.38em] text-tinan-cyan'>EUREKA · A BRIGHTER TOMORROW</p>
        <p className='mt-8 text-sm font-semibold uppercase tracking-[0.45em] text-white/65'>TINAN AI</p>
        <h1 className='mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl'>Not Artificial Intelligence.<br /><span className='text-tinan-cyan'>Natural Intelligence.</span></h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-white/70'>Move from a real-world idea to a clear project and tokenization blueprint—without inventing data or making on-chain claims.</p>
        <div className='mt-7 flex flex-wrap gap-3'>
          <Link className='rounded-xl bg-tinan-cyan px-5 py-3 text-sm font-semibold text-black' to='/ai'>Start with TINAN AI</Link>
          <Link className='rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white' to='/tokenize'>Explore Tokenization</Link>
        </div>
        <p className='mt-6 text-xs text-white/50'>DEMO MODE · Analyses are generated locally; transactions are not sent.</p>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.28em] text-tinan-cyan'>From idea to project</p>
        <div className='mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6'>
          {WORKFLOW.map((step, index) => (
            <div className='flex min-h-24 flex-col justify-between rounded-xl border border-white/10 bg-black/20 p-4' key={step}>
              <span className='text-xs text-tinan-cyan'>0{index + 1}</span>
              <span className='text-sm font-semibold'>{step}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <div className='grid gap-4 lg:grid-cols-2'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.28em] text-tinan-cyan'>What is TINAN AI?</p>
          <h2 className='mt-3 text-2xl font-semibold'>A structured thinking partner for real projects.</h2>
          <p className='mt-3 text-sm leading-7 text-white/70'>TINAN AI turns a written idea into a draft covering the problem, proposed solution, tokenization concept, data requirements, risks, and recommended next steps. Demo output is a starting point—not an authoritative assessment.</p>
          <Link className='mt-5 inline-flex text-sm font-semibold text-tinan-cyan' to='/ai'>Try a local demo analysis →</Link>
        </PageSection>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.28em] text-tinan-cyan'>Existing token</p>
          <div className='mt-3 flex items-center gap-3'>
            <img alt='Eureka logo' className='h-12 w-12' src='/assets/tinan-logo.svg' />
            <div><h2 className='text-xl font-semibold'>TINAN token</h2><p className='text-sm text-white/60'>{TINAN_TOKEN.networkName ?? 'Network not configured'}</p></div>
          </div>
          <p className='mt-3 break-all text-sm text-white/65'>{TINAN_TOKEN.address ?? 'Token address not configured'}</p>
          <p className='mt-2 text-xs text-white/50'>Existing token only · No replacement deployment · Network is never assumed.</p>
          <Link className='mt-4 inline-flex text-sm font-semibold text-tinan-cyan' to='/tokens'>Open token reader →</Link>
        </PageSection>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Tokenization', 'Explore possible token models only after defining rights, utility, and user responsibilities.', '/tokenize'],
          ['Data Proof', 'Identify the source, timestamp, and verification method before describing a record as proven.', '/docs'],
          ['Energy', 'Plan connections to real meter, inverter, battery, grid, API, or IoT data; no readings are simulated.', '/docs'],
        ].map(([title, description, path]) => (
          <PageSection key={title}>
            <h2 className='text-lg font-semibold'>{title}</h2>
            <p className='mt-3 text-sm leading-6 text-white/65'>{description}</p>
            <Link className='mt-4 inline-flex text-sm text-tinan-cyan' to={path}>Explore {title} →</Link>
          </PageSection>
        ))}
      </div>

      <PageSection>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div><p className='text-xs uppercase tracking-[0.28em] text-tinan-cyan'>Eureka ecosystem</p><h2 className='mt-2 text-xl font-semibold'>Preserving the existing product</h2></div>
          <StatusPill tone={TINAN_TOKEN.configured ? 'success' : 'warning'}>{TINAN_TOKEN.configured ? 'Token network configured' : 'Token network not configured'}</StatusPill>
        </div>
        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          {ECOSYSTEM_ASSETS.map((asset) => (
            <article className='rounded-xl border border-white/10 bg-black/20 p-4' key={asset.id}>
              <div className='flex items-center justify-between gap-2'><h3 className='font-semibold'>{asset.name}</h3><StatusPill>{asset.symbol}</StatusPill></div>
              <p className='mt-2 text-sm text-white/65'>{asset.summary}</p>
            </article>
          ))}
        </div>
        <div className='mt-4 grid gap-3 md:grid-cols-3'>
          {PROOF_MODULES.map((module) => (
            <div className='rounded-xl border border-white/10 p-4' key={module.title}><h3 className='font-semibold'>{module.title}</h3><p className='mt-2 text-sm text-white/60'>{module.description}</p></div>
          ))}
        </div>
      </PageSection>

      <PageSection className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div><h2 className='text-xl font-semibold'>Have a project in mind?</h2><p className='mt-1 text-sm text-white/60'>Start with a description. Save your project locally when you are ready.</p></div>
        <div className='flex flex-wrap gap-3'>
          <Link className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black' to='/create'>Create project</Link>
          <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/community'>Community</Link>
          <Link className='rounded-xl border border-white/15 px-4 py-2 text-sm' to='/docs'>Documentation</Link>
        </div>
      </PageSection>
    </div>
  );
}
