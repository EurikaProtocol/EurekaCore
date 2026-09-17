import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { TINANAI_SOLANA } from '../config/tinanai-solana';

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={TINANAI_SOLANA.rpcUrl}>
      <WalletProvider autoConnect={false} wallets={wallets}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
