import { put, del } from '@vercel/blob';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Upload a file (from multer's memoryStorage buffer) to Vercel Blob.
 * Returns { url, pathname } — store the URL in DB as file_path.
 *
 *   prefix:    logical folder inside the blob ("client-documents", etc.)
 *   file:      multer file (must use memoryStorage so `file.buffer` exists)
 */
export async function uploadBuffer(prefix, file) {
  const ext = path.extname(file.originalname) || '';
  const key = `${prefix}/${randomUUID()}${ext}`;
  const blob = await put(key, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
    addRandomSuffix: false,
  });
  return blob; // { url, pathname, contentType, contentDisposition }
}

/**
 * Delete a previously stored blob. Accepts either the full URL or pathname.
 */
export async function deleteBlob(urlOrPath) {
  if (!urlOrPath) return;
  try {
    await del(urlOrPath);
  } catch (err) {
    // Don't throw on cleanup errors — the DB record is already gone.
    console.error('Blob delete failed:', err.message);
  }
}
