import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EKA_TOKEN } from '../config/token';
import { EVM_NETWORKS, type SupportedEvmChain } from '../config/networks';
import { TINAN_TOKEN } from '../config/tinan-token';
import { isValidEvmAddress } from '../core/verify';
import type { TINANProject } from '../core/tinan-blueprint';
import type { RecentTransaction } from '../hooks/useEvmWallet';
import { listProjects } from '../services/tinan-projects';
import { addTokenToWallet } from '../services/wallet-assets';
import { readTokenSnapshot, type TokenSnapshot } from '../services/token-reader';
import { DetailRow, ExternalLinkButton, MetricCard, PageHero, PageSection, StatusPill } from '../components/ui';

const NETWORK_OPTIONS = Object.values(EVM_NETWORKS);

function TinanLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return <img alt='Eureka' className={className} src='/assets/tinan-logo.svg' />;
}

function TokenSummary({ token }: { token: TokenSnapshot }) {
  return (
    <PageSection>
      <div className='flex items-center gap-3'>
        <TinanLogo />
        <div>
          <h2 className='text-xl font-semibold'>{token.name} <span className='text-tinan-cyan'>({token.symbol})</span></h2>
          <p className='text-xs text-white/55'>Live read-only contract response</p>
        </div>
      </div>
      <dl className='mt-5 grid gap-3 sm:grid-cols-2'>
        <DetailRow label='Contract address' value={token.address} breakAll />
        <DetailRow label='Decimals' value={String(token.decimals)} />
        <DetailRow label='Total supply' value={token.totalSupply} />
        <DetailRow label='Connected wallet balance' value={token.balance ?? 'Connect an EVM wallet to read'} />
      </dl>
      <p className='mt-4 text-xs text-white/55'>Contract read succeeded. Explorer verification status has not been checked.</p>
      <button className='mt-4 rounded-xl border border-tinan-cyan/40 px-4 py-2 text-sm hover:bg-white/5' onClick={() => void addTokenToWallet(token)} type='button'>Add to Wallet</button>
    </PageSection>
  );
}

