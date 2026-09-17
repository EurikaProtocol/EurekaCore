import { PageHero, PageSection } from '../components/ui';

export function SwapPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Swap'
        title='Swap routing is staged, but not enabled with fabricated liquidity paths.'
        description='This route keeps messaging accurate until official DEX/router contracts are approved. EKA and the separate TinanAI Token are intentionally not bridged or auto-routed here.'
      />
      <PageSection>
        <ul className='space-y-3 text-sm text-white/75'>
          <li>EKA swap support requires official EVM router integrations.</li>
          <li>TinanAI Token launch routing should point only to verified Solana or Pump.fun destinations.</li>
          <li>No fake quotes, pools, or price charts are rendered in production.</li>
        </ul>
      </PageSection>
    </div>
  );
}
