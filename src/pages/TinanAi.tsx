import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { PageHero, PageSection, RouteButton, StatusPill } from '../components/ui';

export function TinanAiPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='INTRODUCING TINAN AI'
        title='Not Artificial Intelligence. Natural Intelligence.'
        description='TINAN AI is designed to help people organize, structure, classify, and prepare valuable information for tokenization. No external AI provider or API is configured in this frontend, so it does not generate or invent analysis, summaries, or verification results.'
        actions={
          <>
            <RouteButton label='Open data workspace' to='/assets' />
            <RouteButton label='Review token config' to='/tinan-ai-token' />
            <RouteButton label='Open Pump.fun page' to='/pumpfun' />
          </>
        }
      />

      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Organize', 'Structure user-provided information into local knowledge records without claiming automated AI analysis.'],
          ['Prepare', 'Create content hashes and metadata packages without uploading source files or creating on-chain tokens.'],
          ['Extend', 'Keep the assistant ready for authenticated provider-backed analysis and summaries when a secure backend exists.'],
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
            <h2 className='mt-2 text-2xl font-semibold text-white'>Existing Solana token configuration</h2>
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
