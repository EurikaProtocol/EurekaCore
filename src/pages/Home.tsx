import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ParticleField } from '../components/ParticleField';
import { Reveal } from '../components/Reveal';
import { TokenPanel, TRADE_URL } from '../components/TokenPanel';
import { classNames } from '../components/ui';
import type { TINANProject } from '../core/tinan-blueprint';
import type { EvmWalletController } from '../hooks/useEvmWallet';
import { listProjects } from '../services/tinan-projects';

const EXAMPLE_PROMPT = 'I want to tokenize solar energy produced by my solar installation.';

function Flow({ steps, accent = 1 }: { steps: readonly string[]; accent?: number }) {
  return (
    <ol className='mt-8 grid gap-2 sm:grid-cols-3 xl:flex xl:items-stretch xl:gap-0'>
      {steps.map((step, index) => (
        <li className='flex flex-1 items-center' key={step}>
          <div className={classNames('eu-card flex min-h-20 flex-1 flex-col justify-center p-4 text-center', index === accent && 'border-tinan-turquoise/50 shadow-[0_0_30px_rgba(21,208,201,0.18)]')}>
            <span className='text-[10px] text-tinan-turquoise'>{String(index + 1).padStart(2, '0')}</span>
            <span className='mt-1 text-sm font-semibold uppercase tracking-wider'>{step}</span>
          </div>
          {index < steps.length - 1 ? <span aria-hidden='true' className='hidden px-2 text-tinan-turquoise/70 xl:block'>→</span> : null}
        </li>
      ))}
    </ol>
  );
}

const DEMO_PROJECTS = [
  { id: 'demo-1', title: 'Community Solar Token', category: 'Energy', description: 'Illustrative concept: tokenize shares of a community solar installation.', readiness: 'Not assessed', blockchain: 'To be selected', status: 'DEMO' },
  { id: 'demo-2', title: 'Sensor Data Proof', category: 'Data', description: 'Illustrative concept: anchor verifiable proofs of IoT sensor datasets.', readiness: 'Not assessed', blockchain: 'To be selected', status: 'DEMO' },
  { id: 'demo-3', title: 'Impact Project Token', category: 'Community', description: 'Illustrative concept: a project token for a community initiative.', readiness: 'Not assessed', blockchain: 'To be selected', status: 'DEMO' },
] as const;

type ShowcaseCard = { id: string; title: string; category: string; description: string; readiness: string; blockchain: string; status: string; href?: string };

function toCard(project: TINANProject): ShowcaseCard {
  return {
    id: project.id,
    title: project.title,
    category: project.blueprint?.category ?? 'Uncategorized',
    description: project.blueprint?.description ?? project.idea,
    readiness: project.blueprint ? `${project.blueprint.readinessScore}/100` : 'Not assessed',
    blockchain: project.tokenizationPlan?.network || project.blueprint?.blockchain || 'To be selected',
    status: project.status,
    href: `/project/${project.id}`,
  };
}

