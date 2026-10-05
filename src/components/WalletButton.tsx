import type { WalletName } from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { shortenAddress } from '../core/verify';
import type { EvmWalletController } from '../hooks/useEvmWallet';

export function WalletButton({ evm }: { evm: EvmWalletController }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { connected: solConnected, disconnect: solDisconnect, publicKey, select, wallets } = useWallet();
  const phantom = useMemo(() => wallets.find((wallet) => wallet.adapter.name === 'Phantom'), [wallets]);
  const evmConnected = Boolean(evm.state.address);
  const solAddress = publicKey?.toBase58() ?? '';
  const anyConnected = evmConnected || solConnected;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function run(action: () => Promise<void>) {
    setMessage('');
    try {
      await action();
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wallet action failed.');
    }
  }

  async function connectPhantom() {
    if (!phantom) throw new Error('Phantom adapter is unavailable. Install Phantom to continue.');
    select(phantom.adapter.name as WalletName<string>);
    await phantom.adapter.connect();
  }

  const label = evmConnected
    ? shortenAddress(evm.state.address, 'Connected')
    : solConnected
      ? shortenAddress(solAddress, 'Connected')
      : 'Connect Wallet';
  const itemClass = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-50';

  return (
    <div className='relative' ref={rootRef}>
      <button
        aria-controls='wallet-menu'
        aria-expanded={open}
        aria-haspopup='true'
        className='eu-btn-primary whitespace-nowrap px-3 sm:px-5'
        onClick={() => setOpen((value) => !value)}
        type='button'
      >
        {label}
      </button>
      {open ? (
        <div className='absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0b1012]/95 p-2 shadow-glass backdrop-blur-xl' id='wallet-menu'>
          <p className='px-3 py-2 text-xs text-white/55'>{evmConnected ? `EVM · ${evm.state.network}` : 'Choose a wallet. Nothing is signed or sent.'}</p>
          <button className={itemClass} disabled={evm.busy} onClick={() => void run(evm.connectInjected)} type='button'>MetaMask / injected EVM</button>
          <button className={itemClass} disabled={evm.busy} onClick={() => void run(evm.connectWalletConnect)} type='button'>WalletConnect (EVM)</button>
          <button className={itemClass} onClick={() => void run(connectPhantom)} type='button'>Phantom (Solana){solConnected ? ` · ${shortenAddress(solAddress, '')}` : ''}</button>
          {anyConnected ? (
            <div className='mt-1 border-t border-white/10 pt-1'>
              {evmConnected ? <button className={itemClass} onClick={() => void run(evm.disconnect)} type='button'>Disconnect EVM</button> : null}
              {solConnected ? <button className={itemClass} onClick={() => void run(solDisconnect)} type='button'>Disconnect Solana</button> : null}
            </div>
          ) : null}
          {message ? <p className='px-3 py-2 text-xs text-rose-200' role='alert'>{message}</p> : <p className='px-3 py-2 text-xs text-white/50' role='status'>{evm.status}</p>}
        </div>
      ) : null}
    </div>
  );
}
