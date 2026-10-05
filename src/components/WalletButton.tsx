import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { useEffect, useRef, useState } from 'react';
import { shortenAddress } from '../core/verify';
import type { EvmWalletController } from '../hooks/useEvmWallet';

export function WalletButton({ evm }: { evm: EvmWalletController }) {
  const { connected: solConnected, disconnect: solDisconnect, publicKey, select, wallets } = useWallet();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const solAddress = publicKey?.toBase58() ?? '';
  const anyConnected = evm.state.connected || solConnected;

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function connectPhantom() {
    const phantom = wallets.find((wallet) => wallet.adapter.name === 'Phantom');
    if (!phantom) {
      setMessage('Phantom adapter is unavailable.');
      return;
    }
    try {
      select(phantom.adapter.name as WalletName<string>);
      await phantom.adapter.connect();
      setOpen(false);
    } catch (error) {
      setMessage(`Phantom connection failed: ${(error as Error).message}`);
    }
  }

  async function run(action: () => Promise<void>) {
    setMessage('');
    try {
      await action();
      setOpen(false);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  const label = evm.state.connected
    ? shortenAddress(evm.state.address)
    : solConnected
      ? shortenAddress(solAddress)
      : evm.busy ? 'Connecting…' : 'Connect Wallet';

  return (
    <div className='relative' ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup='true'
        className='btn btn-primary !px-4'
        onClick={() => setOpen((value) => !value)}
        type='button'
      >
        {anyConnected ? <span aria-hidden='true' className='h-2 w-2 rounded-full bg-emerald-700' /> : null}
        <span className='max-w-[9rem] truncate'>{label === 'Connect Wallet' ? <><span className='sm:hidden'>Connect</span><span className='hidden sm:inline'>Connect Wallet</span></> : label}</span>
      </button>
      {open ? (
        <div className='glass absolute right-0 z-50 mt-2 grid w-72 max-w-[calc(100vw-2rem)] gap-2 bg-[#0b0f10]/95 p-3 text-sm' role='menu'>
          <p className='px-1 text-xs uppercase tracking-[0.2em] text-white/50'>EVM · {evm.state.network}</p>
          {evm.state.connected ? (
            <>
              <p className='break-all px-1 text-white/80'>{evm.state.address}</p>
              <button className='btn btn-ghost' onClick={() => void run(evm.disconnect)} role='menuitem' type='button'>Disconnect EVM wallet</button>
            </>
          ) : (
            <>
              <button className='btn btn-ghost' disabled={evm.busy} onClick={() => void run(evm.connectInjected)} role='menuitem' type='button'>MetaMask / browser wallet</button>
              <button className='btn btn-ghost' disabled={evm.busy} onClick={() => void run(evm.connectWalletConnect)} role='menuitem' type='button'>WalletConnect</button>
            </>
          )}
          <p className='mt-1 px-1 text-xs uppercase tracking-[0.2em] text-white/50'>Solana</p>
          {solConnected ? (
            <>
              <p className='break-all px-1 text-white/80'>{solAddress}</p>
              <button className='btn btn-ghost' onClick={() => void run(solDisconnect)} role='menuitem' type='button'>Disconnect Phantom</button>
            </>
          ) : (
            <button className='btn btn-ghost' onClick={() => void connectPhantom()} role='menuitem' type='button'>Phantom</button>
          )}
          {message ? <p className='px-1 text-xs text-rose-200' role='alert'>{message}</p> : null}
          <p className='px-1 text-xs text-white/45'>{evm.status}</p>
        </div>
      ) : null}
    </div>
  );
}
