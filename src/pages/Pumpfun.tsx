import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { ExternalLinkButton, PageHero, PageSection, StatusPill } from '../components/ui';

export function PumpfunPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Pump.fun'
        title='Pump.fun launch links are verified before display.'
        description='This route exposes only the trusted Pump.fun URL supplied by environment variables. If no official launch URL is configured, the page stays informational instead of inventing one.'
      />

      <PageSection>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Launch status</p>
            <h2 className='mt-2 text-2xl font-semibold text-white'>Solana launch readiness</h2>
          </div>
          <StatusPill tone={TINANAI_SOLANA.pumpfunUrl ? 'success' : 'warning'}>{TINANAI_SOLANA.pumpfunUrl ? 'Verified URL' : 'Awaiting URL'}</StatusPill>
        </div>
        <div className='mt-4 grid gap-3 text-sm text-white/75'>
          <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
            <p className='text-white/55'>Configured mint</p>
            <p className='mt-2 break-all text-white'>{TINANAI_SOLANA.mintAddress ?? 'Missing official mint'}</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
            <p className='text-white/55'>Launch URL</p>
            <p className='mt-2 break-all text-white'>{TINANAI_SOLANA.pumpfunUrl ?? 'Missing official Pump.fun URL'}</p>
          </div>
        </div>
        <div className='mt-5 flex flex-wrap gap-3'>
          <ExternalLinkButton href={TINANAI_SOLANA.pumpfunUrl} label='Open Pump.fun token page' />
        </div>
      </PageSection>
    </div>
  );
}
