import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import './eureka-landing.css';

const NAV = [
  ['#home', 'Home'],
  ['#ecosystem', 'Ecosystem'],
  ['#marketplace', 'Marketplace'],
  ['#token', 'Token'],
  ['#roadmap', 'Roadmap'],
  ['#about', 'About'],
] as const;

const ECOSYSTEM = [
  { icon: 'wallet', title: 'Multi-Chain Wallet', text: 'Connect an EVM wallet today. Solana wallet support is available separately in the existing app.', to: '/wallet', cta: 'Open wallet' },
  { icon: 'market', title: 'Eureka Marketplace', text: 'A preview of how data and project assets could be browsed. Listings shown here are demonstration data.', to: '/marketplace', cta: 'View marketplace' },
  { icon: 'ai', title: 'EurekaCore AI', text: 'A control core that treats AI output as untrusted and requires wallet-signed approval for consequential actions.', to: '/approvals', cta: 'Approval preview' },
  { icon: 'token', title: 'EKA Token', text: 'The existing EKA token on Ethereum. View read-only token details; no prices are shown on this page.', to: '/tokens', cta: 'Token details' },
] as const;

const SAMPLES = [
  { name: 'Rooftop Solar Output', kind: 'Energy data', hue: 190 },
  { name: 'Sensor Proof Bundle', kind: 'IoT data proof', hue: 215 },
  { name: 'Research Dataset Alpha', kind: 'Dataset', hue: 235 },
  { name: 'Creator Archive', kind: 'Media archive', hue: 175 },
] as const;

const UTILITY = [
  ['Access', 'Intended to gate access to ecosystem tools.'],
  ['Proofs', 'Intended for data-asset proof workflows.'],
  ['Governance', 'Planned; no governance system exists yet.'],
  ['Payments', 'Planned; no payment flow exists yet.'],
] as const;

const ROADMAP = [
  ['Built', 'Control core, task lifecycle, wallet-signed approvals, data-asset proof workspace.'],
  ['In progress', 'Durable D1 storage wiring and live TinanAi integration (both unverified).'],
  ['Planned', 'Marketplace listings, token utility flows, multi-chain approvals.'],
  ['Exploring', 'Governance and community tooling.'],
] as const;

const UPDATES = [
  ['Approval review preview', 'Review an exact action before signing. Signing never executes a transaction.'],
  ['Durable approval storage', 'D1-ready replay protection, tested on SQLite; not yet deployed.'],
  ['Dependency audit in CI', 'New high/critical advisories now fail the build.'],
] as const;

function Icon({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const paths: Record<string, ReactElement> = {
    wallet: <><rect height='13' rx='3' width='18' x='3' y='6' /><path d='M16 12h5M3 10h14' /></>,
    market: <><path d='M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16' /><path d='M9 20v-6h6v6' /></>,
    ai: <><circle cx='12' cy='12' r='3' /><path d='M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8' /></>,
    token: <><circle cx='12' cy='12' r='9' /><path d='M15 8.5H9.5v7H15M9.5 12H13' /></>,
  };
  return <svg aria-hidden='true' className='h-7 w-7' viewBox='0 0 24 24' {...common}>{paths[name]}</svg>;
}

function Globe() {
  const nodes: Array<[number, number]> = [[150, 110], [230, 150], [290, 230], [210, 300], [120, 260], [90, 170], [200, 200], [260, 100]];
  const links: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 1], [6, 3], [6, 5], [7, 1], [7, 0]];
  return (
    <svg aria-label='Decorative globe with network nodes' className='el-globe' role='img' viewBox='0 0 380 380'>
      <defs>
        <radialGradient id='el-sphere' cx='.38' cy='.32' r='.8'><stop offset='0' stopColor='#1b4fa8' /><stop offset='.55' stopColor='#0a2358' /><stop offset='1' stopColor='#030a1f' /></radialGradient>
        <clipPath id='el-clip'><circle cx='190' cy='190' r='150' /></clipPath>
      </defs>
      <circle cx='190' cy='190' r='178' fill='none' stroke='#2a6bff' strokeOpacity='.25' />
      <circle cx='190' cy='190' r='150' fill='url(#el-sphere)' />
      <g clipPath='url(#el-clip)' fill='none' stroke='#5df2ff' strokeOpacity='.28'>
        {[-120, -80, -40, 0, 40, 80, 120].map((y) => <ellipse cx='190' cy={190 + y} key={y} rx={Math.sqrt(150 * 150 - y * y)} ry='14' />)}
        {[40, 80, 120].map((rx) => <ellipse cx='190' cy='190' key={rx} rx={rx} ry='150' />)}
        <path d='M120 140c30-30 70-20 90 5s-5 40-35 45-65-5-55-50zM230 230c25-10 50 5 45 30s-35 35-55 20-5-40 10-50z' fill='#2a6bff' fillOpacity='.35' stroke='none' />
        {links.map(([a, b]) => <line key={`${a}-${b}`} stroke='#7ff6ff' strokeOpacity='.7' x1={nodes[a][0]} x2={nodes[b][0]} y1={nodes[a][1]} y2={nodes[b][1]} />)}
      </g>
      {nodes.map(([x, y], i) => <circle className='el-node' cx={x} cy={y} fill='#e8fdff' key={i} r='4' style={{ animationDelay: `${i * 0.35}s` }} />)}
      <circle cx='190' cy='190' r='150' fill='none' stroke='#5df2ff' strokeOpacity='.6' strokeWidth='1.5' />
    </svg>
  );
}