function TokenReadCard({ address, walletAddress }: { address: string; walletAddress?: string }) {
  const [token, setToken] = useState<TokenSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setToken(null);
    setError('');
    if (!TINAN_TOKEN.chainId || !TINAN_TOKEN.rpcUrl) {
      setError(TINAN_TOKEN.issues.join(' '));
      return () => { active = false; };
    }
    if (!isValidEvmAddress(address)) {
      setError('The supplied token address is not a valid EVM address.');
      return () => { active = false; };
    }

    setLoading(true);
    void readTokenSnapshot(address, TINAN_TOKEN.rpcUrl, TINAN_TOKEN.chainId, walletAddress)
      .then((snapshot) => { if (active) setToken(snapshot); })
      .catch((readError: unknown) => {
        if (active) setError(readError instanceof Error ? readError.message : 'Token contract read failed.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [address, walletAddress]);

  if (loading) return <PageSection aria-live='polite'>Reading contract data from the configured RPC…</PageSection>;
  if (error) return <PageSection role='alert'><h2 className='font-semibold'>Token data unavailable</h2><p className='mt-2 text-sm text-white/70'>{error}</p></PageSection>;
  return token ? <TokenSummary token={token} /> : <PageSection aria-live='polite'>Waiting for token configuration…</PageSection>;
}

export function TINANTokensPage({ walletAddress }: { walletAddress: string }) {
  const [address, setAddress] = useState(TINAN_TOKEN.address ?? '');
  const [submittedAddress, setSubmittedAddress] = useState(TINAN_TOKEN.address ?? '');
  const [validationError, setValidationError] = useState('');

  function readToken() {
    if (!isValidEvmAddress(address)) {
      setValidationError('Enter a valid EVM contract address.');
      setSubmittedAddress('');
      return;
    }
    setValidationError('');
    setSubmittedAddress(address);
  }

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Existing tokens' title='Read token data from its configured network.' description='This interface never deploys a replacement token. Contract values appear only after a live RPC read; unavailable values are reported instead of estimated.' />
      <PageSection>
        <div className='flex items-center gap-3'><TinanLogo /><div><h2 className='text-lg font-semibold'>TINAN existing token</h2><p className='text-sm text-white/60'>{TINAN_TOKEN.networkName ?? 'Network not configured'}</p></div></div>
        <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <label className='min-w-0 flex-1 text-sm' htmlFor='token-address'>Contract address
            <input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 font-mono text-sm' id='token-address' onChange={(event) => setAddress(event.target.value)} value={address} />
          </label>
          <button className='self-end rounded-xl bg-tinan-cyan px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50' disabled={!address.trim()} onClick={readToken} type='button'>Read token</button>
        </div>
        {validationError ? <p className='mt-2 text-sm text-rose-200' role='alert'>{validationError}</p> : null}
        <p className='mt-3 break-all text-xs text-white/55'>Configured address: {TINAN_TOKEN.address ?? 'Invalid or missing'}</p>
        <p className='mt-1 text-xs text-white/55'>Network is deliberately unset until VITE_TINAN_TOKEN_CHAIN_ID is configured.</p>
      </PageSection>
      {submittedAddress ? <TokenReadCard address={submittedAddress} walletAddress={walletAddress || undefined} /> : <PageSection className='text-sm text-white/60'>Set the token address and network configuration to load on-chain metadata.</PageSection>}
      {submittedAddress ? <Link className='text-sm text-tinan-cyan' to={`/tokens/${submittedAddress}`}>Open token detail route →</Link> : null}
      <PageSection>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div><p className='text-xs uppercase tracking-wider text-tinan-cyan'>Wallet import</p><p className='mt-1 text-sm text-white/65'>The wallet will receive metadata only; no transaction is initiated.</p></div>
          <StatusPill>{walletAddress ? 'Wallet connected' : 'Wallet disconnected'}</StatusPill>
        </div>
        {TINAN_TOKEN.explorerBaseUrl && TINAN_TOKEN.address ? <ExternalLinkButton href={`${TINAN_TOKEN.explorerBaseUrl}/token/${TINAN_TOKEN.address}`} label='Open configured token explorer' /> : null}
      </PageSection>
    </div>
  );
}

export function TINANTokenDetailPage({ walletAddress }: { walletAddress: string }) {
  const { address = '' } = useParams();
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Token details' title='Existing token information' description='Values are queried from the configured RPC and chain. This page does not assert verification.' />
      <TokenReadCard address={address} walletAddress={walletAddress || undefined} />
      {TINAN_TOKEN.explorerBaseUrl && isValidEvmAddress(address) ? <ExternalLinkButton href={`${TINAN_TOKEN.explorerBaseUrl}/token/${address}`} label='Open token explorer' /> : null}
    </div>
  );
}

export function TINANDashboardPage({
  address,
  network,
  nativeBalance,
  ekaBalance,
  recentTransactions,
}: {
  address: string;
  network: string;
  nativeBalance: string;
  ekaBalance: string;
  recentTransactions: RecentTransaction[];
}) {
  const [projects, setProjects] = useState<TINANProject[]>([]);
  const [projectLoadError, setProjectLoadError] = useState('');
  useEffect(() => {
    try {
      setProjects(listProjects());
    } catch (loadError) {
      setProjectLoadError(loadError instanceof Error ? loadError.message : 'Project data is unavailable.');
    }
  }, []);
  const analyzed = projects.filter((project) => project.blueprint);
  const tokenized = projects.filter((project) => ['TOKENIZING', 'DEPLOYED', 'VERIFIED', 'LIVE'].includes(project.status));
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Dashboard' title='A clear view of your TINAN workspace.' description='Project metrics are browser-local. Wallet and network fields are reported only from the connected wallet.' />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-7'>
        <MetricCard hint='Stored in this browser' label='Projects' value={String(projects.length)} />
        <MetricCard hint='Project status reflects saved workflow only' label='Tokenized projects' value={String(tokenized.length)} />
        <MetricCard hint='Saved local analyses' label='AI analyses' value={String(analyzed.length)} />
        <MetricCard hint='Wallet connection' label='Wallet' value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'} />
        <MetricCard hint='Connected wallet' label='Network' value={network} />
        <MetricCard hint={network} label='Native balance' value={address ? nativeBalance : 'Unavailable'} />
        <MetricCard hint='Live wallet read' label='EKA balance' value={address ? ekaBalance : 'Unavailable'} />
      </div>
      <PageSection>
        <h2 className='text-lg font-semibold'>Readiness snapshots</h2>
        {analyzed.length === 0 ? <p className='mt-3 text-sm text-white/60'>Analyze a project to calculate a transparent planning score.</p> : (
          <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
            {analyzed.slice(0, 6).map((project) => <li className='flex justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm' key={project.id}><Link className='truncate text-tinan-cyan' to={`/project/${project.id}`}>{project.title}</Link><span>{project.blueprint?.readinessScore ?? 0}/100</span></li>)}
          </ul>
        )}
        <p className='mt-3 text-xs text-white/50'>Scores are planning aids, not legal, financial, or compliance certification.</p>
      </PageSection>
      <PageSection>
        <h2 className='text-lg font-semibold'>Recent activity</h2>
        {projectLoadError ? <p className='mt-3 text-sm text-rose-200' role='alert'>{projectLoadError}</p> : null}
        {projects.length === 0 && recentTransactions.length === 0 ? <p className='mt-3 text-sm text-white/60'>No saved project updates or wallet transactions to show.</p> : (
          <ul className='mt-3 divide-y divide-white/10'>
            {projects.slice(0, 3).map((project) => <li className='flex flex-wrap justify-between gap-2 py-3 text-sm' key={project.id}><Link className='text-tinan-cyan' to={`/project/${project.id}`}>{project.title}</Link><span className='text-white/55'>{project.status} · {new Date(project.updatedAt).toLocaleString()}</span></li>)}
            {recentTransactions.slice(0, 3).map((transaction) => <li className='flex flex-wrap justify-between gap-2 py-3 text-sm' key={transaction.hash}><a className='text-tinan-cyan' href={`${EKA_TOKEN.explorerBaseUrl}/tx/${transaction.hash}`} rel='noreferrer' target='_blank'>Transaction {transaction.hash.slice(0, 10)}…</a><span className='text-white/55'>{new Date(transaction.createdAt).toLocaleString()}</span></li>)}
          </ul>
        )}
      </PageSection>
      <PageSection className='text-sm text-white/60'>Transactions, token balances, and readiness scores are not fabricated. Connect a wallet or configure a token RPC to load supported on-chain reads.</PageSection>
    </div>
  );
}

