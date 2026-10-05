import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeroCanvas } from '../components/HeroCanvas';
import { LiveTokenData, useTokenSnapshot } from '../components/LiveTokenData';
import { Reveal } from '../components/Reveal';
import { StatusPill, classNames } from '../components/ui';
import { TINAN_TOKEN } from '../config/tinan-token';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import type { TINANBlueprint, TINANProject } from '../core/tinan-blueprint';
import { tinanAIProvider } from '../services/tinan-ai';
import { listProjects } from '../services/tinan-projects';
import { addTokenToWallet } from '../services/wallet-assets';

const EXAMPLE_IDEA = 'I want to tokenize solar energy produced by my solar installation.';

const INTRO_FLOW = ['IDEA', 'TINAN AI', 'ANALYSIS', 'BLUEPRINT', 'TOKENIZATION', 'BLOCKCHAIN'];
const TOKEN_FLOW = ['Idea', 'AI Analysis', 'Token Blueprint', 'Wallet', 'Blockchain', 'Token'];
const ENERGY_FLOW = ['Energy', 'IoT', 'Data', 'Verification', 'Blockchain', 'Tokenization'];

const FEATURES: Array<[string, string]> = [
  ['TINAN AI', 'Intelligent project analysis.'],
  ['TOKENIZATION', 'Transform projects into blockchain-ready concepts.'],
  ['WEB3', 'Connect projects with decentralized networks.'],
  ['DATA PROOF', 'Create verifiable data structures and blockchain proofs.'],
  ['ENERGY', 'Prepare renewable energy and IoT data for tokenization.'],
  ['PROJECTS', 'Create, manage and analyze Web3 projects.'],
];

const ECOSYSTEM: Array<[string, string]> = [
  ['EUREKA', 'The brand and ecosystem that brings the products below together.'],
  ['TINAN AI', 'The flagship product: natural-intelligence project analysis, living inside the EUREKA ecosystem.'],
  ['Web3', 'Wallets and networks that projects connect to.'],
  ['Tokenization', 'Blueprints for turning real-world projects into token concepts.'],
  ['Data', 'Structures that describe where data comes from and how it can be verified.'],
  ['Energy', 'Renewable energy and IoT as a primary use case.'],
  ['Community', 'A place for builders to share ideas.'],
];

const STEPS = ['Describe your idea', 'TINAN AI analyzes it', 'Generate your Web3 blueprint', 'Build and connect it to blockchain'];

const DEMO_PROJECTS: Array<{ name: string; category: string; description: string; readiness: string; blockchain: string; status: string }> = [
  { name: 'Rooftop Solar Token', category: 'Energy', description: 'Concept for representing metered solar production as a tokenized asset.', readiness: 'Example', blockchain: 'To be selected', status: 'DRAFT' },
  { name: 'Sensor Data Proof', category: 'Data', description: 'Concept for hashing IoT readings and anchoring proofs on-chain.', readiness: 'Example', blockchain: 'To be selected', status: 'DRAFT' },
];

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className='max-w-3xl'>
      <p className='eyebrow'>{eyebrow}</p>
      <h2 className='mt-3 text-3xl font-semibold leading-tight sm:text-4xl'>{title}</h2>
      {children ? <p className='mt-4 text-base leading-7 text-white/70'>{children}</p> : null}
    </div>
  );
}

