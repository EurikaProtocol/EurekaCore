const FILE_DB_NAME = 'eurekacore-data-vault';
const FILE_DB_VERSION = 1;
const FILE_STORE_NAME = 'files';
const TEXT_ANALYSIS_LIMIT = 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'rtf']);
const DATASET_EXTENSIONS = new Set(['csv', 'json', 'xml', 'parquet', 'tsv']);

export const ASSET_FILTERS = Object.freeze([
  'ALL',
  'IMAGES',
  'DOCUMENTS',
  'AUDIO',
  'VIDEO',
  'DATASETS',
  'PROOFS',
  'TOKENS',
]);

export const PROOF_TYPE_DEFS = Object.freeze([
  {
    id: 'proof-of-data',
    label: 'Proof of Data',
    shortLabel: 'DATA',
    description: 'Creates a verifiable record that links a digital asset to its hash, metadata, timestamp, ownership reference, and storage reference.',
  },
  {
    id: 'proof-of-action',
    label: 'Proof of Action',
    shortLabel: 'ACTION',
    description: 'Records a user-initiated digital action and its resulting artifact without claiming more than the application can actually verify.',
  },
  {
    id: 'proof-of-knowledge',
    label: 'Proof of Knowledge',
    shortLabel: 'KNOWLEDGE',
    description: 'Turns human-created information into structured knowledge assets with a provenance trail, analysis notes, and tokenization metadata.',
  },
]);

export const STORAGE_PROVIDER_DEFS = Object.freeze([
  {
    id: 'browser-vault',
    label: 'Private Browser Vault',
    type: 'Private local storage',
    enabled: true,
    description: 'Stores uploaded files privately in this browser using IndexedDB while the proof and tokenization metadata stay lightweight.',
  },
  {
    id: 'ipfs',
    label: 'IPFS Reference',
    type: 'Decentralized storage',
    enabled: false,
    description: 'Planned provider for future CID-based storage references once upload infrastructure is configured.',
  },
  {
    id: 'arweave',
    label: 'Arweave Archive',
    type: 'Permanent storage',
    enabled: false,
    description: 'Planned provider for long-term archival storage once write integrations are configured.',
  },
]);

function openFileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILE_STORE_NAME)) {
        database.createObjectStore(FILE_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open file storage.'));
  });
}

function withStore(mode, callback) {
  return openFileDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(FILE_STORE_NAME, mode);
        const store = transaction.objectStore(FILE_STORE_NAME);
        const result = callback(store);

        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
        };
      })
  );
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function inferCategory(file) {
  const extension = getFileExtension(file.name);
  const mimeType = file.type || 'application/octet-stream';

  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return { id: 'IMAGES', label: 'Images' };
  }
  if (mimeType.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
    return { id: 'AUDIO', label: 'Audio' };
  }
  if (mimeType.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
    return { id: 'VIDEO', label: 'Video' };
  }
  if (DOCUMENT_EXTENSIONS.has(extension) || mimeType.includes('pdf') || mimeType.includes('document') || mimeType.startsWith('text/')) {
    return { id: 'DOCUMENTS', label: 'Documents' };
  }
  if (DATASET_EXTENSIONS.has(extension) || mimeType.includes('json') || mimeType.includes('csv') || mimeType.includes('sheet')) {
    return { id: 'DATASETS', label: 'Datasets' };
  }

  return { id: 'OTHER', label: 'Other files' };
}

function getFileExtension(name) {
  const segments = name.toLowerCase().split('.');
  return segments.length > 1 ? segments.pop() ?? '' : '';
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'asset';
}

