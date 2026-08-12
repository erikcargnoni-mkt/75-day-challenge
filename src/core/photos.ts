import type { ISODate } from './date';

/**
 * Weekly progress photos, stored in IndexedDB rather than localStorage.
 *
 * Roughly eleven photos across 75 days would comfortably blow the ~5 MB
 * localStorage budget and take the challenge log down with them. IndexedDB also
 * keeps the blobs out of every JSON export by default, which is the right
 * default for photos of your own body.
 */

const DB_NAME = 'seventyfive.photos';
const STORE = 'photos';
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Downscale and re-encode before storing — phone cameras produce 4 MB files.
 *
 * `imageOrientation: 'from-image'` is explicit rather than left to the default,
 * which has changed across the spec's life: without it a phone photo carrying an
 * EXIF rotation flag can be stored sideways. Re-encoding through the canvas also
 * drops every EXIF field, GPS coordinates included, which is the behaviour we
 * want and not an accident to be optimised away.
 */
export async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export async function savePhoto(date: ISODate, file: File): Promise<void> {
  const blob = await compress(file);
  await tx('readwrite', (s) => s.put(blob, date));
}

export async function getPhoto(date: ISODate): Promise<Blob | undefined> {
  return tx('readonly', (s) => s.get(date));
}

export async function deletePhoto(date: ISODate): Promise<void> {
  await tx('readwrite', (s) => s.delete(date) as unknown as IDBRequest<undefined>);
}

export async function listPhotoDates(): Promise<ISODate[]> {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  return (keys as ISODate[]).sort();
}
