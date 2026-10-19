import { sha256, verifySignedAction, type DataProof } from './data-assets';
import { fail, ok, type Result } from './errors';

export const PROOF_MODULES = [
  {
    title: 'Proof of Data',
    description: 'Hash a supported file locally and compare it later against the saved SHA-256 record.',
  },
  {
    title: 'Proof of Action',
    description: 'Verify that a connected wallet signed a user-submitted action statement; this does not prove the event occurred.',
  },
  {
    title: 'Proof of Knowledge',
    description: 'Structure user-authored knowledge against a source asset and record a local content hash.',
  },
] as const;

export type ProofVerification = {
  proofId: string;
  type: DataProof['type'];
  /** What was actually checked. Never implies the underlying real-world event or ownership. */
  checked: 'sha256-match' | 'wallet-signature';
};

/**
 * Verifies a proof only where a real check exists:
 * - data: SHA-256 of the supplied bytes equals the recorded hash.
 * - action: recorded wallet signature recovers to the recorded owner for the recorded statement.
 * - knowledge: unsupported, no verification method exists.
 */
export async function verifyProof(proof: DataProof, bytes?: BufferSource): Promise<Result<ProofVerification>> {
  if (proof.type === 'data') {
    if (!bytes) return fail('INVALID_INPUT', 'The original data is required to verify a data proof.');
    const actual = await sha256(bytes);
    if (actual.toLowerCase() !== proof.hash.toLowerCase()) {
      return fail('INVALID_INPUT', 'Data does not match the recorded SHA-256 hash.');
    }
    return ok({ proofId: proof.id, type: 'data', checked: 'sha256-match' });
  }
  if (proof.type === 'action') {
    if (!(await verifySignedAction(proof))) {
      return fail('INVALID_INPUT', 'The wallet signature could not be verified for this statement.');
    }
    return ok({ proofId: proof.id, type: 'action', checked: 'wallet-signature' });
  }
  return fail('UNSUPPORTED', 'Knowledge proofs are local records only; no verification method is implemented.');
}
