import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { TINAN_TOKEN } from '../config/tinan-token';
import { toTrustedUrl } from '../core/verify';
import { readTokenSnapshot, type TokenSnapshot } from '../services/token-reader';

export const TRADE_URL = toTrustedUrl(TINANAI_SOLANA.pumpfunUrl);

async function addToWallet(token: TokenSnapshot, setNote: (note: string) => void) {
  if (!window.ethereum) return setNote('No compatible injected EVM wallet was found.');
  try {
    const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
    if (typeof currentChain !== 'string' || Number.parseInt(currentChain, 16) !== TINAN_TOKEN.chainId) {
      return setNote(`Switch your wallet to ${TINAN_TOKEN.networkName} before adding this token.`);
    }
    const accepted: unknown = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: { type: 'ERC20', options: { address: token.address, symbol: token.symbol, decimals: token.decimals } },
    });
    return setNote(accepted === true ? 'Token added to your wallet.' : 'The wallet did not confirm adding this token.');
  } catch {
    return setNote('The wallet could not add this token. No transaction was sent.');
  }
}

export function TokenPanel({ walletAddress }: { walletAddress: string }) {
  const [token, setToken] = useState<TokenSnapshot | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const readable = Boolean(TINAN_TOKEN.address && TINAN_TOKEN.chainId && TINAN_TOKEN.rpcUrl);

  useEffect(() => {
    if (!TINAN_TOKEN.address || !TINAN_TOKEN.chainId || !TINAN_TOKEN.rpcUrl) return undefined;
    let active = true;
    setState('loading');
    readTokenSnapshot(TINAN_TOKEN.address, TINAN_TOKEN.rpcUrl, TINAN_TOKEN.chainId, walletAddress || undefined)
      .then((snapshot) => { if (active) { setToken(snapshot); setState('idle'); } })
      .catch((readError: unknown) => {
        if (active) {
          setState('error');
          setError(readError instanceof Error ? readError.message : 'Token contract read failed.');
        }
      });
    return () => { active = false; };
  }, [walletAddress]);

  const rows: Array<[string, string]> = [
    ['Token name', token?.name ?? 'Unavailable'],
    ['Symbol', token?.symbol ?? 'Unavailable'],
    ['Network', TINAN_TOKEN.networkName ?? 'Not configured'],
    ['Contract', TINAN_TOKEN.address ?? 'Not configured'],
    ['Decimals', token ? String(token.decimals) : 'Unavailable'],
    ['Total supply', token?.totalSupply ?? 'Unavailable'],
    ['Wallet balance', token?.balance ?? (walletAddress ? 'Unavailable' : 'Connect an EVM wallet')],
  ];

  const buttonClass = 'eu-btn-ghost disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className='grid gap-6 lg:grid-cols-[1fr_1.2fr]'>
      <div>
        <p className='eu-eyebrow'>Token</p>
        <h2 className='eu-h2'>$EUREKA</h2>
        <p className='eu-lead'>The digital asset powering the EUREKA ecosystem.</p>
        {!TINAN_TOKEN.configured || !readable ? (
          <div className='mt-5 rounded-xl border border-amber-200/25 bg-amber-900/10 p-4 text-sm text-amber-100' role='status'>
            <p className='font-semibold'>Token configuration required</p>
            <ul className='mt-2 list-disc space-y-1 pl-5 text-amber-100/80'>
              {TINAN_TOKEN.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        ) : null}
        <div className='mt-6 flex flex-wrap gap-3'>
          <Link className='eu-btn-primary' to={TINAN_TOKEN.address ? `/tokens/${TINAN_TOKEN.address}` : '/tokens'}>View Token</Link>
          {TRADE_URL ? <a className={buttonClass} href={TRADE_URL} rel='noreferrer' target='_blank'>Trade</a> : <button className={buttonClass} disabled title='No trading venue is configured' type='button'>Trade</button>}
          <button className={buttonClass} disabled={!token} onClick={() => { if (token) void addToWallet(token, setNote); }} type='button'>Add to Wallet</button>
        </div>
        {!TRADE_URL ? <p className='mt-3 text-xs text-white/50'>Trading is unavailable until an official trading venue is configured.</p> : null}
        {note ? <p className='mt-3 text-sm text-white/70' role='status'>{note}</p> : null}
      </div>
      <div className='eu-card'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='font-semibold'>Live token data</h3>
          <span className='text-xs text-white/50'>{state === 'loading' ? 'Reading contract…' : token ? 'Read from chain' : 'Not loaded'}</span>
        </div>
        <dl className='mt-4 grid gap-2 sm:grid-cols-2'>
          {rows.map(([label, value]) => (
            <div className={`rounded-xl border border-white/10 bg-black/25 px-4 py-3 ${label === 'Contract' ? 'sm:col-span-2' : ''}`} key={label}>
              <dt className='text-xs uppercase tracking-wider text-tinan-turquoise'>{label}</dt>
              <dd className='mt-1 break-all text-sm text-white/90'>{value}</dd>
            </div>
          ))}
        </dl>
        {state === 'error' ? <p className='mt-3 text-sm text-rose-200' role='alert'>Token data unavailable: {error}</p> : null}
        <p className='mt-4 rounded-xl border border-dashed border-white/15 p-3 text-xs text-white/55'>Live market data will appear when the market-data provider is configured.</p>
      </div>
    </div>
  );
}
