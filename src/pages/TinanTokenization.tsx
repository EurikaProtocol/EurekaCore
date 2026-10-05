import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EVM_NETWORKS, TOKENIZATION_NETWORKS } from '../config/networks';
import type { TINANBlueprint } from '../core/tinan-blueprint';
import { PageHero, PageSection, StatusPill } from '../components/ui';
import { tinanAIProvider } from '../services/tinan-ai';
import { BlueprintView } from './TinanStudio';

const TOKEN_MODELS = ['ERC-20', 'ERC-721', 'ERC-1155', 'Data Proof', 'Energy Token', 'Project Token'] as const;
const WIZARD_STEPS = ['Describe project', 'TINAN AI analysis', 'Token model', 'Blockchain', 'Token configuration', 'Review', 'Wallet connection', 'Transaction', 'Confirmation'] as const;

export function TINANTokenizationPage() {
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState('');
  const [blueprint, setBlueprint] = useState<TINANBlueprint | null>(null);
  const [model, setModel] = useState<string>(TOKEN_MODELS[0]);
  const [network, setNetwork] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [supply, setSupply] = useState('');
  const [utility, setUtility] = useState('');
  const [metadata, setMetadata] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyze() {
    setLoading(true);
    setError('');
    try {
      setBlueprint(await tinanAIProvider.analyze(idea));
      setStep(2);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'The analysis could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  function canContinue() {
    if (step === 0) return idea.trim().length >= 12;
    if (step === 1) return Boolean(blueprint);
    if (step === 2) return Boolean(model);
    if (step === 3) return Boolean(network);
    if (step === 4) return name.trim().length > 0 && symbol.trim().length > 0 && utility.trim().length > 0;
    return true;
  }

  return (
    <div className='grid gap-4'>
      <PageHero eyebrow='Tokenization · Demo blueprint' title='Turn a project into a responsible tokenization plan.' description='This wizard records a local planning draft only. It never deploys a contract or broadcasts a transaction.' />
      <PageSection>
        <ol aria-label='Tokenization steps' className='grid gap-2 sm:grid-cols-3 lg:grid-cols-9'>
          {WIZARD_STEPS.map((label, index) => (
            <li aria-current={index === step ? 'step' : undefined} className={`rounded-xl border p-3 text-xs ${index === step ? 'border-tinan-cyan bg-tinan-cyan/10 text-white' : 'border-white/10 text-white/50'}`} key={label}>
              <span className='block text-tinan-cyan'>{index + 1}</span>{label}
            </li>
          ))}
        </ol>
        <div className='mt-5'>
          <h2 className='text-xl font-semibold'>{WIZARD_STEPS[step]}</h2>
          {step === 0 ? (
            <label className='mt-4 block text-sm'>Project idea
              <textarea className='mt-2 min-h-32 w-full rounded-xl border border-white/15 bg-black/30 p-3' maxLength={4000} onChange={(event) => setIdea(event.target.value)} value={idea} />
            </label>
          ) : null}
          {step === 1 ? (
            <div className='mt-4'>
              <p className='text-sm text-white/70'>TINAN AI generates a deterministic example analysis locally. It does not call an external provider.</p>
              <button className='mt-3 rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50' disabled={loading} onClick={() => void analyze()} type='button'>{loading ? 'Analyzing…' : 'Generate analysis'}</button>
              {blueprint ? <div className='mt-4'><BlueprintView blueprint={blueprint} /></div> : null}
            </div>
          ) : null}
          {step === 2 ? (
            <label className='mt-4 block text-sm'>Token model
              <select className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' onChange={(event) => setModel(event.target.value)} value={model}>
                {TOKEN_MODELS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          ) : null}
          {step === 3 ? (
            <div className='mt-4'>
              <label className='block text-sm'>Network
                <select className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' onChange={(event) => setNetwork(event.target.value)} value={network}>
                  <option value=''>Choose a configured network</option>
                  {TOKENIZATION_NETWORKS.map((item) => <option key={item.name} value={item.name}>{item.name} · configuration required</option>)}
                </select>
              </label>
              <p className='mt-3 text-xs text-white/55'>Listed networks are architectural options only. A configured RPC, chain support, and wallet must be confirmed before use.</p>
              <div className='mt-3 flex flex-wrap gap-2'>{Object.values(EVM_NETWORKS).map((item) => <StatusPill key={item.chainId}>{item.name}</StatusPill>)}</div>
            </div>
          ) : null}
          {step === 4 ? (
            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              <label className='text-sm'>Name<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' maxLength={64} onChange={(event) => setName(event.target.value)} value={name} /></label>
              <label className='text-sm'>Symbol<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' maxLength={12} onChange={(event) => setSymbol(event.target.value.toUpperCase())} value={symbol} /></label>
              <label className='text-sm'>Decimals<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' max={18} min={0} onChange={(event) => setDecimals(event.target.value)} type='number' value={decimals} /></label>
              <label className='text-sm'>Supply (optional)<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' min={0} onChange={(event) => setSupply(event.target.value)} type='number' value={supply} /></label>
              <label className='text-sm sm:col-span-2'>Utility<textarea className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' maxLength={1000} onChange={(event) => setUtility(event.target.value)} value={utility} /></label>
              <label className='text-sm sm:col-span-2'>Metadata URI (optional)<input className='mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3' maxLength={500} onChange={(event) => setMetadata(event.target.value)} value={metadata} /></label>
            </div>
          ) : null}
          {step === 5 ? (
            <div className='mt-4 grid gap-3 text-sm'>
              <p>Model: {model} · Network: {network || 'Not selected'}</p>
              <p>Token: {name || '—'} ({symbol || '—'}) · Decimals: {decimals} · Supply: {supply || 'Not specified'}</p>
              <p>Utility: {utility || 'Not specified'} · Metadata: {metadata || 'Not specified'}</p>
              <p className='rounded-xl border border-amber-200/20 bg-amber-900/10 p-3 text-amber-100'>Review this planning draft with qualified technical and compliance professionals. No contract has been created.</p>
            </div>
          ) : null}
          {step === 6 ? (
            <div className='mt-4 grid gap-3 text-sm text-white/70'>
              <p>Wallet connection is an explicit user action. Use the existing wallet hub to connect a supported wallet; this wizard does not request permissions.</p>
              <Link className='w-fit rounded-xl border border-white/15 px-4 py-2 text-white' to='/wallet'>Open wallet</Link>
              <p>No wallet session is stored in this planning draft.</p>
            </div>
          ) : null}
          {step === 7 ? (
            <div className='mt-4 rounded-xl border border-amber-200/20 bg-amber-900/10 p-4 text-sm text-amber-100'>
              <p className='font-semibold'>Transaction not available</p>
              <p className='mt-2'>No deployment adapter, audited template selection, gas estimate, or transaction submission is wired to this wizard. Nothing has been broadcast.</p>
            </div>
          ) : null}
          {step === 8 ? (
            <div className='mt-4 rounded-xl border border-white/10 p-4 text-sm text-white/70'>
              <p className='font-semibold'>No transaction was sent</p>
              <p className='mt-2'>This confirmation step only confirms the local planning flow. There is no transaction hash or on-chain status to report.</p>
              <Link className='mt-4 inline-flex text-tinan-cyan' to='/projects'>Review saved projects</Link>
            </div>
          ) : null}
          {error ? <p className='mt-3 text-sm text-rose-200' role='alert'>{error}</p> : null}
          <div className='mt-5 flex justify-between gap-3'>
            <button className='rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40' disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type='button'>Back</button>
            {step < WIZARD_STEPS.length - 1 ? (
              <button className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-40' disabled={!canContinue()} onClick={() => setStep((current) => Math.min(WIZARD_STEPS.length - 1, current + 1))} type='button'>Continue</button>
            ) : null}
          </div>
        </div>
      </PageSection>
    </div>
  );
}