function FlowSteps({ steps, vertical = false }: { steps: string[]; vertical?: boolean }) {
  return (
    <ol className={classNames('grid gap-3', vertical ? '' : 'sm:grid-cols-3 xl:grid-cols-6')}>
      {steps.map((step, index) => (
        <li className='glass glass-hover relative flex min-h-24 flex-col justify-between p-4' key={step}>
          <span className='text-xs text-tinan-turquoise'>{String(index + 1).padStart(2, '0')}</span>
          <span className='text-sm font-semibold tracking-wide'>{step}</span>
          {index < steps.length - 1 ? <span aria-hidden='true' className='absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-tinan-turquoise sm:hidden'>↓</span> : null}
          {index < steps.length - 1 ? <span aria-hidden='true' className='absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-tinan-turquoise sm:block'>→</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Hero() {
  return (
    <section aria-labelledby='hero-title' className='relative -mx-4 overflow-hidden rounded-none border-y border-white/10 px-4 py-20 sm:mx-0 sm:rounded-3xl sm:border sm:px-12 sm:py-28'>
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(21,208,201,0.22),transparent_45%),rgba(255,255,255,0.02)]' />
      <HeroCanvas />
      <div className='relative max-w-4xl'>
        <p className='eyebrow fade-in'>EUREKA</p>
        <p className='mt-2 text-sm font-medium uppercase tracking-[0.45em] text-white/60'>A BRIGHTER TOMORROW</p>
        <p className='mt-10 text-base font-semibold uppercase tracking-[0.4em] text-white/80'>TINAN AI</p>
        <h1 className='mt-4 text-4xl font-semibold leading-[1.1] sm:text-6xl lg:text-7xl' id='hero-title'>
          Not Artificial Intelligence.<br /><span className='text-gradient'>Natural Intelligence.</span>
        </h1>
        <p className='mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg'>
          TINAN AI is the natural-intelligence workspace of the EUREKA ecosystem — turn ideas into structured Web3 projects and tokenization blueprints.
        </p>
        <div className='mt-9 flex flex-wrap gap-3'>
          <Link className='btn btn-primary' to='/ai'>Enter TINAN AI</Link>
          <a className='btn btn-ghost' href='#ecosystem'>Explore EUREKA</a>
          {TINANAI_SOLANA.pumpfunUrl ? <a className='btn btn-ghost' href={TINANAI_SOLANA.pumpfunUrl} rel='noreferrer' target='_blank'>Trade $EUREKA</a> : null}
        </div>
      </div>
    </section>
  );
}

function AiPreview() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState(EXAMPLE_IDEA);
  const [blueprint, setBlueprint] = useState<TINANBlueprint | null>(null);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      tinanAIProvider.analyze(idea).then((result) => { if (active) setBlueprint(result); }).catch(() => { if (active) setBlueprint(null); });
    }, 350);
    return () => { active = false; window.clearTimeout(handle); };
  }, [idea]);

  const rows: Array<[string, string]> = blueprint ? [
    ['Project', blueprint.title],
    ['Token Model', blueprint.tokenizationModel],
    ['Blockchain', blueprint.blockchain],
    ['Utility', blueprint.utility],
    ['Data', blueprint.dataSources.join(' · ')],
    ['Readiness', `${blueprint.readinessScore}/100 · planning aid`],
  ] : [];

  return (
    <div className='glass grid gap-6 p-5 sm:p-8 lg:grid-cols-2'>
      <div>
        <label className='text-xl font-semibold' htmlFor='preview-idea'>What do you want to build?</label>
        <textarea
          className='mt-4 min-h-36 w-full rounded-2xl border border-white/15 bg-black/30 p-4 text-sm leading-6 text-white outline-none focus:border-tinan-turquoise'
          id='preview-idea'
          maxLength={4000}
          onChange={(event) => setIdea(event.target.value)}
          value={idea}
        />
        <button
          className='btn btn-primary mt-4'
          disabled={idea.trim().length < 12}
          onClick={() => navigate(`/ai?idea=${encodeURIComponent(idea.trim())}`)}
          type='button'
        >
          Try TINAN AI
        </button>
        <p className='mt-3 text-xs text-white/50'>Opens the real TINAN AI workspace with your text.</p>
      </div>
      <div aria-live='polite' className='rounded-2xl border border-tinan-turquoise/20 bg-black/30 p-5'>
        <div className='flex items-center justify-between gap-2'>
          <p className='eyebrow'>Blueprint preview</p>
          <StatusPill>Demo analysis</StatusPill>
        </div>
        {rows.length === 0 ? <p className='mt-4 text-sm text-white/60'>Enter at least a short description to preview a blueprint.</p> : (
          <dl className='mt-4 grid gap-3'>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className='text-xs uppercase tracking-[0.2em] text-tinan-turquoise'>{label}</dt>
                <dd className='mt-1 line-clamp-2 text-sm text-white/85'>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function ProjectShowcase() {
  const [projects, setProjects] = useState<TINANProject[]>([]);
  useEffect(() => {
    try { setProjects(listProjects().slice(0, 3)); } catch { setProjects([]); }
  }, []);
  const cards = projects.length > 0
    ? projects.map((project) => ({
      key: project.id,
      name: project.title,
      category: project.blueprint?.category ?? 'Draft',
      description: project.idea,
      readiness: project.blueprint ? `${project.blueprint.readinessScore}/100` : 'Not analyzed',
      blockchain: project.blueprint?.blockchain ?? 'Not selected',
      status: project.status,
      demo: false,
      href: `/project/${project.id}`,
    }))
    : DEMO_PROJECTS.map((project) => ({ ...project, key: project.name, demo: true, href: '/ai' }));

  return (
    <>
      <div className='mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {cards.map((card) => (
          <Link className='glass glass-hover grid content-start gap-3 p-5' key={card.key} to={card.href}>
            <div className='flex flex-wrap items-center gap-2'>
              {card.demo ? <StatusPill tone='warning'>DEMO</StatusPill> : null}
              <StatusPill>{card.status}</StatusPill>
            </div>
            <h3 className='text-lg font-semibold'>{card.name}</h3>
            <p className='line-clamp-3 text-sm leading-6 text-white/65'>{card.description}</p>
            <dl className='grid grid-cols-3 gap-2 text-xs'>
              <div><dt className='text-tinan-turquoise'>Category</dt><dd className='mt-1 text-white/80'>{card.category}</dd></div>
              <div><dt className='text-tinan-turquoise'>Readiness</dt><dd className='mt-1 text-white/80'>{card.readiness}</dd></div>
              <div><dt className='text-tinan-turquoise'>Blockchain</dt><dd className='mt-1 break-words text-white/80'>{card.blockchain}</dd></div>
            </dl>
          </Link>
        ))}
      </div>
      <p className='mt-4 text-xs text-white/50'>
        {projects.length > 0 ? 'Showing projects saved in this browser.' : 'DEMO examples shown because no project is saved in this browser yet. They are illustrations, not real projects.'}
      </p>
    </>
  );
}

