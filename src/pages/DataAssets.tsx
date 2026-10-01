import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { RouteButton, PageHero, PageSection, StatusPill } from '../components/ui';
import { deleteAssetAndProofs, loadAssetWorkspace, saveAsset, saveAssetAndProof, saveProof } from '../core/data-asset-store';
import {
  createId,
  MAX_ASSET_DESCRIPTION_LENGTH,
  MAX_ASSET_NAME_LENGTH,
  MAX_DATA_ASSET_BYTES,
  MAX_PROOF_DESCRIPTION_LENGTH,
  getDataAssetKind,
  prepareTokenization,
  sha256,
  sha256Text,
  validateDataAsset,
  verifySignedAction,
} from '../core/data-assets';
import type { AssetWorkspace, DataAsset, DataAssetKind, DataProof, ProofType } from '../core/data-assets';
import type { EvmWalletController } from '../hooks/useEvmWallet';

type WorkspaceView = 'assets' | 'proofs' | 'tokenize';
type AssetFilter = 'all' | DataAssetKind | 'proofs' | 'tokens';

const ASSET_FILTERS: Array<{ value: AssetFilter; label: string }> = [
  { value: 'all', label: 'All data' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'dataset', label: 'Datasets' },
  { value: 'proofs', label: 'Proofs' },
  { value: 'tokens', label: 'Tokens' },
];

const PROOF_LABELS: Record<ProofType, string> = {
  data: 'Proof of Data',
  action: 'Proof of Action',
  knowledge: 'Proof of Knowledge',
};