function makeId(prefix, seed = '') {
  if (typeof crypto?.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${slugify(seed)}-${Date.now().toString(36)}`;
}

async function digestFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function readStructuredContent(file) {
  if (!file.type.startsWith('text/') && !['json', 'csv', 'tsv', 'md', 'txt'].includes(getFileExtension(file.name))) {
    return null;
  }
  if (file.size > TEXT_ANALYSIS_LIMIT) {
    return {
      summary: 'File is text-based, but device-side analysis skipped full parsing because the file is larger than 1 MB.',
      relatedInfo: 'Large structured text can still be hashed and referenced without exposing full contents.',
    };
  }

  const raw = await file.text();
  if (!raw.trim()) {
    return {
      summary: 'The file is text-based but currently empty.',
      relatedInfo: 'Empty documents can still be timestamped and hashed as proof artifacts.',
    };
  }

  const extension = getFileExtension(file.name);
  if (extension === 'json' || file.type.includes('json')) {
    try {
      const parsed = JSON.parse(raw);
      const rootKeys = Array.isArray(parsed) ? `${parsed.length} top-level entries` : `${Object.keys(parsed).length} top-level keys`;
      return {
        summary: `Structured JSON detected with ${rootKeys}.`,
        relatedInfo: 'JSON payloads are well suited for dataset proofs, API snapshots, and knowledge assets.',
      };
    } catch {
      return {
        summary: 'JSON-like file detected, but it could not be parsed cleanly on-device.',
        relatedInfo: 'The hash and metadata can still be used to produce a proof record.',
      };
    }
  }

  if (extension === 'csv' || extension === 'tsv' || file.type.includes('csv')) {
    const rows = raw.split(/\r?\n/).filter(Boolean);
    const delimiter = extension === 'tsv' ? '\t' : ',';
    const columnCount = rows[0]?.split(delimiter).length ?? 0;
    return {
      summary: `Structured tabular data detected with ${rows.length} row${rows.length === 1 ? '' : 's'} and approximately ${columnCount} column${columnCount === 1 ? '' : 's'}.`,
      relatedInfo: 'Dataset proofs work well for analytics exports, activity logs, and reporting snapshots.',
    };
  }

  const preview = raw.trim().slice(0, 220).replace(/\s+/g, ' ');
  return {
    summary: `Textual content preview: “${preview}${raw.trim().length > preview.length ? '…' : ''}”`,
    relatedInfo: 'Text-based assets can become documentation proofs, knowledge assets, or action records.',
  };
}

function loadMediaMetadata(file) {
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({
          summary: `Image metadata detected at ${image.naturalWidth} × ${image.naturalHeight}.`,
          relatedInfo: 'Images and screenshots can be turned into proof-backed media assets without placing the full file on-chain.',
        });
        URL.revokeObjectURL(objectUrl);
      };
      image.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(objectUrl);
      };
      image.src = objectUrl;
    });
  }

  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        const duration = Number.isFinite(media.duration) ? `${media.duration.toFixed(1)} second${media.duration >= 2 ? 's' : ''}` : 'unknown duration';
        resolve({
          summary: `${file.type.startsWith('audio/') ? 'Audio' : 'Video'} metadata detected with ${duration}.`,
          relatedInfo: `${file.type.startsWith('audio/') ? 'Audio evidence' : 'Video evidence'} can be referenced by proof records while the original media remains off-chain.`,
        });
        URL.revokeObjectURL(objectUrl);
      };
      media.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(objectUrl);
      };
      media.src = objectUrl;
    });
  }

  return Promise.resolve(null);
}

function getProofTypeDefinition(id) {
  return PROOF_TYPE_DEFS.find((entry) => entry.id === id) ?? PROOF_TYPE_DEFS[0];
}

function getStorageProviderDefinition(id) {
  return STORAGE_PROVIDER_DEFS.find((entry) => entry.id === id) ?? STORAGE_PROVIDER_DEFS[0];
}

function buildPotentialUtility(categoryLabel, proofTypeLabel) {
  return `${categoryLabel} assets can support ${proofTypeLabel.toLowerCase()} workflows for verification, portfolio tracking, collaboration, and later ecosystem utility once additional storage and registry layers are enabled.`;
}

export async function analyzeFile(file, options = {}) {
  const proofType = getProofTypeDefinition(options.proofType);
  const category = inferCategory(file);
  const extension = getFileExtension(file.name) || 'unknown';
  const structured = await readStructuredContent(file).catch(() => null);
  const media = await loadMediaMetadata(file).catch(() => null);
  const modifiedAt = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();
  const metadataFacts = [
    `File type: ${file.type || 'Unspecified binary'}`,
    `Extension: .${extension}`,
    `Size: ${formatBytes(file.size)}`,
    `Last modified: ${formatTimestamp(modifiedAt)}`,
    `Category: ${category.label}`,
  ];
  if (structured?.summary) metadataFacts.push(structured.summary);
  if (media?.summary) metadataFacts.push(media.summary);

  const generatedDescription = options.description?.trim()
    ? options.description.trim()
    : `${proofType.label} candidate derived from ${category.label.toLowerCase()} asset “${file.name}”.`;

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    fileType: file.type || 'application/octet-stream',
    extension,
    sizeBytes: file.size,
    sizeLabel: formatBytes(file.size),
    lastModified: modifiedAt,
    createdAt: new Date().toISOString(),
    metadataFacts,
    description: generatedDescription,
    potentialUtility: buildPotentialUtility(category.label, proofType.label),
    relatedInformation:
      structured?.relatedInfo ??
      media?.relatedInfo ??
      'The current analyzer focuses on metadata, structure, timestamps, and file-level properties. It does not claim to fully verify semantic truth or legal ownership.',
  };
}

export async function createDataAssetRecord({
  file,
  title,
  analysis,
  proofTypeId,
  storageProviderId,
  visibility,
  owner,
  network,
  walletConnected,
}) {
  const createdAt = new Date().toISOString();
  const hash = await digestFile(file);
  const proofType = getProofTypeDefinition(proofTypeId);
  const storageProvider = getStorageProviderDefinition(storageProviderId);
  const assetId = makeId('asset', file.name);
  const proofId = makeId(
    proofTypeId === 'proof-of-action' ? 'poa' : proofTypeId === 'proof-of-knowledge' ? 'pok' : 'pod',
    file.name
  );
  const tokenId = `EUREKA-${hash.slice(0, 12).toUpperCase()}`;
  const contentId = `cid-local-${hash.slice(0, 24)}`;
  const fileStored = storageProvider.enabled
    ? await storePrivateFile(assetId, file)
        .then(() => true)
        .catch(() => false)
    : false;
  const storageReference = fileStored ? `indexeddb://${FILE_DB_NAME}/${assetId}` : `metadata-only://${assetId}`;
  const verificationStatus = walletConnected ? 'Wallet-linked proof generated' : 'Local proof generated';

  const proof = {
    id: proofId,
    assetId,
    proofType: proofType.id,
    proofLabel: proofType.label,
    hash,
    createdAt,
    owner,
    storageProviderId: storageProvider.id,
    storageProviderLabel: storageProvider.label,
    storageReference,
    verificationStatus,
    contentIdentifier: contentId,
    statement:
      proofType.id === 'proof-of-action'
        ? 'This record proves that a user-triggered digital action created or captured the referenced data artifact at a known time.'
        : proofType.id === 'proof-of-knowledge'
          ? 'This record links human-created information with structured metadata and an auditable proof trail for knowledge asset workflows.'
          : 'This record links the uploaded file to a hash, timestamp, metadata, and storage reference without placing the full file on-chain.',
  };

  const asset = {
    id: assetId,
    name: title?.trim() || file.name,
    slug: slugify(title?.trim() || file.name),
    proofId,
    proofType: proofType.id,
    proofLabel: proofType.label,
    categoryId: analysis.categoryId,
    categoryLabel: analysis.categoryLabel,
    fileType: analysis.fileType,
    extension: analysis.extension,
    description: analysis.description,
    potentialUtility: analysis.potentialUtility,
    relatedInformation: analysis.relatedInformation,
    metadataFacts: analysis.metadataFacts,
    createdAt,
    uploadedAt: createdAt,
    fileSize: analysis.sizeBytes,
    fileSizeLabel: analysis.sizeLabel,
    lastModified: analysis.lastModified,
    hash,
    owner,
    ownershipReference: walletConnected ? owner : 'Local browser session',
    contentIdentifier: contentId,
    storageProviderId: storageProvider.id,
    storageProviderLabel: storageProvider.label,
    storageReference,
    storageStatus: fileStored ? 'Stored privately in browser vault' : 'Metadata-only record',
    visibility,
    verificationStatus,
    tokenId,
    tokenizationStatus: 'Local tokenization record created',
    network,
    transactionHash: null,
    transactionStatus: 'On-chain registration coming soon',
    tokenExplorerUrl: null,
    transactionExplorerUrl: null,
    fileAvailable: fileStored,
  };

  return { asset, proof };
}

export function loadDataState(namespace) {
  try {
    const assetsRaw = localStorage.getItem(`${namespace}.assets`);
    const proofsRaw = localStorage.getItem(`${namespace}.proofs`);
    return {
      assets: assetsRaw ? JSON.parse(assetsRaw) : [],
      proofs: proofsRaw ? JSON.parse(proofsRaw) : [],
    };
  } catch {
    return { assets: [], proofs: [] };
  }
}

export function saveDataState(namespace, { assets, proofs }) {
  localStorage.setItem(`${namespace}.assets`, JSON.stringify(assets));
  localStorage.setItem(`${namespace}.proofs`, JSON.stringify(proofs));
}

export async function storePrivateFile(id, file) {
  return withStore('readwrite', (store) => {
    store.put({ id, file, name: file.name, type: file.type, size: file.size, createdAt: Date.now() });
    return null;
  });
}

export async function getPrivateFile(id) {
  const database = await openFileDatabase();
  try {
    const transaction = database.transaction(FILE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);
    const record = await readRequest(store.get(id));
    return record?.file ?? null;
  } finally {
    database.close();
  }
}

export function buildAssetDownloadName(asset) {
  return asset?.name || `${asset?.id ?? 'eureka-asset'}.bin`;
}

export function matchesAssetFilter(asset, filter) {
  if (!filter || filter === 'ALL') return true;
  if (filter === 'PROOFS') return Boolean(asset.proofId);
  if (filter === 'TOKENS') return Boolean(asset.tokenId);
  return asset.categoryId === filter;
}

export function getProofTypeById(id) {
  return getProofTypeDefinition(id);
}

export function getStorageProviderById(id) {
  return getStorageProviderDefinition(id);
}
