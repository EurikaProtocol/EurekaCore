import type { AssetWorkspace, DataAsset, DataProof } from './data-assets';

const DATABASE_NAME = 'eureka-data-assets';
const DATABASE_VERSION = 1;
const ASSETS_STORE = 'assets';
const PROOFS_STORE = 'proofs';

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('Local browser storage is unavailable in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSETS_STORE)) {
        database.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(PROOFS_STORE)) {
        database.createObjectStore(PROOFS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local asset storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

export async function loadAssetWorkspace(): Promise<AssetWorkspace> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([ASSETS_STORE, PROOFS_STORE], 'readonly');
    const [assets, proofs] = await Promise.all([
      requestResult<DataAsset[]>(transaction.objectStore(ASSETS_STORE).getAll()),
      requestResult<DataProof[]>(transaction.objectStore(PROOFS_STORE).getAll()),
    ]);
    return {
      assets: assets.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      proofs: proofs.sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    };
  } finally {
    database.close();
  }
}

export async function saveAssetAndProof(asset: DataAsset, proof: DataProof): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([ASSETS_STORE, PROOFS_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).put(asset);
    transaction.objectStore(PROOFS_STORE).put(proof);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the local data proof.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local data proof save was cancelled.'));
    });
  } finally {
    database.close();
  }
}

export async function saveProof(proof: DataProof): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROOFS_STORE, 'readwrite');
    transaction.objectStore(PROOFS_STORE).put(proof);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the local proof.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local proof save was cancelled.'));
    });
  } finally {
    database.close();
  }
}

export async function saveAsset(asset: DataAsset): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ASSETS_STORE, 'readwrite');
    transaction.objectStore(ASSETS_STORE).put(asset);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not update the local asset.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local asset update was cancelled.'));
    });
  } finally {
    database.close();
  }
}
