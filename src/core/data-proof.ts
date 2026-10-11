export type DataProofStatus = 'SUBMITTED' | 'VERIFIED' | 'ANCHORED';

export type DataProofRecord = {
  id: string;
  dataHash: string;
  timestamp: string;
  source: string;
  projectId: string;
  verificationStatus: DataProofStatus;
  blockchainTransaction: string | null;
};

export type EnergyDataSourceType = 'SMART_METER' | 'INVERTER' | 'SOLAR' | 'BATTERY' | 'GRID' | 'API' | 'IOT';

export type EnergyDataReference = {
  sourceType: EnergyDataSourceType;
  sourceReference: string;
  observedAt: string | null;
  measurement: string | null;
  unit: string | null;
  verificationStatus: DataProofStatus;
};

export function createDataProofDraft(input: {
  dataHash: string;
  source: string;
  projectId: string;
  timestamp?: string;
}): DataProofRecord {
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.dataHash)) {
    throw new Error('Provide a valid 32-byte data hash before creating a proof record.');
  }
  if (!input.source.trim() || !input.projectId.trim()) {
    throw new Error('A source and project ID are required for a proof record.');
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `proof-${Date.now()}`,
    dataHash: input.dataHash,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source.trim(),
    projectId: input.projectId.trim(),
    verificationStatus: 'SUBMITTED',
    blockchainTransaction: null,
  };
}
