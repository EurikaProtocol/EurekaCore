import { EKA_CONTRACT_URL } from '../config/token';
import { PROJECT_IDENTITY } from '../core/identity';
import { ExternalLinkButton, PageHero, PageSection } from '../components/ui';

export function WhitepaperPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Whitepaper v2.0'
        title={PROJECT_IDENTITY.whitepaperTitle}
        description='Read the official EUREKA CHAIN whitepaper directly in-app, download the PDF, and review the production-safe token split between EKA on EVM and the separate TinanAI Token on Solana.'
        actions={
          <>
            <a className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-tinan-turquoise' download href={PROJECT_IDENTITY.whitepaperPath}>
              Download PDF
            </a>
            <ExternalLinkButton href={EKA_CONTRACT_URL} label='View EKA contract' />
          </>
        }
      />

      <PageSection>
        <div className='grid gap-4 lg:grid-cols-[1.3fr_0.7fr]'>
          <object className='min-h-[72vh] w-full rounded-2xl border border-white/10 bg-black/30' data={PROJECT_IDENTITY.whitepaperPath} type='application/pdf'>
            <div className='flex min-h-[72vh] items-center justify-center p-8 text-center text-sm text-white/70'>
              Your browser cannot render the embedded PDF. Download the official whitepaper instead.
            </div>
          </object>
          <div className='grid gap-3'>
            <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <p className='text-sm text-white/55'>Brand</p>
              <p className='mt-2 text-white'>{PROJECT_IDENTITY.brand}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <p className='text-sm text-white/55'>EVM token</p>
              <p className='mt-2 text-white'>EKA on Ethereum Mainnet</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <p className='text-sm text-white/55'>Solana token</p>
              <p className='mt-2 text-white'>TinanAI Token, configured only from env values</p>
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