function TokenSection({ walletAddress }: { walletAddress: string }) {
  const snapshot = useTokenSnapshot(walletAddress || undefined);
  const viewHref = TINAN_TOKEN.address ? `/tokens/${TINAN_TOKEN.address}` : '/tokens';

  return (
    <section aria-labelledby='token-title' className='glass p-6 sm:p-10'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <p className='eyebrow'>Token</p>
          <h2 className='mt-3 text-4xl font-semibold' id='token-title'>$EUREKA</h2>
          <p className='mt-3 text-base text-white/70'>The digital asset powering the EUREKA ecosystem.</p>
        </div>
        <StatusPill tone={TINAN_TOKEN.configured ? 'success' : 'warning'}>{TINAN_TOKEN.configured ? 'Token network configured' : 'Configuration required'}</StatusPill>
      </div>
      <div className='mt-6 flex flex-wrap gap-3'>
        <Link className='btn btn-primary' to={viewHref}>View Token</Link>
        {TINANAI_SOLANA.pumpfunUrl
          ? <a className='btn btn-ghost' href={TINANAI_SOLANA.pumpfunUrl} rel='noreferrer' target='_blank'>Trade</a>
          : <button aria-disabled='true' className='btn btn-ghost' disabled title='Trading link is not configured' type='button'>Trade (not configured)</button>}
        <button
          className='btn btn-ghost'
          disabled={!snapshot.token}
          onClick={() => snapshot.token && void addTokenToWallet(snapshot.token)}
          title={snapshot.token ? undefined : 'Available after the token has been read from chain'}
          type='button'
        >
          Add to Wallet
        </button>
      </div>
      <div className='mt-8 rounded-2xl border border-white/10 bg-black/20 p-5'>
        <LiveTokenData {...snapshot} />
      </div>
      <p className='mt-4 text-xs text-white/45'>This interface reads the existing token only. It never deploys or replaces a token.</p>
    </section>
  );
}

