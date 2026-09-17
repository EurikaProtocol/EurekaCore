import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { EKA_CONTRACT_URL, EKA_TOKEN } from '../config/token';
import { ExternalLinkButton, PageHero, PageSection } from '../components/ui';
import type { EvmWalletController } from '../hooks/useEvmWallet';
import { getSolscanAddressUrl, getSolscanTokenUrl } from '../solana/connection';

export function ExplorerPage({ evm }: { evm: EvmWalletController }) {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Explorer'
        title='Verified explorer exits only.'
        description='Open official Etherscan and Solscan destinations after host validation. Explorer links stay chain-accurate and never fabricate token or wallet destinations.'
      />

      <div className='grid gap-4 xl:grid-cols-2'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>EVM explorer</p>
          <div className='mt-4 flex flex-wrap gap-3'>
            <ExternalLinkButton href={EKA_CONTRACT_URL} label='Open EKA contract' />
            <ExternalLinkButton href={evm.state.address ? `${evm.state.explorerBaseUrl}/address/${evm.state.address}` : null} label='Open connected EVM wallet' />
            <ExternalLinkButton href={evm.lastTxHash ? `${evm.state.explorerBaseUrl}/tx/${evm.lastTxHash}` : null} label='Open last EVM tx' />
          </div>
          <p className='mt-4 text-sm text-white/70'>Current EVM route: {EKA_TOKEN.chainName}</p>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Solana explorer</p>
          <div className='mt-4 flex flex-wrap gap-3'>
            <ExternalLinkButton href={TINANAI_SOLANA.mintAddress ? getSolscanTokenUrl(TINANAI_SOLANA.mintAddress) : null} label='Open TinanAI mint' />
            <ExternalLinkButton href={evm.state.address && TINANAI_SOLANA.mintAddress ? getSolscanTokenUrl(TINANAI_SOLANA.mintAddress) : TINANAI_SOLANA.mintAddress ? getSolscanTokenUrl(TINANAI_SOLANA.mintAddress) : null} label='Open Solana token page' />
            <ExternalLinkButton href={TINANAI_SOLANA.mintAddress ? getSolscanAddressUrl(TINANAI_SOLANA.mintAddress) : null} label='Open mint account view' />
          </div>
          <p className='mt-4 text-sm text-white/70'>Configured Solana network: {TINANAI_SOLANA.network}</p>
        </PageSection>
      </div>
    </div>
  );
}
