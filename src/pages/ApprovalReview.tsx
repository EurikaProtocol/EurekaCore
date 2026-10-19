import { useMemo, useState } from 'react';
import { describeActionForReview, parseProposedAction, prepareApprovalRequest, type HumanApproval } from '../core';
import { DetailRow, PageHero, PageSection, StatusPill } from '../components/ui';
import type { EvmWalletController } from '../hooks/useEvmWallet';

const SAMPLE = JSON.stringify({
  id: 'sample-transfer-1',
  type: 'fund-transfer',
  description: 'SAMPLE ONLY: example action to rehearse the review screen.',
  parameters: { chainId: 1, to: '0x0000000000000000000000000000000000000001', amount: '1', symbol: 'EKA' },
}, null, 2);

export function ApprovalReviewPage({ evm }: { evm: EvmWalletController }) {
  const [text, setText] = useState(SAMPLE);
  const [ttlMinutes, setTtlMinutes] = useState(5);
  const [approval, setApproval] = useState<HumanApproval | null>(null);
  const [error, setError] = useState('');

  const parsed = useMemo(() => {
    try { return parseProposedAction(JSON.parse(text)); } catch { return null; }
  }, [text]);
  const action = parsed?.ok ? parsed.value : null;
  const review = action ? describeActionForReview(action) : null;
  const walletChain = evm.state.chainId;
  const chainMismatch = review?.chainId != null && walletChain != null && review.chainId !== String(walletChain);
  const canSign = Boolean(action && review?.consequential && evm.state.connected && !chainMismatch && !evm.busy);

  const prepared = useMemo(() => {
    if (!action || !evm.state.address) return null;
    // Preview only: the nonce and validity window are regenerated at signing time.
    return prepareApprovalRequest({ action, approvedBy: evm.state.address, nonce: 'preview-nonce-000000', ttlMs: ttlMinutes * 60_000 });
  }, [action, evm.state.address, ttlMinutes]);

  async function sign() {
    if (!action) return;
    setError('');
    setApproval(null);
    const nonce = crypto.randomUUID();
    const req = prepareApprovalRequest({ action, approvedBy: evm.state.address, nonce, ttlMs: ttlMinutes * 60_000 });
    if (!req.ok) { setError(req.error.message); return; }
    try {
      const { address, signature } = await evm.signMessage(req.value.message);
      setApproval({ approvedBy: address, nonce, approvedAt: req.value.approvedAt, expiresAt: req.value.expiresAt, signature });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The wallet did not sign.');
    }
  }

  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Approval review (preview)'
        title='Review an action before approving it'
        description='Signing here records your approval of one exact action. It does NOT execute a transaction, deploy a contract, or transfer funds. EVM wallets only; Solana approvals are not implemented.'
      />

      <PageSection>
        <StatusPill tone='warning'>Preview: not connected to an AI agent or to any executor</StatusPill>
        <p className='mt-3 text-sm text-slate-300'>Paste a proposed action (JSON). In a real flow this comes from a server-validated agent result. The signed approval is shown below and is not sent anywhere.</p>
        <textarea aria-label='Proposed action JSON' className='mt-3 h-48 w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white' value={text} onChange={(e) => setText(e.target.value)} />
        {!action ? <p className='mt-2 text-sm text-red-300'>{parsed && !parsed.ok ? parsed.error.message : 'Not valid JSON.'}</p> : null}
      </PageSection>

      {review ? (
        <PageSection>
          <h2 className='text-xl font-semibold text-white'>Exactly what you are approving</h2>
          <div className='mt-3 grid gap-2'>
            <DetailRow label='Action type' value={review.type} />
            <DetailRow label='Description' value={review.description} />
            <DetailRow label='Chain (from action)' value={review.chainId ?? 'Not specified'} />
            <DetailRow label='Wallet chain ID' value={walletChain == null ? 'Not connected' : String(walletChain)} />
            <DetailRow label='Target' value={review.target ?? 'Not specified'} breakAll />
            {review.parameters.map(([k, v]) => <DetailRow key={k} label={`Parameter: ${k}`} value={v} breakAll />)}
            <DetailRow label='Approver' value={evm.state.address || 'Connect an EVM wallet'} breakAll />
            <DetailRow label='Valid for' value={`${ttlMinutes} minute(s) from signing; single use`} />
          </div>
          {!review.consequential ? <p className='mt-3 text-sm text-slate-300'>This action type needs no approval.</p> : null}
          {chainMismatch ? <p className='mt-3 text-sm text-red-300'>The action targets chain {review.chainId} but your wallet is on chain {walletChain}. Signing is disabled.</p> : null}
          <label className='mt-3 block text-sm text-slate-300'>Approval lifetime (minutes, 1-60)
            <input className='ml-2 w-20 rounded border border-white/10 bg-black/30 p-1 text-white' max={60} min={1} type='number' value={ttlMinutes} onChange={(e) => setTtlMinutes(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <details className='mt-3 text-xs text-slate-400'><summary>Exact message your wallet will sign</summary><pre className='mt-2 whitespace-pre-wrap break-all'>{prepared?.ok ? prepared.value.message : 'Connect a wallet to preview.'}</pre></details>
          <button className='mt-4 rounded-xl bg-tinan-cyan px-4 py-2 font-semibold text-black disabled:opacity-40' disabled={!canSign} onClick={sign} type='button'>
            {evm.state.connected ? 'Sign approval (no transaction is sent)' : 'Connect a wallet to sign'}
          </button>
          {error ? <p className='mt-2 text-sm text-red-300'>{error}</p> : null}
        </PageSection>
      ) : null}

      {approval ? (
        <PageSection>
          <StatusPill tone='success'>Approval signed. Nothing has been executed.</StatusPill>
          <p className='mt-2 text-sm text-slate-300'>A separate, server-side step must verify this signature, consume the nonce once, and only then hand the action to the existing transaction lifecycle. That step is not part of this preview.</p>
          <pre className='mt-3 whitespace-pre-wrap break-all rounded-xl bg-black/30 p-3 text-xs text-white'>{JSON.stringify(approval, null, 2)}</pre>
        </PageSection>
      ) : null}
    </div>
  );
}
