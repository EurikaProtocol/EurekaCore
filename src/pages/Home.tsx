import { ECOSYSTEM_ASSETS } from '../core/asset';
import { DEVICE_SURFACES } from '../core/device';
import { PROJECT_IDENTITY } from '../core/identity';
import { PROOF_MODULES } from '../core/proof';
import { DetailRow, PageHero, PageSection, RouteButton, StatusPill } from '../components/ui';

export function HomePage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Production control plane'
        title='Build the EUREKA ecosystem without blurring EKA and TinanAI.'
        description='This interface keeps EKA on Ethereum Mainnet, keeps the TinanAI Token on Solana, validates official links before rendering them, and preserves the premium TinanEureka identity across wallet, explorer, marketplace, and whitepaper flows.'
        actions={
          <>
            <RouteButton label='Open wallet hub' to='/wallet' />
            <RouteButton label='Review TinanAI token' to='/tinan-ai-token' />
          </>
        }
      />

      <div className='grid gap-4 lg:grid-cols-2'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Core identity</p>
          <div className='mt-4 grid gap-3'>
            <DetailRow label='Protocol' value={PROJECT_IDENTITY.protocol} />
            <DetailRow label='Core AI' value={PROJECT_IDENTITY.coreAI} />
            <DetailRow label='Core engine' value={PROJECT_IDENTITY.coreEngine} />
            <DetailRow label='Brand' value={PROJECT_IDENTITY.brand} />
          </div>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Asset separation</p>
          <div className='mt-4 grid gap-3'>
            {ECOSYSTEM_ASSETS.map((asset) => (
              <article key={asset.id} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
                <div className='flex items-center justify-between gap-2'>
                  <div>
                    <h3 className='text-lg font-semibold text-white'>{asset.symbol}</h3>
                    <p className='text-sm text-white/70'>{asset.name}</p>
                  </div>
                  <StatusPill tone={asset.status === 'ready' ? 'success' : 'warning'}>{asset.type}</StatusPill>
                </div>
                <p className='mt-3 text-sm text-white/75'>{asset.summary}</p>
                <div className='mt-3 grid gap-2 text-sm text-white/70'>
                  <span>Network: {asset.network}</span>
                  <span className='break-all'>Location: {asset.location}</span>
                </div>
              </article>
            ))}
          </div>
        </PageSection>
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        {PROOF_MODULES.map((module) => (
          <PageSection key={module.title} className='p-5'>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Proof module</p>
            <h3 className='mt-2 text-xl font-semibold text-white'>{module.title}</h3>
            <p className='mt-3 text-sm leading-7 text-white/75'>{module.description}</p>
          </PageSection>
        ))}
      </div>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Device and trust surfaces</p>
        <div className='mt-4 grid gap-4 md:grid-cols-3'>
          {DEVICE_SURFACES.map((surface) => (
            <article key={surface.title} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <h3 className='text-lg font-semibold text-white'>{surface.title}</h3>
              <p className='mt-3 text-sm leading-7 text-white/75'>{surface.description}</p>
            </article>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