export function HomePage({ walletAddress }: { walletAddress: string }) {
  return (
    <div className='grid gap-24 sm:gap-32'>
      <Hero />

      <Reveal as='section' className='grid gap-8'>
        <SectionHeading eyebrow='The product' title='Meet TINAN AI'>
          TINAN AI transforms ideas into structured Web3 projects, tokenization concepts and actionable blockchain strategies.
        </SectionHeading>
        <FlowSteps steps={INTRO_FLOW} />
        <div><Link className='btn btn-primary' to='/ai'>Start with your idea</Link></div>
      </Reveal>

      <Reveal as='section'><AiPreview /></Reveal>

      <Reveal as='section'>
        <SectionHeading eyebrow='Core features' title='Everything between an idea and a blockchain.' />
        <div className='mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {FEATURES.map(([title, description], index) => (
            <Reveal className='glass glass-hover p-6' delay={index * 60} key={title}>
              <span aria-hidden='true' className='block h-1 w-10 rounded-full bg-tinan-turquoise' />
              <h3 className='mt-5 text-sm font-semibold tracking-[0.2em]'>{title}</h3>
              <p className='mt-3 text-sm leading-6 text-white/65'>{description}</p>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal as='section' className='grid gap-8'>
        <SectionHeading eyebrow='Tokenization' title='From Idea to Token'>
          Follow a guided path from a written idea to a token concept. Nothing is deployed until you review and confirm in your own wallet.
        </SectionHeading>
        <FlowSteps steps={TOKEN_FLOW} />
        <div><Link className='btn btn-primary' to='/tokenize'>Create a Tokenization Plan</Link></div>
      </Reveal>

      <Reveal as='section'>
        <div id='ecosystem' className='scroll-mt-24'>
          <SectionHeading eyebrow='Ecosystem' title='The EUREKA Ecosystem'>
            TINAN AI is a product inside the EUREKA ecosystem. EUREKA is the brand and ecosystem; TINAN AI is where ideas become structured projects.
          </SectionHeading>
        </div>
        <ul className='mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {ECOSYSTEM.map(([title, description]) => (
            <li className='glass glass-hover p-5' key={title}>
              <h3 className='font-semibold'>{title}</h3>
              <p className='mt-2 text-sm leading-6 text-white/60'>{description}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as='div'><TokenSection walletAddress={walletAddress} /></Reveal>

      <Reveal as='section'>
        <SectionHeading eyebrow='Projects' title='Built with TINAN AI' />
        <ProjectShowcase />
        <div className='mt-6'><Link className='btn btn-ghost' to='/projects'>View all projects</Link></div>
      </Reveal>

      <Reveal as='section' className='grid gap-8'>
        <SectionHeading eyebrow='Energy & Data' title='From energy to tokenization.'>
          Solar is one example: a real installation produces data that must be sourced, verified and anchored before it can be tokenized. TINAN AI helps plan that path; it does not generate or claim any energy readings.
        </SectionHeading>
        <FlowSteps steps={ENERGY_FLOW} />
        <div><Link className='btn btn-ghost' to='/tokenize'>Explore Energy Tokenization</Link></div>
      </Reveal>

      <Reveal as='section'>
        <div className='glass grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center'>
          <div>
            <p className='eyebrow'>Dashboard</p>
            <h2 className='mt-3 text-3xl font-semibold'>Your workspace at a glance.</h2>
            <Link className='btn btn-primary mt-6' to='/dashboard'>Open Dashboard</Link>
          </div>
          <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {['Projects', 'AI analyses', 'Tokenization plans', 'Wallet', 'Blockchain', 'Data Proof'].map((item) => (
              <li className='rounded-xl border border-white/10 bg-black/30 p-4 text-sm font-medium' key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal as='section'>
        <SectionHeading eyebrow='How it works' title='Four steps.' />
        <ol className='mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {STEPS.map((step, index) => (
            <li className='glass glass-hover p-6' key={step}>
              <span className='text-gradient text-4xl font-semibold'>{String(index + 1).padStart(2, '0')}</span>
              <p className='mt-4 text-base font-medium'>{step}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal as='section'>
        <div className='glass relative overflow-hidden p-8 text-center sm:p-16'>
          <div aria-hidden='true' className='absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(21,208,201,0.22),transparent_60%)]' />
          <div className='relative'>
            <h2 className='mx-auto max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl'>Your idea could be the next EUREKA.</h2>
            <p className='mt-4 text-lg text-white/70'>Start building with TINAN AI.</p>
            <div className='mt-8 flex flex-wrap justify-center gap-3'>
              <Link className='btn btn-primary' to='/ai'>Start with TINAN AI</Link>
              <a className='btn btn-ghost' href='#ecosystem'>Explore the Ecosystem</a>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
