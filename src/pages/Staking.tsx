import { PageHero, PageSection } from '../components/ui';

export function StakingPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Staking'
        title='Staking remains disabled until official contracts are published.'
        description='No staking contract addresses are hardcoded here. Add official audited staking contracts and reward rules before enabling production staking actions for EKA or any future Solana-linked campaign.'
      />
      <PageSection>
        <ul className='space-y-3 text-sm text-white/75'>
          <li>Keep EKA staking on EVM contracts only after audited addresses are approved.</li>
          <li>Do not imply Solana staking support without official Solana programs and wallet approval flows.</li>
          <li>Use this route as a configuration checkpoint until production values are available.</li>
        </ul>
      </PageSection>
    </div>
  );
}
