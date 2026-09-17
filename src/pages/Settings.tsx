import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { PageHero, PageSection, StatusPill } from '../components/ui';

const ENVIRONMENT_ROWS = [
  ['VITE_SOLANA_NETWORK', TINANAI_SOLANA.network],
  ['VITE_SOLANA_RPC_URL', TINANAI_SOLANA.rpcUrl],
  ['VITE_TINANAI_SOLANA_MINT', TINANAI_SOLANA.mintAddress ?? 'Missing'],
  ['VITE_PUMPFUN_TOKEN_URL', TINANAI_SOLANA.pumpfunUrl ?? 'Missing'],
  ['VITE_TINANAI_METADATA_URI', TINANAI_SOLANA.metadataUri ?? 'Missing'],
  ['VITE_WALLETCONNECT_PROJECT_ID', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? 'Configured' : 'Missing'],
] as const;

export function SettingsPage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Settings'
        title='Environment and deployment readiness'
        description='Review env-driven wallet and Solana settings before deployment. Production rollout should only proceed once official RPC, metadata, Pump.fun, and WalletConnect values are in place.'
      />

      <PageSection>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Runtime env</p>
            <h2 className='mt-2 text-2xl font-semibold text-white'>Configuration matrix</h2>
          </div>
          <StatusPill tone={TINANAI_SOLANA.issues.length ? 'warning' : 'success'}>{TINANAI_SOLANA.issues.length ? 'Review values' : 'Healthy'}</StatusPill>
        </div>
        <div className='mt-4 grid gap-3'>
          {ENVIRONMENT_ROWS.map(([label, value]) => (
            <div key={label} className='rounded-2xl border border-white/10 bg-black/20 px-4 py-3'>
              <p className='text-sm text-tinan-cyan'>{label}</p>
              <p className='mt-1 break-all text-sm text-white/90'>{value}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection>
        <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Outstanding items</p>
        <ul className='mt-4 space-y-3 text-sm text-white/75'>
          {(TINANAI_SOLANA.issues.length ? TINANAI_SOLANA.issues : ['No Solana validation issues detected.']).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </PageSection>
    </div>
  );
}