export function TINANContractsPage() {
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Contracts' title='Existing source and contract details.' description='Source code files in this repository are not proof of deployment or verification. A configured live contract address and chain are required to show on-chain details.' />
      <PageSection>
        <h2 className='text-lg font-semibold'>EKA · existing ERC-20</h2>
        <dl className='mt-4 grid gap-3 sm:grid-cols-2'>
          <DetailRow label='Address' value={EKA_TOKEN.contractAddress} breakAll />
          <DetailRow label='Network' value={EKA_TOKEN.chainName} />
          <DetailRow label='Explorer' value={`${EKA_TOKEN.explorerBaseUrl}/token/${EKA_TOKEN.contractAddress}`} breakAll />
          <DetailRow label='Verification' value='Not checked by this application' />
          <DetailRow label='Purpose' value='Existing Eureka ERC-20 asset; no replacement deployment is offered.' />
          <DetailRow label='ABI' value='ERC-20 read/transfer interface is available in the existing app.' />
        </dl>
      </PageSection>
      <PageSection>
        <h2 className='text-lg font-semibold'>Repository Solidity sources</h2>
        <ul className='mt-3 space-y-2 text-sm text-white/70'>
          <li>Contract/Eurika Protokol.sol · source present; deployment and verification status not configured here.</li>
          <li>Contract/EurikaAllInOne.sol · source present; deployment and verification status not configured here.</li>
        </ul>
        <p className='mt-3 text-xs text-white/55'>No deployment ABI or address is inferred from source files.</p>
      </PageSection>
    </div>
  );
}

