import type { WalletName } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { EKA_TOKEN } from '../config/token';
import { DetailRow, ExternalLinkButton, PageHero, PageSection, StatusPill } from '../components/ui';
import { shortenAddress } from '../core/verify';
import type { EvmWalletController } from '../hooks/useEvmWallet';
import { readSolanaWalletSnapshot } from '../sdk/solana';
import { getSolscanAddressUrl, getSolscanTokenUrl } from '../solana/connection';
import { METAMASK_DOWNLOAD_URL, PHANTOM_DOWNLOAD_URL, WALLETCONNECT_URL } from '../solana/wallet';

export function WalletPage({ evm }: { evm: EvmWalletController }) {
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const { connection } = useConnection();
  const { connect, connected, disconnect, publicKey, select, wallets } = useWallet();
  const [solanaStatus, setSolanaStatus] = useState('Solana wallet disconnected.');
  const [solBalance, setSolBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');

  const publicKeyBase58 = publicKey?.toBase58() ?? '';
  const phantomWallet = useMemo(() => wallets.find((wallet) => wallet.adapter.name === 'Phantom'), [wallets]);

  const refreshSolana = useCallback(async () => {
    if (!publicKeyBase58) {
      setSolBalance('0');
      setTokenBalance(TINANAI_SOLANA.mintAddress ? '0' : 'Mint not configured');
      return;
    }

    const snapshot = await readSolanaWalletSnapshot(connection, publicKeyBase58, TINANAI_SOLANA.mintAddress);
    setSolBalance(snapshot.solBalance);
    setTokenBalance(snapshot.tokenBalance);
  }, [connection, publicKeyBase58]);

  useEffect(() => {
    refreshSolana().catch((error: Error) => setSolanaStatus(`Solana refresh failed: ${error.message}`));
  }, [refreshSolana]);

  const connectPhantom = useCallback(async () => {
    if (!phantomWallet) {
      setSolanaStatus('Phantom adapter is unavailable. Install Phantom to continue.');
      return;
    }

    try {
      select(phantomWallet.adapter.name as WalletName<string>);
      await phantomWallet.adapter.connect();
      setSolanaStatus('Phantom connection requested. Approve the wallet prompt to continue.');
    } catch (error) {
      setSolanaStatus(`Phantom connection failed: ${(error as Error).message}`);
    }
  }, [phantomWallet, select]);

  const disconnectPhantom = useCallback(async () => {
    try {
      await disconnect();
      setSolanaStatus('Solana wallet disconnected.');
    } catch (error) {
      setSolanaStatus(`Solana disconnect failed: ${(error as Error).message}`);
    }
  }, [disconnect]);

  useEffect(() => {
    if (connected && publicKeyBase58) {
      setSolanaStatus('Phantom connected. Solana reads remain separate from EKA actions.');
    }
  }, [connected, publicKeyBase58]);

  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Wallet hub'
        title='Connect EVM and Solana wallets with explicit approval.'
        description='MetaMask and WalletConnect manage EKA on Ethereum Mainnet. Phantom manages the separate TinanAI Token flow on Solana. No wallet action auto-signs or auto-submits transactions.'
      />

      <div className='grid gap-4 xl:grid-cols-2'>
        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>EKA wallet</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>EVM flow</h2>
            </div>
            <StatusPill tone={evm.state.connected ? 'success' : 'warning'}>{evm.state.connected ? 'Connected' : 'Disconnected'}</StatusPill>
          </div>

          <div className='mt-4 flex flex-wrap gap-3'>
            <button className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-tinan-turquoise' disabled={evm.busy} onClick={() => evm.connectInjected().catch(() => undefined)} type='button'>
              Connect MetaMask
            </button>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' disabled={evm.busy} onClick={() => evm.connectWalletConnect().catch(() => undefined)} type='button'>
              Connect WalletConnect
            </button>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' disabled={evm.busy} onClick={() => evm.disconnect().catch(() => undefined)} type='button'>
              Disconnect
            </button>
          </div>

          <div className='mt-4 grid gap-3'>
            <DetailRow breakAll label='Wallet address' value={evm.state.address || 'Disconnected'} />
            <DetailRow label='Network' value={evm.state.network} />
            <DetailRow label='EKA balance' value={`${evm.state.ekaBalance} ${EKA_TOKEN.symbol}`} />
            <DetailRow label='Native balance' value={`${evm.state.nativeBalance} ${evm.state.nativeSymbol}`} />
          </div>

          {evm.state.networkWarning ? <p className='mt-4 text-sm text-amber-200'>{evm.state.networkWarning}</p> : null}
          <p className='mt-3 text-sm text-white/65'>{evm.status}</p>

          <form
            className='mt-5 grid gap-3'
            onSubmit={(event) => {
              event.preventDefault();
              evm.sendTransfer(sendTo.trim(), sendAmount.trim()).then(() => {
                setSendTo('');
                setSendAmount('');
              }).catch(() => undefined);
            }}
          >
            <input className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none' onChange={(event) => setSendTo(event.target.value)} placeholder='Recipient EVM address' value={sendTo} />
            <input className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white outline-none' onChange={(event) => setSendAmount(event.target.value)} placeholder='Amount in EKA' value={sendAmount} />
            <button className='rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15' disabled={evm.busy} type='submit'>
              Send EKA
            </button>
          </form>

          <div className='mt-5 flex flex-wrap gap-3'>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' onClick={() => evm.addToken().catch(() => undefined)} type='button'>
              Watch EKA in MetaMask
            </button>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' onClick={() => evm.switchToEthereumMainnet().catch(() => undefined)} type='button'>
              Request Ethereum Mainnet
            </button>
            <ExternalLinkButton href={METAMASK_DOWNLOAD_URL} label='MetaMask download' />
            <ExternalLinkButton href={WALLETCONNECT_URL} label='WalletConnect' />
          </div>
        </PageSection>

        <PageSection>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>TinanAI token wallet</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>Solana flow</h2>
            </div>
            <StatusPill tone={connected ? 'success' : 'warning'}>{connected ? 'Connected' : 'Disconnected'}</StatusPill>
          </div>

          <div className='mt-4 flex flex-wrap gap-3'>
            <button className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-tinan-turquoise' onClick={() => connectPhantom().catch(() => undefined)} type='button'>
              Connect Phantom
            </button>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' onClick={() => disconnectPhantom().catch(() => undefined)} type='button'>
              Disconnect Phantom
            </button>
            <button className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/40 hover:bg-white/10' onClick={() => refreshSolana().catch((error: Error) => setSolanaStatus(`Solana refresh failed: ${error.message}`))} type='button'>
              Refresh balances
            </button>
          </div>

          <div className='mt-4 grid gap-3'>
            <DetailRow breakAll label='Solana wallet' value={publicKeyBase58 || 'Disconnected'} />
            <DetailRow label='Display' value={shortenAddress(publicKeyBase58, 'Disconnected')} />
            <DetailRow label='SOL balance' value={solBalance} />
            <DetailRow label='TinanAI token balance' value={tokenBalance} />
            <DetailRow label='Configured network' value={TINANAI_SOLANA.network} />
          </div>

          <p className='mt-4 text-sm text-white/65'>{solanaStatus}</p>

          <div className='mt-5 flex flex-wrap gap-3'>
            <ExternalLinkButton href={PHANTOM_DOWNLOAD_URL} label='Phantom download' />
            <ExternalLinkButton href={publicKeyBase58 ? getSolscanAddressUrl(publicKeyBase58) : null} label='Open Solscan wallet' />
            <ExternalLinkButton href={TINANAI_SOLANA.mintAddress ? getSolscanTokenUrl(TINANAI_SOLANA.mintAddress) : null} label='Open Solscan mint' />
          </div>
        </PageSection>
      </div>
    </div>
  );
}
