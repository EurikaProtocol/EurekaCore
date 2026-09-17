import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { TINAN_SYSTEM_PROMPT, TINAN_SYSTEM_PROMPT_TEXT } from '../content/tinan-system-prompt';
import { PageHero, PageSection, RouteButton, StatusPill } from '../components/ui';

export function TinanAiPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='TinanAI'
        title={`${TINAN_SYSTEM_PROMPT.name} system prompt ${TINAN_SYSTEM_PROMPT.version}`}
        description='TINAN AI is defined here as the engineering intelligence for the EUREKA ecosystem, with explicit product scope, delivery standards, response structure, and security boundaries.'
        actions={
          <>
            <RouteButton label='Review token config' to='/tinan-ai-token' />
            <RouteButton label='Open Pump.fun page' to='/pumpfun' />
          </>
        }
      />

      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Identity', `${TINAN_SYSTEM_PROMPT.name} was created by ${TINAN_SYSTEM_PROMPT.creator} and operates as ${TINAN_SYSTEM_PROMPT.role}.`],
          ['Mission', TINAN_SYSTEM_PROMPT.mission.join(' ')],
          ['Language', `${TINAN_SYSTEM_PROMPT.primaryLanguage} is the default operating language, with ${TINAN_SYSTEM_PROMPT.secondaryLanguage} available when requested.`],
        ].map(([title, description]) => (
          <PageSection key={title} className='p-5'>
            <h3 className='text-xl font-semibold text-white'>{title}</h3>
            <p className='mt-3 text-sm leading-7 text-white/75'>{description}</p>
          </PageSection>
        ))}
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Product mandate</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>EUREKA ecosystem scope</h2>
            </div>
            <StatusPill>{TINAN_SYSTEM_PROMPT.products.length} products</StatusPill>
          </div>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            {TINAN_SYSTEM_PROMPT.products.map((product) => (
              <li key={product}>{product}</li>
            ))}
          </ul>
        </PageSection>

        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Execution rules</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>Delivery standards</h2>
            </div>
            <StatusPill tone='success'>Production-first</StatusPill>
          </div>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            {TINAN_SYSTEM_PROMPT.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </PageSection>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1.4fr,1fr]'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>System prompt source</p>
          <h2 className='mt-2 text-2xl font-semibold text-white'>Canonical prompt text</h2>
          <pre
            aria-label='TINAN AI system prompt text'
            className='mt-4 overflow-x-auto rounded-3xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-white/75 whitespace-pre-wrap'
            tabIndex={0}
          >
            {TINAN_SYSTEM_PROMPT_TEXT}
          </pre>
        </PageSection>

        <div className='grid gap-4'>
          <PageSection>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Design language</p>
            <div className='mt-4 space-y-4 text-sm text-white/75'>
              <div>
                <h3 className='font-semibold text-white'>Theme</h3>
                <p className='mt-2'>{TINAN_SYSTEM_PROMPT.designLanguage.theme.join(' • ')}</p>
              </div>
              <div>
                <h3 className='font-semibold text-white'>Style</h3>
                <p className='mt-2'>{TINAN_SYSTEM_PROMPT.designLanguage.style.join(' • ')}</p>
              </div>
              <div>
                <h3 className='font-semibold text-white'>Typography</h3>
                <p className='mt-2'>{TINAN_SYSTEM_PROMPT.designLanguage.typography.join(' • ')}</p>
              </div>
            </div>
          </PageSection>

          <PageSection>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Build contract</p>
            <div className='mt-4 space-y-4 text-sm text-white/75'>
              <div>
                <h3 className='font-semibold text-white'>Response format</h3>
                <ol className='mt-2 list-decimal space-y-2 pl-5'>
                  {TINAN_SYSTEM_PROMPT.responseFormat.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className='font-semibold text-white'>Runtime assertions</h3>
                <ul className='mt-2 space-y-2'>
                  {TINAN_SYSTEM_PROMPT.runtimeAssertions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className='font-semibold text-white'>Cloudflare stack</h3>
                <p className='mt-2'>{TINAN_SYSTEM_PROMPT.cloudflare.join(' • ')}</p>
              </div>
              <div>
                <h3 className='font-semibold text-white'>Coding style</h3>
                <p className='mt-2'>{TINAN_SYSTEM_PROMPT.codingStyle.join(' • ')}</p>
              </div>
            </div>
          </PageSection>
        </div>
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

      <div className='grid gap-4 md:grid-cols-2'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Smart contract standard</p>
          <h2 className='mt-2 text-2xl font-semibold text-white'>{TINAN_SYSTEM_PROMPT.contractStandards.tokenName}</h2>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            <li>Symbol: {TINAN_SYSTEM_PROMPT.contractStandards.tokenSymbol}</li>
            <li>Decimals: {TINAN_SYSTEM_PROMPT.contractStandards.decimals}</li>
            <li>Networks: {TINAN_SYSTEM_PROMPT.contractStandards.networks.join(' • ')}</li>
          </ul>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Default workspace</p>
          <h2 className='mt-2 text-2xl font-semibold text-white'>Expected delivery tree</h2>
          <ul className='mt-4 space-y-3 font-mono text-sm text-white/75'>
            {TINAN_SYSTEM_PROMPT.folderTree.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </PageSection>
      </div>
    </div>
  );
}