export function TINANDeployPage() {
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Deploy' title='Deployment is intentionally disabled.' description='This page provides a safe checklist without submitting transactions or deploying a replacement token.' />
      <PageSection>
        <h2 className='text-lg font-semibold'>Before deployment</h2>
        <ol className='mt-3 list-decimal space-y-2 pl-5 text-sm text-white/70'>
          <li>Confirm the target chain, contract source, and constructor parameters.</li>
          <li>Review independent audits and applicable compliance requirements.</li>
          <li>Connect a wallet and review a live gas estimate from a configured network.</li>
          <li>Require a separate, explicit wallet confirmation; check finality before success.</li>
        </ol>
        <p className='mt-4 rounded-xl border border-amber-200/20 bg-amber-900/10 p-3 text-sm text-amber-100'>No deployable template, gas estimator, or transaction adapter is configured. No contract has been deployed.</p>
      </PageSection>
      <Link className='w-fit rounded-xl border border-white/15 px-4 py-2 text-sm' to='/contracts'>Review existing contracts</Link>
    </div>
  );
}

export function TINANVerifyPage() {
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState<{ address: string; chainId: SupportedEvmChain } | null>(null);
  const network = chainId ? EVM_NETWORKS[Number(chainId) as SupportedEvmChain] : null;
  function submit() {
    if (!isValidEvmAddress(address)) {
      setError('Enter a valid EVM address.');
      setLookup(null);
      return;
    }
    if (!network) {
      setError('Choose a supported EVM network.');
      setLookup(null);
      return;
    }
    setError('');
    setLookup({ address, chainId: network.chainId });
  }

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Verify' title='Check verification on the contract’s network explorer.' description='This app does not have an explorer verification API configured and will not claim a contract is verified.' />
      <PageSection>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='text-sm'>Contract address<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 font-mono' onChange={(event) => setAddress(event.target.value)} value={address} /></label>
          <label className='text-sm'>Network<select className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' onChange={(event) => setChainId(event.target.value)} value={chainId}><option value=''>Choose network</option>{NETWORK_OPTIONS.map((item) => <option key={item.chainId} value={item.chainId}>{item.name}</option>)}</select></label>
        </div>
        {error ? <p className='mt-3 text-sm text-rose-200' role='alert'>{error}</p> : null}
        <button className='mt-4 rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50' disabled={!address.trim() || !chainId} onClick={submit} type='button'>Prepare explorer lookup</button>
      </PageSection>
      {lookup ? (
        <PageSection>
          <StatusPill tone='warning'>Verification not checked</StatusPill>
          <p className='mt-3 break-all text-sm'>Address: {lookup.address} · Network: {EVM_NETWORKS[lookup.chainId].name}</p>
          <ExternalLinkButton href={`${EVM_NETWORKS[lookup.chainId].explorerBaseUrl}/address/${lookup.address}#code`} label='Open explorer source-code page' />
        </PageSection>
      ) : null}
    </div>
  );
}

export type TINANInfoPageKind = 'community' | 'docs' | 'about' | 'privacy' | 'terms' | 'settings';

const INFO_CONTENT: Record<Exclude<TINANInfoPageKind, 'settings'>, { title: string; intro: string; sections: Array<[string, string]> }> = {
  community: {
    title: 'Build with the community.',
    intro: 'Community surfaces are open for future integration; no user-generated projects or membership claims are fabricated here.',
    sections: [['Projects', 'Browse locally saved projects in this browser. Shared project publishing is not connected.'], ['Builders', 'Wallet, identity, and contribution integrations remain opt-in and are not enabled by this demo.'], ['Ideas', 'Use TINAN AI to draft an idea and save it locally.']],
  },
  docs: {
    title: 'TINAN AI documentation.',
    intro: 'This guide describes the existing product behavior and configuration boundaries.',
    sections: [['TINAN AI', 'The current DemoAIProvider is deterministic, runs in the browser, and does not call an external AI API.'], ['Tokenization', 'The wizard builds a local concept only. No contract is created and no transaction is sent.'], ['Existing tokens and wallets', 'EKA and TINAN token configuration are kept distinct. Wallet interactions remain explicit; never share a private key or seed phrase.'], ['Networks and contracts', 'EVM network metadata is centralized. RPC and token chain settings must be configured; repository Solidity sources do not establish deployment status.'], ['Data Proof and energy', 'A proof needs a real source, timestamp, content hash, and transaction before any verified or anchored status can be claimed. No measurements are generated.'], ['Security and APIs', 'Never put private provider keys in VITE_ variables. Use server-side secrets and a protected Worker/API proxy for future private APIs.']],
  },
  about: {
    title: 'EUREKA — A BRIGHTER TOMORROW.',
    intro: 'TINAN AI helps organize natural intelligence into clear project and tokenization plans.',
    sections: [['Tagline', 'Not Artificial Intelligence. Natural Intelligence.'], ['Product', 'A project-planning and Web3 interface built on the existing EurekaCore application.'], ['Principle', 'Real-world data and blockchain claims must be traceable to an actual source.']],
  },
  privacy: {
    title: 'Privacy overview.',
    intro: 'This page is a product summary, not a legal privacy notice.',
    sections: [['Local project storage', 'Project drafts and AI blueprints created here are saved in browser localStorage on this device. Clearing browser storage may remove them.'], ['Wallet data', 'Wallet actions use the existing wallet provider flow. The app does not request or store private keys or seed phrases.'], ['External services', 'Configured RPC providers receive requests required to read blockchain data. Review the selected provider’s privacy terms before connecting.']],
  },
  terms: {
    title: 'Use and limitations.',
    intro: 'This product interface is experimental planning software and is not legal, financial, tax, investment, or compliance advice.',
    sections: [['Demo output', 'Demo analyses are generated locally from the text supplied and can be incomplete or incorrect. Verify all facts independently.'], ['Transactions', 'Never sign a transaction without reviewing its chain, contract, recipient, and values in your wallet.'], ['Professional review', 'Token design, rights, compliance, and deployment decisions require qualified independent review.']],
  },
};

