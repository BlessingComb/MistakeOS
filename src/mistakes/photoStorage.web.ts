const DATABASE_NAME = 'mistakeos-question-photos';
const STORE_NAME = 'photos';
const URI_PREFIX = 'mistakeos-photo://';

export async function persistQuestionPhoto(uri: string, _base64: string | null, _mimeType: string): Promise<string> {
  try {
    if (typeof indexedDB === 'undefined') return uri;
    const response = await fetch(uri);
    if (!response.ok) return uri;
    const blob = await response.blob();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await putPhoto(id, blob);
    return `${URI_PREFIX}${id}`;
  } catch {
    return uri;
  }
}

export async function resolveQuestionPhotoUri(uri: string): Promise<string> {
  if (!uri.startsWith(URI_PREFIX)) return uri;
  try {
    const blob = await getPhoto(uri.slice(URI_PREFIX.length));
    return blob ? URL.createObjectURL(blob) : uri;
  } catch { return uri; }
}

export async function clearQuestionPhotos(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putPhoto(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function getPhoto(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const value = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}