function downloadMetadata(asset: DataAsset, proofs: DataProof[]) {
  const contents = JSON.stringify(prepareTokenization(asset, proofs).metadata, null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${asset.id}-metadata.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeActionMessage(asset: DataAsset, description: string, owner: string, timestamp: string) {
  return [
    'EUREKA PROOF OF ACTION',
    'This wallet signature confirms that the signer authorized the following user-submitted statement; it does not independently verify that an external event occurred.',
    `Owner: ${owner}`,
    `Asset ID: ${asset.id}`,
    `Asset SHA-256: ${asset.hash}`,
    `Action: ${description.trim()}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

export function DataAssetsPage({
  evm,
  view = 'assets',
}: {
  evm: EvmWalletController;
  view?: WorkspaceView;
}) {
  const [workspace, setWorkspace] = useState<AssetWorkspace>({ assets: [], proofs: [] });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [actionAssetId, setActionAssetId] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [knowledgeAssetId, setKnowledgeAssetId] = useState('');
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeCategory, setKnowledgeCategory] = useState('');
  const [knowledgeSummary, setKnowledgeSummary] = useState('');
  const [verificationFiles, setVerificationFiles] = useState<Record<string, File>>({});
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = async () => setWorkspace(await loadAssetWorkspace());

  useEffect(() => {
    loadAssetWorkspace().then(setWorkspace).catch((loadError: Error) => setError(loadError.message));
  }, []);

  const visibleAssets = useMemo(() => workspace.assets.filter((asset) => {
    if (filter === 'all') return true;
    if (filter === 'proofs') return workspace.proofs.some((proof) => proof.assetId === asset.id);
    if (filter === 'tokens') return Boolean(asset.tokenId);
    return asset.type === filter;
  }), [filter, workspace.assets, workspace.proofs]);

  const title = view === 'proofs'
    ? 'Proofs are records, not unsupported claims.'
    : view === 'tokenize'
      ? 'Prepare metadata. Tokenization is not connected.'
      : 'Your data, hashed locally and kept under your control.';

  const description = view === 'proofs'
    ? 'Review local hash records, wallet-signed statements, and user-authored knowledge records. Each proof states exactly what was checked.'
    : view === 'tokenize'
      ? 'Export content-hash metadata for future tokenization. No token is minted, transaction submitted, or blockchain storage reference created here.'
      : 'Create a SHA-256 record for a file without uploading or retaining its contents. Records stay in this browser profile; they are not backed up or anchored on-chain.';

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Choose a file before creating its data record.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      const kind = validateDataAsset(selectedFile, assetName, assetDescription);
      const hash = await sha256(await selectedFile.arrayBuffer());
      const createdAt = new Date().toISOString();
      const assetId = createId();
      const proof: DataProof = {
        id: createId(),
        type: 'data',
        assetId,
        hash,
        timestamp: createdAt,
        owner: evm.state.address || null,
        signature: null,
        metadata: {
          fileType: selectedFile.type || 'unknown',
          fileSize: String(selectedFile.size),
          verificationScope: 'SHA-256 was calculated in this browser; the source file was not uploaded or retained.',
        },
        status: 'recorded',
      };
      const asset: DataAsset = {
        id: assetId,
        owner: evm.state.address || null,
        type: kind,
        name: assetName.trim(),
        description: assetDescription.trim(),
        size: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        hash,
        timestamp: createdAt,
        metadata: { originalFileName: selectedFile.name },
        storageReference: null,
        proofId: proof.id,
        tokenId: null,
        network: null,
        transactionHash: null,
        verificationStatus: 'hash-recorded',
        createdAt,
      };
      await saveAssetAndProof(asset, proof);
      await reload();
      setAssetName('');
      setAssetDescription('');
      setSelectedFile(null);
      setFileInputKey((key) => key + 1);
      setNotice('Local data record created. Re-select the original file to compare its hash.');
    } catch (assetError) {
      setError((assetError as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyFile = async (asset: DataAsset) => {
    const file = verificationFiles[asset.id];
    if (!file) {
      setError(`Choose the original file for “${asset.name}” first.`);
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      if (file.size <= 0 || file.size > MAX_DATA_ASSET_BYTES || getDataAssetKind(file) !== asset.type) {
        throw new Error('Select a supported source file of the same type and no larger than 25 MB.');
      }
      const actualHash = await sha256(await file.arrayBuffer());
      if (actualHash !== asset.hash) {
        setNotice(`Hash mismatch for “${asset.name}”. The selected file does not match its saved data record.`);
        return;
      }

      const dataProof = workspace.proofs.find((proof) => proof.id === asset.proofId);
      if (dataProof) {
        await saveProof({ ...dataProof, status: 'integrity-verified' });
      }
      await saveAsset({ ...asset, verificationStatus: 'integrity-verified' });
      await reload();
      setNotice(`Hash match confirmed for “${asset.name}”. This verifies file integrity against the local record only.`);
    } catch (verificationError) {
      setError((verificationError as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteAsset = async (asset: DataAsset) => {
    if (!window.confirm(`Delete “${asset.name}” and its local proofs from this browser? Exported copies cannot be removed.`)) return;
    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteAssetAndProofs(asset.id);
      await reload();
      setVerificationFiles((current) => {
        const { [asset.id]: _removed, ...remaining } = current;
        return remaining;
      });
      setNotice(`“${asset.name}” and its linked local proofs were deleted from this browser.`);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateActionProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const asset = workspace.assets.find((item) => item.id === actionAssetId);
    if (!asset) {
      setError('Choose a data asset to associate with this action statement.');
      return;
    }
    if (!evm.state.connected) {
      setError('Connect an EVM wallet before signing an action statement.');
      return;
    }
    if (!actionDescription.trim() || actionDescription.trim().length > MAX_PROOF_DESCRIPTION_LENGTH) {
      setError(`Action statement must contain 1–${MAX_PROOF_DESCRIPTION_LENGTH} characters.`);
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      const timestamp = new Date().toISOString();
      const message = makeActionMessage(asset, actionDescription, evm.state.address, timestamp);
      const [{ address, signature }, hash] = await Promise.all([
        evm.signMessage(message),
        sha256Text(message),
      ]);
      const proof: DataProof = {
        id: createId(),
        type: 'action',
        assetId: asset.id,
        hash,
        timestamp,
        owner: address,
        signature,
        metadata: {
          message,
          verificationScope: 'The wallet signature verifies the signer authorized this statement; it does not verify an external action occurred.',
        },
        status: 'signature-verified',
      };
      if (!await verifySignedAction(proof)) throw new Error('The wallet signature did not pass local verification.');
      await saveProof(proof);
      await reload();
      setActionDescription('');
      setNotice('Wallet signature verified. This proves authorization of the statement, not that the described action occurred.');
    } catch (proofError) {
      setError((proofError as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateKnowledgeProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const asset = workspace.assets.find((item) => item.id === knowledgeAssetId);
    if (!asset) {
      setError('Choose a source data asset for this knowledge record.');
      return;
    }
    if (!knowledgeTitle.trim() || knowledgeTitle.trim().length > MAX_ASSET_NAME_LENGTH) {
      setError(`Knowledge title must contain 1–${MAX_ASSET_NAME_LENGTH} characters.`);
      return;
    }
    if (knowledgeSummary.trim().length > MAX_ASSET_DESCRIPTION_LENGTH) {
      setError(`Knowledge summary must be ${MAX_ASSET_DESCRIPTION_LENGTH} characters or fewer.`);
      return;
    }
    if (!knowledgeSummary.trim() || !knowledgeCategory.trim() || knowledgeCategory.trim().length > 80) {
      setError('Add a category of 1–80 characters and a summary to structure the knowledge record.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      const timestamp = new Date().toISOString();
      const content = JSON.stringify({
        schema: 'eureka-knowledge-record/v1',
        title: knowledgeTitle.trim(),
        category: knowledgeCategory.trim(),
        summary: knowledgeSummary.trim(),
        sourceAssetId: asset.id,
        sourceHash: asset.hash,
        createdAt: timestamp,
      });
      const proof: DataProof = {
        id: createId(),
        type: 'knowledge',
        assetId: asset.id,
        hash: await sha256Text(content),
        timestamp,
        owner: evm.state.address || null,
        signature: null,
        metadata: {
          title: knowledgeTitle.trim(),
          category: knowledgeCategory.trim(),
          summary: knowledgeSummary.trim(),
          verificationScope: 'Hash of a user-authored, structured record; its claims and source authenticity are not independently verified.',
        },
        status: 'recorded',
      };
      await saveProof(proof);
      await reload();
      setKnowledgeTitle('');
      setKnowledgeCategory('');
      setKnowledgeSummary('');
      setNotice('Structured knowledge record saved locally. Its content is not AI-generated or independently verified.');
    } catch (proofError) {
      setError((proofError as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='EUREKA · DATA → PROOF → TOKENIZATION'
        title={title}
        description={description}
        actions={
          <>
            <RouteButton label='My data' to='/assets' />
            <RouteButton label='Proofs' to='/proofs' />
            <RouteButton label='Prepare metadata' to='/tokenize' />
          </>
        }
      />

      <div className='flex flex-wrap gap-2'>
        {[
          ['assets', 'My Data', '/assets'],
          ['proofs', 'Proofs', '/proofs'],
          ['tokenize', 'Tokenize', '/tokenize'],
        ].map(([key, label, path]) => (
          <RouteButton key={key} label={label} to={path} />
        ))}
      </div>

      {error ? <p role='alert' className='rounded-xl border border-rose-300/30 bg-rose-950/40 p-4 text-sm text-rose-100'>{error}</p> : null}
      {notice ? <p role='status' className='rounded-xl border border-tinan-cyan/30 bg-tinan-cyan/10 p-4 text-sm text-cyan-100'>{notice}</p> : null}

      {view === 'assets' ? (
        <PageSection>
          <div>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Proof of Data</p>
            <h2 className='mt-2 text-2xl font-semibold text-white'>Create a local file hash</h2>
            <p className='mt-2 text-sm leading-6 text-white/70'>Supported files up to 25 MB. Only file metadata and its SHA-256 hash are saved in this browser; file contents are never uploaded or stored by EurekaCore.</p>
          </div>
          <form className='mt-5 grid gap-3' onSubmit={(event) => void handleCreateAsset(event)}>
            <label className='grid gap-2 text-sm text-white/75'>
              File
              <input
                accept='image/*,.pdf,.rtf,.docx,.xlsx,.pptx,.txt,.md,.mp3,.m4a,.wav,.ogg,.weba,.aac,.flac,.mp4,.webm,.mov,.ogv,.json,.jsonl,.ndjson,.parquet,.csv,.tsv'
                className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white'
                key={fileInputKey}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file && !assetName) setAssetName(file.name);
                }}
                required
                type='file'
              />
            </label>
            <label className='grid gap-2 text-sm text-white/75'>
              Name
              <input className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white' maxLength={MAX_ASSET_NAME_LENGTH} onChange={(event) => setAssetName(event.target.value)} required value={assetName} />
            </label>
            <label className='grid gap-2 text-sm text-white/75'>
              Description
              <textarea className='min-h-24 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white' maxLength={MAX_ASSET_DESCRIPTION_LENGTH} onChange={(event) => setAssetDescription(event.target.value)} value={assetDescription} />
            </label>
            <button className='w-fit rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50' disabled={isBusy} type='submit'>
              {isBusy ? 'Creating record…' : 'Hash file & create proof'}
            </button>
          </form>
        </PageSection>
      ) : null}

      {view !== 'tokenize' ? (
        <PageSection>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div>
              <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Browser-local records</p>
              <h2 className='mt-2 text-2xl font-semibold text-white'>{view === 'proofs' ? 'Proof of Data, Action & Knowledge' : 'My Data'}</h2>
            </div>
            <label className='grid gap-1 text-xs text-white/60'>
              Filter assets
              <select className='rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white' onChange={(event) => setFilter(event.target.value as AssetFilter)} value={filter}>
                {ASSET_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          {visibleAssets.length ? (
            <div className='mt-4 grid gap-3'>
              {visibleAssets.map((asset) => {
                const assetProofs = workspace.proofs.filter((proof) => proof.assetId === asset.id);
                return (
                  <article key={asset.id} className='rounded-2xl border border-white/10 bg-black/20 p-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <h3 className='break-words text-lg font-semibold text-white'>{asset.name}</h3>
                        <p className='mt-1 text-sm text-white/60'>{asset.type} · {formatBytes(asset.size)} · {new Date(asset.createdAt).toLocaleString()}</p>
                        {asset.description ? <p className='mt-2 text-sm text-white/70'>{asset.description}</p> : null}
                      </div>
                      <StatusPill tone={asset.verificationStatus === 'integrity-verified' ? 'success' : 'warning'}>
                        {asset.verificationStatus === 'integrity-verified' ? 'Hash match checked' : 'Hash recorded'}
                      </StatusPill>
                    </div>
                    <dl className='mt-4 grid gap-2 text-xs text-white/65 md:grid-cols-2'>
                      <div><dt className='text-tinan-cyan'>SHA-256</dt><dd className='mt-1 break-all font-mono'>{asset.hash}</dd></div>
                      <div><dt className='text-tinan-cyan'>Owner</dt><dd className='mt-1 break-all'>{asset.owner ?? 'Not wallet-attributed'}</dd></div>
                      <div><dt className='text-tinan-cyan'>Storage / token</dt><dd className='mt-1'>Local record only · Not tokenized</dd></div>
                      <div><dt className='text-tinan-cyan'>Proofs</dt><dd className='mt-1'>{assetProofs.length ? assetProofs.map((proof) => PROOF_LABELS[proof.type]).join(', ') : 'Proof of Data'}</dd></div>
                    </dl>
                    <div className='mt-4 flex flex-wrap gap-2'>
                      <label className='grid gap-1 text-xs text-white/60'>
                        Re-select source file to verify hash
                        <input
                          className='max-w-full text-sm text-white'
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) setVerificationFiles((current) => ({ ...current, [asset.id]: file }));
                          }}
                          type='file'
                        />
                      </label>
                      <button className='h-fit rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50' disabled={isBusy || !verificationFiles[asset.id]} onClick={() => void handleVerifyFile(asset)} type='button'>
                        Compare SHA-256
                      </button>
                      <button className='h-fit rounded-xl border border-tinan-cyan/30 bg-tinan-cyan/10 px-3 py-2 text-sm text-cyan-100' onClick={() => downloadMetadata(asset, workspace.proofs)} type='button'>
                        Export token metadata
                      </button>
                      <button className='h-fit rounded-xl border border-rose-300/25 bg-rose-950/30 px-3 py-2 text-sm text-rose-100' disabled={isBusy} onClick={() => void handleDeleteAsset(asset)} type='button'>
                        Delete local record
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className='mt-5 rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/60'>
              {filter === 'tokens' ? 'No tokenized assets. This app does not currently mint data tokens.' : 'No local assets match this filter. Create a data record to begin.'}
            </p>
          )}
        </PageSection>
      ) : (
        <PageSection>
          <p className='text-sm leading-7 text-white/75'>Metadata exports include the content hash, type, size, creation time, and linked proof IDs. No file data or storage URI is included. This is a metadata package only; there is no data-token contract or transaction integration configured.</p>
          <div className='mt-4 grid gap-3'>
            {workspace.assets.length ? workspace.assets.map((asset) => (
              <div key={asset.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4'>
                <div><h3 className='font-semibold text-white'>{asset.name}</h3><p className='mt-1 text-sm text-white/60'>Metadata prepared · not minted</p></div>
                <button className='rounded-xl border border-tinan-cyan/30 bg-tinan-cyan/10 px-3 py-2 text-sm text-cyan-100' onClick={() => downloadMetadata(asset, workspace.proofs)} type='button'>Download JSON</button>
              </div>
            )) : <p className='text-sm text-white/60'>Create a local data record before preparing metadata.</p>}
          </div>
        </PageSection>
      )}

      {view === 'proofs' ? (
        <div className='grid gap-4 lg:grid-cols-2'>
          <PageSection>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Proof of Action</p>
            <h2 className='mt-2 text-xl font-semibold text-white'>Sign a user-submitted statement</h2>
            <p className='mt-2 text-sm leading-6 text-white/70'>The signature verifies which wallet authorized the message. It does not prove an external action occurred.</p>
            <form className='mt-4 grid gap-3' onSubmit={(event) => void handleCreateActionProof(event)}>
              <select className='rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white' onChange={(event) => setActionAssetId(event.target.value)} required value={actionAssetId}>
                <option value=''>Choose related data</option>
                {workspace.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
              <textarea className='min-h-24 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white' maxLength={MAX_PROOF_DESCRIPTION_LENGTH} onChange={(event) => setActionDescription(event.target.value)} placeholder='Describe the action statement to sign' required value={actionDescription} />
              <button className='w-fit rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50' disabled={isBusy || !evm.state.connected} type='submit'>Sign with connected wallet</button>
              <p className='text-xs text-white/50'>{evm.state.connected ? `Wallet: ${evm.state.address}` : 'Connect an EVM wallet in the Wallet hub to sign.'}</p>
            </form>
          </PageSection>

          <PageSection>
            <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Proof of Knowledge</p>
            <h2 className='mt-2 text-xl font-semibold text-white'>Structure a knowledge record</h2>
            <p className='mt-2 text-sm leading-6 text-white/70'>Add your own title, category, and summary. This browser creates a content hash; it does not call an AI provider or validate factual claims.</p>
            <form className='mt-4 grid gap-3' onSubmit={(event) => void handleCreateKnowledgeProof(event)}>
              <select className='rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white' onChange={(event) => setKnowledgeAssetId(event.target.value)} required value={knowledgeAssetId}>
                <option value=''>Choose source data</option>
                {workspace.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
              <input className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white' maxLength={MAX_ASSET_NAME_LENGTH} onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder='Knowledge title' required value={knowledgeTitle} />
              <input className='rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white' maxLength={80} onChange={(event) => setKnowledgeCategory(event.target.value)} placeholder='Category' required value={knowledgeCategory} />
              <textarea className='min-h-24 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white' maxLength={MAX_ASSET_DESCRIPTION_LENGTH} onChange={(event) => setKnowledgeSummary(event.target.value)} placeholder='Your structured summary' required value={knowledgeSummary} />
              <button className='w-fit rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50' disabled={isBusy || workspace.assets.length === 0} type='submit'>Create knowledge record</button>
            </form>
          </PageSection>
        </div>
      ) : null}

      {view === 'proofs' ? (
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Proof records</p>
          <div className='mt-4 grid gap-3'>
            {workspace.proofs.length ? workspace.proofs.map((proof) => (
              <article key={proof.id} className='rounded-xl border border-white/10 bg-black/20 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='font-semibold text-white'>{PROOF_LABELS[proof.type]}</h3>
                  <StatusPill tone={proof.status === 'recorded' ? 'warning' : 'success'}>{proof.status}</StatusPill>
                </div>
                <p className='mt-2 text-xs text-white/55'>{new Date(proof.timestamp).toLocaleString()} · asset {proof.assetId}</p>
                <p className='mt-2 break-all font-mono text-xs text-white/65'>SHA-256: {proof.hash}</p>
                {proof.type === 'action' ? <p className='mt-2 whitespace-pre-wrap break-words text-sm text-white/70'>{proof.metadata.message}</p> : null}
                {proof.type === 'knowledge' ? <p className='mt-2 text-sm text-white/70'>{proof.metadata.title} · {proof.metadata.category}: {proof.metadata.summary}</p> : null}
                <p className='mt-2 text-xs text-amber-100/75'>{proof.metadata.verificationScope}</p>
              </article>
            )) : <p className='text-sm text-white/60'>No proof records yet.</p>}
          </div>
        </PageSection>
      ) : null}

      <PageSection className='border-amber-200/15'>
        <h2 className='text-lg font-semibold text-white'>Local records are not blockchain proofs</h2>
        <p className='mt-2 text-sm leading-6 text-white/65'>Records are stored only in IndexedDB for this browser origin and profile. They are not encrypted or synced, can be removed by clearing browser data, and are not publicly verifiable. No file is uploaded, no token is minted, and no transaction or storage reference is claimed.</p>
      </PageSection>
    </div>
  );
}
