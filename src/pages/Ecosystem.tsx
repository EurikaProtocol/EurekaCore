import { PageHero, PageSection, StatusPill } from '../components/ui';

const NETWORKS = [
  { name: 'Ethereum', status: 'Active', capability: 'EKA wallet, ERC-20 reads, and wallet-approved transfers.' },
  { name: 'Solana', status: 'Active', capability: 'Phantom wallet connection and configured SPL token balance reads.' },
  { name: 'Arbitrum', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'BNB Chain', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Polygon', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Base', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Avalanche', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Optimism', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Stellar', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'XRP Ledger', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'TRON', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Dogecoin', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
  { name: 'Litecoin', status: 'Coming soon', capability: 'No EUREKA data-tokenization integration is enabled.' },
];

const ROADMAP = [
  ['Phase 1 · Foundation', 'Eureka ecosystem, TINAN AI, data-tokenization architecture, and proof record models.'],
  ['Phase 2 · Data Engine', 'File hashing and metadata records are available locally; remote storage and on-chain tokenization are not connected.'],
  ['Phase 3 · AI Intelligence', 'Provider-backed classification and summarization require a secure, authenticated backend that is not present yet.'],
  ['Phase 4 · Data Economy', 'Marketplace settlement, cross-chain assets, and developer APIs remain future work.'],
];

export function EcosystemPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='EUREKA ECOSYSTEM'
        title='Existing integrations, clearly separated from what is coming next.'
        description='EKA wallet operations remain on Ethereum. TINAN AI token reads remain on Solana. Other networks are listed as coming soon until working integrations exist; no network here represents a data-token minting integration.'
      />

      <PageSection>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {NETWORKS.map((network) => (
            <article key={network.name} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <div className='flex items-center justify-between gap-2'>
                <h2 className='font-semibold text-white'>{network.name}</h2>
                <StatusPill tone={network.status === 'Active' ? 'success' : 'neutral'}>{network.status}</StatusPill>
              </div>
              <p className='mt-3 text-sm leading-6 text-white/65'>{network.capability}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Roadmap</p>
        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          {ROADMAP.map(([phase, description]) => (
            <article key={phase} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <h2 className='font-semibold text-white'>{phase}</h2>
              <p className='mt-2 text-sm leading-6 text-white/65'>{description}</p>
            </article>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
