import type { EvmWalletController } from '../hooks/useEvmWallet';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { MetricCard, PageHero, PageSection, StatusPill } from '../components/ui';

export function DashboardPage({ evm }: { evm: EvmWalletController }) {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Dashboard'
        title='Protocol health and wallet visibility'
        description='Monitor EVM wallet state, live EKA availability, and Solana configuration readiness from one production-safe dashboard.'
      />

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        <MetricCard hint='Available only when connected to Ethereum Mainnet.' label='EKA balance' value={evm.state.connected ? `${evm.state.ekaBalance} EKA` : 'Connect wallet'} />
        <MetricCard label='Native balance' value={evm.state.connected ? `${evm.state.nativeBalance} ${evm.state.nativeSymbol}` : 'Connect wallet'} />
        <MetricCard label='Total supply' value={evm.state.totalSupply} />
        <MetricCard label='Burned tokens' value={evm.state.burnedTokens} />
        <MetricCard label='EVM network' value={evm.state.network} />
        <MetricCard label='Solana network' value={TINANAI_SOLANA.network} />
      </div>

      <div className='grid gap-4 lg:grid-cols-[1.3fr_0.7fr]'>
        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Runtime status</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>Chain separation checks</h2>
            </div>
            <StatusPill tone={evm.state.ekaReady ? 'success' : 'warning'}>{evm.state.ekaReady ? 'EKA ready' : 'Switch network'}</StatusPill>
          </div>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            <li>EKA contract interactions are limited to Ethereum Mainnet.</li>
            <li>TinanAI Token reads depend on env-driven Solana mint and RPC values.</li>
            <li>External links are displayed only after trusted-host validation.</li>
            <li>Wallet actions always wait for explicit user approval.</li>
          </ul>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Solana config</p>
          <div className='mt-4 grid gap-3 text-sm text-white/75'>
            <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <span className='text-white/55'>Mint status</span>
              <p className='mt-2 break-all text-white'>{TINANAI_SOLANA.mintAddress ?? 'Missing official mint value'}</p>
            </div>
            <div className='rounded-2xl border border-white/10 bg-black/20 p-4'>
              <span className='text-white/55'>Validation issues</span>
              <p className='mt-2 text-white'>{TINANAI_SOLANA.issues.length ? TINANAI_SOLANA.issues.join(' ') : 'No config issues detected.'}</p>
            </div>
          </div>
        </PageSection>
      </div>
    </div>
  );
}
