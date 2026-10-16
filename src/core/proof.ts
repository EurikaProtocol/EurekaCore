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