export function EurekaLandingPage() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = 'EUREKA — The Final Block of the Blockchain';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'EUREKA: a Web3 ecosystem preview with wallet-signed approvals, data proofs and an AI control core. Demonstration data is labelled.');
  }, []);

  return (
    <div className='el-root'>
      <a className='skip-link' href='#el-main'>Skip to content</a>
      <header className='el-header'>
        <div className='el-wrap el-header-row'>
          <a aria-label='EUREKA home' className='el-brand' href='#home'>
            <img alt='' height={40} src='/assets/eureka-emblem.svg' width={40} />
            <span>EUREKA</span>
          </a>
          <nav aria-label='Primary' className='el-nav-desktop'>
            {NAV.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
          </nav>
          <Link className='el-btn el-btn-ghost el-launch' to='/dashboard'>Launch App</Link>
          <button aria-controls='el-mobile-nav' aria-expanded={open} aria-label={open ? 'Close navigation' : 'Open navigation'} className='el-burger' onClick={() => setOpen((v) => !v)} type='button'>
            <span aria-hidden='true'>{open ? '×' : '☰'}</span>
          </button>
        </div>
        {open ? (
          <nav aria-label='Mobile' className='el-wrap el-nav-mobile' id='el-mobile-nav'>
            {NAV.map(([href, label]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
            <Link to='/dashboard'>Launch App</Link>
          </nav>
        ) : null}
      </header>

      <main id='el-main'>
        <section aria-labelledby='el-hero-title' className='el-hero' id='home'>
          <div className='el-stars' aria-hidden='true' />
          <div className='el-wrap el-hero-grid'>
            <div>
              <p className='el-eyebrow'>Web3 ecosystem · Preview build</p>
              <h1 id='el-hero-title'>The Final Block of the <span>Blockchain</span></h1>
              <p className='el-lead'>EUREKA brings wallet connectivity, data-asset proofs and a guarded AI control core into one ecosystem. Everything on this page is a preview: no live listings, prices or on-chain activity are shown.</p>
              <div className='el-actions'>
                <Link className='el-btn el-btn-primary' to='/dashboard'>Explore the app</Link>
                <a className='el-btn el-btn-ghost' href='#ecosystem'>See the ecosystem</a>
              </div>
            </div>
            <div className='el-art'>
              <Globe />
              <img alt='Glowing Eureka emblem' className='el-emblem' height={200} src='/assets/eureka-emblem.svg' width={200} />
            </div>
          </div>
        </section>

        <section aria-labelledby='eco-title' className='el-section' id='ecosystem'>
          <div className='el-wrap'>
            <p className='el-eyebrow'>Ecosystem</p>
            <h2 id='eco-title'>One ecosystem, four building blocks</h2>
            <div className='el-grid4'>
              {ECOSYSTEM.map((c) => (
                <article className='el-card' key={c.title}>
                  <div className='el-icon'><Icon name={c.icon} /></div>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <Link className='el-link' to={c.to}>{c.cta} →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby='mk-title' className='el-section el-alt' id='marketplace'>
          <div className='el-wrap'>
            <p className='el-eyebrow'>Marketplace preview</p>
            <h2 id='mk-title'>Sample asset cards</h2>
            <p className='el-note'>Demonstration data only. These are not real listings and have no price or owner.</p>
            <div className='el-grid4'>
              {SAMPLES.map((s) => (
                <article className='el-card el-asset' key={s.name}>
                  <div aria-hidden='true' className='el-asset-art' style={{ background: `radial-gradient(circle at 30% 30%, hsl(${s.hue} 100% 70% / .9), hsl(${s.hue + 30} 90% 30% / .6) 55%, #040a1c)` }} />
                  <span className='el-tag'>DEMO</span>
                  <h3>{s.name}</h3>
                  <p>{s.kind}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby='tk-title' className='el-section' id='token'>
          <div className='el-wrap'>
            <p className='el-eyebrow'>Token utility</p>
            <h2 id='tk-title'>EKA token: intended utility</h2>
            <p className='el-note'>Describes intent, not live functionality. No price, supply or market data is shown here.</p>
            <div className='el-grid4'>
              {UTILITY.map(([t, d]) => <article className='el-card' key={t}><h3>{t}</h3><p>{d}</p></article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby='rm-title' className='el-section el-alt' id='roadmap'>
          <div className='el-wrap'>
            <p className='el-eyebrow'>Roadmap</p>
            <h2 id='rm-title'>Where the project stands</h2>
            <ol className='el-timeline'>
              {ROADMAP.map(([stage, text]) => (
                <li key={stage}><span className='el-dot' aria-hidden='true' /><h3>{stage}</h3><p>{text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby='up-title' className='el-section' id='updates'>
          <div className='el-wrap'>
            <p className='el-eyebrow'>Latest updates</p>
            <h2 id='up-title'>Recent engineering progress</h2>
            <div className='el-grid3'>
              {UPDATES.map(([t, d]) => <article className='el-card' key={t}><h3>{t}</h3><p>{d}</p></article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby='ab-title' className='el-section el-alt' id='about'>
          <div className='el-wrap el-about'>
            <div>
              <p className='el-eyebrow'>About</p>
              <h2 id='ab-title'>Built to be verifiable</h2>
              <p className='el-lead'>EUREKA keeps humans in control: AI proposals carry no authority, and consequential actions need an exact, expiring, single-use wallet approval.</p>
            </div>
            <div className='el-cta'>
              <h3>Ready to look around?</h3>
              <p>Connect an EVM wallet inside the app. Nothing here sends a transaction.</p>
              <Link className='el-btn el-btn-primary' to='/dashboard'>Launch App</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className='el-footer'>
        <div className='el-wrap el-footer-grid'>
          <div>
            <div className='el-brand'><img alt='' height={36} src='/assets/eureka-emblem.svg' width={36} /><span>EUREKA</span></div>
            <p className='el-muted'>The Final Block of the Blockchain.</p>
          </div>
          <nav aria-label='Footer product'>
            <h4>Product</h4>
            <Link to='/dashboard'>Dashboard</Link><Link to='/marketplace'>Marketplace</Link><Link to='/tokens'>Tokens</Link><Link to='/approvals'>Approvals preview</Link>
          </nav>
          <nav aria-label='Footer resources'>
            <h4>Resources</h4>
            <Link to='/docs'>Docs</Link><Link to='/whitepaper'>Whitepaper</Link><Link to='/about'>About</Link><a href='/eureka-legacy.html'>Legacy landing</a>
          </nav>
          <nav aria-label='Footer legal'>
            <h4>Legal</h4>
            <Link to='/privacy'>Privacy</Link><Link to='/terms'>Terms</Link><Link to='/studio-home'>TINAN AI home</Link>
          </nav>
        </div>
        <p className='el-wrap el-muted el-copy'>© 2026 EUREKA. Preview content; sample data is labelled DEMO. Not financial advice.</p>
      </footer>
    </div>
  );
}
