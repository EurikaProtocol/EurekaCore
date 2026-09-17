import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { DetailRow, ExternalLinkButton, PageHero, PageSection, StatusPill } from '../components/ui';
import { readSolanaWalletSnapshot } from '../sdk/solana';
import { getSolscanAddressUrl, getSolscanTokenUrl } from '../solana/connection';

export function TinanAiTokenPage() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState(TINANAI_SOLANA.mintAddress ? '0' : 'Mint not configured');
  const [status, setStatus] = useState('Connect Phantom to read wallet-linked Solana balances.');
  const publicKeyBase58 = publicKey?.toBase58() ?? '';

  useEffect(() => {
    if (!connected || !publicKeyBase58) {
      setStatus('Connect Phantom to read wallet-linked Solana balances.');
      return;
    }

    readSolanaWalletSnapshot(connection, publicKeyBase58, TINANAI_SOLANA.mintAddress)
      .then((snapshot) => {
        setSolBalance(snapshot.solBalance);
        setTokenBalance(snapshot.tokenBalance);
        setStatus('Solana balances loaded.');
      })
      .catch((error: Error) => setStatus(`Solana read failed: ${error.message}`));
  }, [connected, connection, publicKeyBase58]);

  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='TinanAI Token'
        title='Solana token configuration stays env-driven and separate from EKA.'
        description='The TinanAI Token route never hardcodes unofficial mint values. It reads the configured Solana mint, metadata URI, and Pump.fun URL from environment variables and surfaces clear validation status.'
      />

      <div className='grid gap-4 lg:grid-cols-[1.1fr_0.9fr]'>
        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Token config</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>Official Solana values</h2>
            </div>
            <StatusPill tone={TINANAI_SOLANA.mintConfigured ? 'success' : 'warning'}>{TINANAI_SOLANA.mintConfigured ? 'Mint configured' : 'Mint missing'}</StatusPill>
          </div>
          <div className='mt-4 grid gap-3'>
            <DetailRow label='Network' value={TINANAI_SOLANA.network} />
            <DetailRow breakAll label='Mint' value={TINANAI_SOLANA.mintAddress ?? 'Missing official mint'} />
            <DetailRow breakAll label='Metadata URI' value={TINANAI_SOLANA.metadataUri ?? 'Missing official metadata URI'} />
            <DetailRow breakAll label='Pump.fun URL' value={TINANAI_SOLANA.pumpfunUrl ?? 'Missing official Pump.fun URL'} />
          </div>
        </PageSection>

        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Wallet visibility</p>
          <div className='mt-4 grid gap-3'>
            <DetailRow breakAll label='Connected wallet' value={publicKeyBase58 || 'Disconnected'} />
            <DetailRow label='SOL balance' value={solBalance} />
            <DetailRow label='TinanAI token balance' value={tokenBalance} />
            <DetailRow label='Status' value={status} />
          </div>
          <div className='mt-5 flex flex-wrap gap-3'>
            <ExternalLinkButton href={TINANAI_SOLANA.mintAddress ? getSolscanTokenUrl(TINANAI_SOLANA.mintAddress) : null} label='Open Solscan token' />
            <ExternalLinkButton href={publicKeyBase58 ? getSolscanAddressUrl(publicKeyBase58) : null} label='Open Solscan wallet' />
            <ExternalLinkButton href={TINANAI_SOLANA.pumpfunUrl} label='Open Pump.fun' />
          </div>
        </PageSection>
      </div>
    </div>
  );
}
