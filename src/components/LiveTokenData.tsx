import { useEffect, useState } from 'react';
import { TINAN_TOKEN } from '../config/tinan-token';
import { isValidEvmAddress } from '../core/verify';
import { readTokenSnapshot, type TokenSnapshot } from '../services/token-reader';
import { DetailRow, StatusPill } from './ui';

export function useTokenSnapshot(walletAddress?: string) {
  const [token, setToken] = useState<TokenSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setToken(null);
    setError('');
    if (!TINAN_TOKEN.address || !TINAN_TOKEN.chainId || !TINAN_TOKEN.rpcUrl) {
      return () => { active = false; };
    }
    const wallet = walletAddress && isValidEvmAddress(walletAddress) ? walletAddress : undefined;
    setLoading(true);
    void readTokenSnapshot(TINAN_TOKEN.address, TINAN_TOKEN.rpcUrl, TINAN_TOKEN.chainId, wallet)
      .then((snapshot) => { if (active) setToken(snapshot); })
      .catch((readError: unknown) => {
        if (active) setError(readError instanceof Error ? readError.message : 'Token contract read failed.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [walletAddress]);

  return { token, loading, error };
}

export function LiveTokenData({ token, loading, error }: { token: TokenSnapshot | null; loading: boolean; error: string }) {
  const unavailable = loading ? 'Reading…' : 'Unavailable';
  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-lg font-semibold'>Live token data</h3>
        <StatusPill tone={token ? 'success' : 'warning'}>{token ? 'Read from chain' : TINAN_TOKEN.configured ? unavailable : 'Not configured'}</StatusPill>
      </div>
      {!TINAN_TOKEN.configured ? (
        <p className='mt-3 rounded-xl border border-amber-200/20 bg-amber-900/10 p-3 text-sm text-amber-100' role='status'>
          Token network is not configured. {TINAN_TOKEN.issues.filter((issue) => issue.includes('CHAIN_ID') || issue.includes('ADDRESS')).join(' ')}
        </p>
      ) : null}
      {error || (TINAN_TOKEN.configured && !TINAN_TOKEN.rpcUrl) ? (
        <p className='mt-3 text-sm text-white/65' role='status'>{error || 'Set VITE_RPC_URL to enable read-only token queries.'}</p>
      ) : null}
      <dl className='mt-4 grid gap-3 sm:grid-cols-2'>
        <DetailRow label='Token name' value={token?.name ?? unavailable} />
        <DetailRow label='Symbol' value={token?.symbol ?? unavailable} />
        <DetailRow label='Network' value={TINAN_TOKEN.networkName ?? 'Not configured'} />
        <DetailRow label='Decimals' value={token ? String(token.decimals) : unavailable} />
        <DetailRow label='Contract' value={TINAN_TOKEN.address ?? 'Not configured'} breakAll />
        <DetailRow label='Total supply' value={token?.totalSupply ?? unavailable} />
        <DetailRow label='Wallet balance' value={token ? token.balance ?? 'Connect an EVM wallet to read' : unavailable} />
      </dl>
      <p className='mt-4 text-sm text-white/55'>Live market data will appear when the market-data provider is configured.</p>
    </div>
  );
}