export function HomePage({ evm }: { evm: EvmWalletController }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [projects, setProjects] = useState<TINANProject[]>([]);

  useEffect(() => {
    try { setProjects(listProjects()); } catch { setProjects([]); }
  }, []);

  const goToAi = (text: string) => navigate(`/ai?idea=${encodeURIComponent(text.trim().slice(0, 1500))}`);
  const cards: ShowcaseCard[] = projects.length ? projects.slice(0, 3).map(toCard) : [...DEMO_PROJECTS];
  const analyses = projects.filter((project) => project.blueprint).length;
  const plans = projects.filter((project) => project.tokenizationPlan).length;

  const blueprint: Array<[string, string]> = [
    ['Project', 'Solar energy tokenization'],
    ['Token Model', 'Energy token (concept)'],
    ['Blockchain', 'Network to be selected'],
    ['Utility', 'Access to production-linked rights'],
    ['Data', 'Meter / inverter readings required'],
    ['Readiness', 'Calculated when you run TINAN AI'],
  ];

  return (
    <div className='-mt-24'>
      {/* Hero */}
      <section aria-labelledby='hero-title' className='relative flex min-h-[100svh] items-center overflow-hidden'>
        <ParticleField className='absolute inset-0 h-full w-full opacity-80' />
        <div aria-hidden='true' className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(21,208,201,0.16),transparent_55%)]' />
        <div className='relative z-10 py-32'>
          <p className='eu-eyebrow'>EUREKA</p>
          <p className='mt-2 text-sm uppercase tracking-[0.4em] text-white/60'>A BRIGHTER TOMORROW</p>
          <p className='mt-10 text-sm font-semibold uppercase tracking-[0.5em] text-white/70'>TINAN AI</p>
          <h1 className='mt-4 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl' id='hero-title'>
            Not Artificial Intelligence.<br /><span className='eu-gradient-text'>Natural Intelligence.</span>
          </h1>
          <div className='mt-9 flex flex-wrap gap-3'>
            <Link className='eu-btn-primary' to='/ai'>Enter TINAN AI</Link>
            <a className='eu-btn-ghost' href='#ecosystem'>Explore EUREKA</a>
            {TRADE_URL ? <a className='eu-btn-ghost' href={TRADE_URL} rel='noreferrer' target='_blank'>Trade $EUREKA</a> : null}
          </div>
        </div>
      </section>

      {/* Meet TINAN AI */}
      <Reveal as='section' className='eu-section'>
        <p className='eu-eyebrow'>The product</p>
        <h2 className='eu-h2'>Meet TINAN AI</h2>
        <p className='eu-lead'>TINAN AI transforms ideas into structured Web3 projects, tokenization concepts and actionable blockchain strategies.</p>
        <Flow steps={['Idea', 'TINAN AI', 'Analysis', 'Blueprint', 'Tokenization', 'Blockchain']} />
        <Link className='eu-btn-primary mt-8' to='/ai'>Start with your idea</Link>
      </Reveal>

      {/* AI preview */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <div className='eu-card grid gap-6 p-5 sm:p-8 lg:grid-cols-2'>
          <div>
            <p className='eu-eyebrow'>TINAN AI interface</p>
            <label className='mt-3 block text-2xl font-semibold' htmlFor='home-prompt'>What do you want to build?</label>
            <textarea className='mt-4 min-h-32 w-full rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none focus:border-tinan-turquoise' id='home-prompt' maxLength={1500} onChange={(event) => setPrompt(event.target.value)} value={prompt} />
            <button className='eu-btn-primary mt-4' onClick={() => goToAi(prompt)} type='button'>Try TINAN AI</button>
            <p className='mt-3 text-xs text-white/50'>Opens the TINAN AI workspace with your text. Nothing is sent until you press Analyze.</p>
          </div>
          <div className='rounded-2xl border border-tinan-turquoise/25 bg-black/30 p-5'>
            <div className='flex items-center justify-between gap-2'>
              <p className='font-semibold'>Blueprint preview</p>
              <span className='rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60'>Illustrative</span>
            </div>
            <dl className='mt-4 grid gap-2'>
              {blueprint.map(([label, value]) => (
                <div className='flex flex-col gap-1 rounded-xl border border-white/10 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between' key={label}>
                  <dt className='text-xs uppercase tracking-wider text-tinan-turquoise'>{label}</dt>
                  <dd className='text-sm text-white/85'>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>

      {/* Features */}
      <section className='eu-section pt-0 sm:pt-0'>
        <Reveal>
          <p className='eu-eyebrow'>Core features</p>
          <h2 className='eu-h2'>Everything between idea and chain.</h2>
        </Reveal>
        <div className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[
            ['TINAN AI', 'Intelligent project analysis.', '/ai'],
            ['TOKENIZATION', 'Transform projects into blockchain-ready concepts.', '/tokenize'],
            ['WEB3', 'Connect projects with decentralized networks.', '/wallet'],
            ['DATA PROOF', 'Create verifiable data structures and blockchain proofs.', '/verify'],
            ['ENERGY', 'Prepare renewable energy and IoT data for tokenization.', '/docs'],
            ['PROJECTS', 'Create, manage and analyze Web3 projects.', '/projects'],
          ].map(([title, text, path], index) => (
            <Reveal delay={index * 60} key={title}>
              <Link className='eu-card eu-card-hover block h-full' to={path}>
                <h3 className='text-sm font-semibold tracking-[0.2em] text-tinan-turquoise'>{title}</h3>
                <p className='mt-3 text-white/75'>{text}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* From idea to token */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <p className='eu-eyebrow'>Tokenization</p>
        <h2 className='eu-h2'>From Idea to Token</h2>
        <Flow accent={2} steps={['Idea', 'AI Analysis', 'Token Blueprint', 'Wallet', 'Blockchain', 'Token']} />
        <Link className='eu-btn-primary mt-8' to='/tokenize'>Create a Tokenization Plan</Link>
      </Reveal>

      {/* Ecosystem */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0' id='ecosystem'>
        <div>
          <p className='eu-eyebrow'>Ecosystem</p>
          <h2 className='eu-h2'>The EUREKA Ecosystem</h2>
          <p className='eu-lead'>TINAN AI is a product inside the EUREKA ecosystem: the tool that turns ideas into structured, blockchain-ready plans.</p>
          <ul className='mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7'>
            {['EUREKA', 'TINAN AI', 'Web3', 'Tokenization', 'Data', 'Energy', 'Community'].map((item) => (
              <li className={classNames('eu-card flex min-h-24 items-center justify-center p-3 text-center text-sm font-semibold', item === 'EUREKA' && 'border-tinan-turquoise/50')} key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* Token */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <TokenPanel walletAddress={evm.state.address} />
      </Reveal>

      {/* Showcase */}
      <section className='eu-section pt-0 sm:pt-0'>
        <Reveal>
          <p className='eu-eyebrow'>Projects</p>
          <h2 className='eu-h2'>Built with TINAN AI</h2>
          <p className='eu-lead'>{projects.length ? 'Your most recent projects, stored in this browser.' : 'No saved projects yet. These cards are labeled DEMO and illustrate the format.'}</p>
        </Reveal>
        <div className='mt-8 grid gap-4 md:grid-cols-3'>
          {cards.map((card) => {
            const body = (
              <>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-xs uppercase tracking-wider text-tinan-turquoise'>{card.category}</span>
                  <span className={classNames('rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest', card.status === 'DEMO' ? 'border-amber-300/40 text-amber-100' : 'border-white/20 text-white/70')}>{card.status}</span>
                </div>
                <h3 className='mt-3 text-lg font-semibold'>{card.title}</h3>
                <p className='mt-2 line-clamp-3 text-sm text-white/65'>{card.description}</p>
                <dl className='mt-4 grid grid-cols-2 gap-2 text-xs'>
                  <div><dt className='text-white/45'>Readiness</dt><dd className='text-white/85'>{card.readiness}</dd></div>
                  <div><dt className='text-white/45'>Blockchain</dt><dd className='text-white/85'>{card.blockchain}</dd></div>
                </dl>
              </>
            );
            return (
              <Reveal key={card.id}>
                {card.href ? <Link className='eu-card eu-card-hover block h-full' to={card.href}>{body}</Link> : <article className='eu-card h-full'>{body}</article>}
              </Reveal>
            );
          })}
        </div>
        <Link className='eu-btn-ghost mt-6' to='/projects'>View all projects</Link>
      </section>

      {/* Energy */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <p className='eu-eyebrow'>Energy · Data</p>
        <h2 className='eu-h2'>From sunlight to a verifiable record.</h2>
        <p className='eu-lead'>Solar is used as an example pathway. No energy readings are shown or simulated here; real data would come from your own meters, inverters or IoT devices.</p>
        <Flow accent={3} steps={['Energy', 'IoT', 'Data', 'Verification', 'Blockchain', 'Tokenization']} />
        <Link className='eu-btn-primary mt-8' to='/ai?idea=I%20want%20to%20tokenize%20solar%20energy%20produced%20by%20my%20solar%20installation.'>Explore Energy Tokenization</Link>
      </Reveal>

      {/* Dashboard */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <p className='eu-eyebrow'>Dashboard</p>
        <h2 className='eu-h2'>Your workspace at a glance.</h2>
        <div className='mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {[
            ['Projects', String(projects.length)],
            ['AI analyses', String(analyses)],
            ['Tokenization plans', String(plans)],
            ['Wallet', evm.state.address ? `${evm.state.address.slice(0, 6)}…${evm.state.address.slice(-4)}` : 'Not connected'],
            ['Blockchain', evm.state.address ? evm.state.network : 'Not connected'],
            ['Data Proof', 'Verify tool available'],
          ].map(([label, value]) => (
            <div className='eu-card p-5' key={label}>
              <p className='text-xs uppercase tracking-wider text-white/50'>{label}</p>
              <p className='mt-2 break-all text-xl font-semibold'>{value}</p>
            </div>
          ))}
        </div>
        <p className='mt-3 text-xs text-white/45'>Project counts are read from this browser's storage.</p>
        <Link className='eu-btn-primary mt-6' to='/dashboard'>Open Dashboard</Link>
      </Reveal>

      {/* How it works */}
      <section className='eu-section pt-0 sm:pt-0'>
        <Reveal><p className='eu-eyebrow'>How it works</p><h2 className='eu-h2'>Four steps.</h2></Reveal>
        <ol className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {['Describe your idea', 'TINAN AI analyzes it', 'Generate your Web3 blueprint', 'Build and connect it to blockchain'].map((text, index) => (
            <Reveal as='li' className='eu-card' delay={index * 70} key={text}>
              <span className='eu-gradient-text text-4xl font-semibold'>{String(index + 1).padStart(2, '0')}</span>
              <p className='mt-4 font-semibold'>{text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <Reveal as='section' className='eu-section pt-0 sm:pt-0'>
        <div className='eu-card relative overflow-hidden p-8 text-center sm:p-16'>
          <div aria-hidden='true' className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(21,208,201,0.2),transparent_60%)]' />
          <h2 className='relative mx-auto max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl'>Your idea could be the next EUREKA.</h2>
          <p className='relative mt-4 text-lg text-white/70'>Start building with TINAN AI.</p>
          <div className='relative mt-8 flex flex-wrap justify-center gap-3'>
            <Link className='eu-btn-primary' to='/ai'>Start with TINAN AI</Link>
            <a className='eu-btn-ghost' href='#ecosystem'>Explore the Ecosystem</a>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