export function TINANInfoPage({ kind, address, network }: { kind: TINANInfoPageKind; address?: string; network?: string }) {
  const navigate = useNavigate();

  if (kind === 'settings') {
    return (
      <div className='grid gap-4'>
        <PageHero eyebrow='Settings' title='Application and connection settings.' description='Secrets are never displayed here. AI runs locally in Demo mode.' />
        <PageSection className='grid gap-3'>
          <DetailRow label='Wallet' value={address || 'Disconnected'} breakAll />
          <DetailRow label='Active network' value={network || 'Disconnected'} />
          <DetailRow label='AI provider' value='Deterministic DemoAIProvider · local only' />
          <DetailRow label='RPC configuration' value={TINAN_TOKEN.rpcUrl ? 'Configured (value hidden)' : 'Not configured'} />
          <DetailRow label='Token network' value={TINAN_TOKEN.networkName ?? 'Not configured'} />
          <div className='flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4 text-sm'>
            <span>Demo mode</span>
            <StatusPill tone='warning'>Always on</StatusPill>
          </div>
          <p className='text-xs text-white/55'>The deterministic local DemoAIProvider is the only configured AI provider. Analysis does not call an external API.</p>
          <button className='w-fit rounded-xl border border-white/15 px-4 py-2 text-sm' onClick={() => navigate('/wallet')} type='button'>Open wallet settings</button>
        </PageSection>
      </div>
    );
  }

  const content = INFO_CONTENT[kind];
  return (
    <div className='grid gap-4'>
      <PageHero eyebrow={kind} title={content.title} description={content.intro} />
      <div className='grid gap-4 md:grid-cols-2'>
        {content.sections.map(([title, description]) => (
          <PageSection key={title}>
            <h2 className='text-lg font-semibold'>{title}</h2>
            <p className='mt-3 text-sm leading-7 text-white/70'>{description}</p>
          </PageSection>
        ))}
      </div>
      {kind === 'docs' ? <PageSection className='text-sm text-white/60'>Network selection is architectural until chain/RPC settings and wallet support are explicitly configured. Token verification is not asserted unless it has been checked with a real explorer source.</PageSection> : null}
    </div>
  );
}

export function ExistingTokenNetworkLabel() {
  return <span>{TINAN_TOKEN.networkName ?? 'Network not configured'}</span>;
}

export function EvmNetworkSelector({ value, onChange }: { value: string; onChange: (chainId: string) => void }) {
  return (
    <label className='block text-sm'>Network
      <select className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' onChange={(event) => onChange(event.target.value)} value={value}>
        <option value=''>Choose a supported chain</option>
        {NETWORK_OPTIONS.map((item) => <option key={item.chainId} value={String(item.chainId)}>{item.name}</option>)}
      </select>
    </label>
  );
}
