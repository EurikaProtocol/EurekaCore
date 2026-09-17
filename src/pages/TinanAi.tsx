import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { PageHero, PageSection, RouteButton, StatusPill } from '../components/ui';

export function TinanAiPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='TinanAI'
        title='AI orchestration is ready for official Solana-linked token metadata.'
        description='TinanAI routes focus on verified data, licensing, and automation surfaces. Production deployment still requires official Solana metadata and Pump.fun values before public token launch messaging is complete.'
        actions={
          <>
            <RouteButton label='Review token config' to='/tinan-ai-token' />
            <RouteButton label='Open Pump.fun page' to='/pumpfun' />
          </>
        }
      />

      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Assist', 'Route TinanAI features through wallet-owned sessions, verified assets, and explicit user permissions.'],
          ['Verify', 'Keep proof, device, and marketplace data aligned with trusted on-chain identities and metadata.'],
          ['Monetize', 'Expose licensing and commerce flows only after official settlement rails are configured.'],
        ].map(([title, description]) => (
          <PageSection key={title} className='p-5'>
            <h3 className='text-xl font-semibold text-white'>{title}</h3>
            <p className='mt-3 text-sm leading-7 text-white/75'>{description}</p>
          </PageSection>
        ))}
      </div>

      <PageSection>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Configuration readiness</p>
            <h2 className='mt-2 text-2xl font-semibold text-white'>Solana deployment status</h2>
          </div>
          <StatusPill tone={TINANAI_SOLANA.issues.length ? 'warning' : 'success'}>{TINANAI_SOLANA.issues.length ? 'Action required' : 'Configured'}</StatusPill>
        </div>
        <ul className='mt-4 space-y-3 text-sm text-white/75'>
          <li>Network: {TINANAI_SOLANA.network}</li>
          <li className='break-all'>Mint: {TINANAI_SOLANA.mintAddress ?? 'Awaiting configured value'}</li>
          <li className='break-all'>Metadata URI: {TINANAI_SOLANA.metadataUri ?? 'Awaiting official metadata URI'}</li>
        </ul>
      </PageSection>
    </div>
  );
}
