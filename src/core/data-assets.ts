export type DataAssetKind = 'image' | 'document' | 'audio' | 'video' | 'dataset';

export type DataAsset = {
  id: string;
  owner: string | null;
  type: DataAssetKind;
  name: string;
  description: string;
  size: number;
  mimeType: string;
  hash: string;
  timestamp: string;
  metadata: Record<string, string>;
  storageReference: null;
  proofId: string;
  tokenId: null;
  network: null;
  transactionHash: null;
  verificationStatus: 'hash-recorded' | 'integrity-verified';
  createdAt: string;
};

export type ProofType = 'data' | 'action' | 'knowledge';
export type ProofStatus = 'recorded' | 'signature-verified' | 'integrity-verified';

export type DataProof = {
  id: string;
  type: ProofType;
  assetId: string;
  hash: string;
  timestamp: string;
  owner: string | null;
  signature: string | null;
  metadata: Record<string, string>;
  status: ProofStatus;
};

export type AssetWorkspace = {
  assets: DataAsset[];
  proofs: DataProof[];
};

export type TokenizationRequest = {
  assetId: string;
  targetNetwork: string | null;
  requestedAt: string;
};

export type TokenizationResult = {
  request: TokenizationRequest;
  status: 'metadata-prepared';
  metadata: ReturnType<typeof createTokenMetadata>;
  tokenId: null;
  transactionHash: null;
};

export const MAX_DATA_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_ASSET_NAME_LENGTH = 120;
export const MAX_ASSET_DESCRIPTION_LENGTH = 1000;
export const MAX_PROOF_DESCRIPTION_LENGTH = 500;

const MIME_TYPES: Record<DataAssetKind, readonly string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
  document: [
    'application/pdf',
    'application/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
  ],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'],
  dataset: [
    'application/json',
    'application/x-ndjson',
    'application/vnd.apache.parquet',
    'text/csv',
    'text/tab-separated-values',
    'text/plain',
  ],
};

const FILE_EXTENSIONS: Record<DataAssetKind, readonly string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'],
  document: ['.pdf', '.rtf', '.docx', '.xlsx', '.pptx', '.txt', '.md'],
  audio: ['.mp3', '.m4a', '.wav', '.ogg', '.weba', '.aac', '.flac'],
  video: ['.mp4', '.webm', '.mov', '.ogv'],
  dataset: ['.json', '.jsonl', '.ndjson', '.parquet', '.csv', '.tsv'],
};

const MIME_KIND_ENTRIES = Object.entries(MIME_TYPES) as [DataAssetKind, readonly string[]][];

export function getDataAssetKind(file: File): DataAssetKind | null {
  const mimeType = file.type.toLowerCase();
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  const extensionMatch = MIME_KIND_ENTRIES.find(([kind]) => FILE_EXTENSIONS[kind].includes(extension));
  if (extensionMatch) return extensionMatch[0];
  if (file.name.includes('.')) return null;
  return MIME_KIND_ENTRIES.find(([, mimeTypes]) => mimeTypes.includes(mimeType))?.[0] ?? null;
}

export function validateDataAsset(file: File, name: string, description: string): DataAssetKind {
  const kind = getDataAssetKind(file);
  if (!kind) throw new Error('Choose a supported image, document, audio, video, or dataset file.');
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_DATA_ASSET_BYTES) throw new Error('Files must be 25 MB or smaller.');
  if (!name.trim() || name.trim().length > MAX_ASSET_NAME_LENGTH) {
    throw new Error(`Name must contain 1–${MAX_ASSET_NAME_LENGTH} characters.`);
  }
  if (description.trim().length > MAX_ASSET_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be ${MAX_ASSET_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  return kind;
}

export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Text(value: string): Promise<string> {
  return sha256(new TextEncoder().encode(value));
}

export function createId(): string {
  return crypto.randomUUID();
}

export function createTokenMetadata(asset: DataAsset, proofs: DataProof[]) {
  return {
    schema: 'eureka-data-asset/v1',
    name: asset.name,
    description: asset.description,
    contentHash: `sha256:${asset.hash}`,
    contentType: asset.mimeType,
    contentSize: asset.size,
    createdAt: asset.createdAt,
    owner: asset.owner,
    proofIds: proofs.filter((proof) => proof.assetId === asset.id).map((proof) => proof.id),
    storageReference: asset.storageReference,
  };
}

export function prepareTokenization(
  asset: DataAsset,
  proofs: DataProof[],
  targetNetwork: string | null = null,
): TokenizationResult {
  return {
    request: {
      assetId: asset.id,
      targetNetwork,
      requestedAt: new Date().toISOString(),
    },
    status: 'metadata-prepared',
    metadata: createTokenMetadata(asset, proofs),
    tokenId: null,
    transactionHash: null,
  };
}

export async function verifySignedAction(proof: DataProof): Promise<boolean> {
  if (
    proof.type !== 'action'
    || proof.status !== 'signature-verified'
    || !proof.owner
    || !proof.signature
    || !proof.metadata.message
  ) {
    return false;
  }

  const [{ verifyMessage }, messageHash] = await Promise.all([
    import('ethers'),
    sha256Text(proof.metadata.message),
  ]);

  try {
    const recoveredAddress = verifyMessage(proof.metadata.message, proof.signature);
    return recoveredAddress.toLowerCase() === proof.owner.toLowerCase() && messageHash === proof.hash;
  } catch {
    return false;
  }
}
