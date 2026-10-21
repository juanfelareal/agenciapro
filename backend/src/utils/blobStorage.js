import { put, del } from '@vercel/blob';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Upload a file (from multer's memoryStorage buffer) to Vercel Blob.
 * Returns { url, pathname } — store the URL in DB as file_path.
 *
 *   prefix:    logical folder inside the blob ("client-documents", etc.)
 *   file:      multer file (must use memoryStorage so `file.buffer` exists)
 *   orgId:     (opcional) organización dueña del archivo; si se pasa, la ruta
 *              queda `${prefix}/org-${orgId}/${uuid}${ext}`.
 *
 * Aislamiento multi-tenant: el blob es público pero la ruta incluye un UUID v4
 * aleatorio (122 bits) y `addRandomSuffix: false`, así que la URL no es
 * adivinable ni enumerable; sólo quien la obtuvo desde la fila de la BD (ya
 * filtrada por organization_id) puede abrirla. El segmento `org-<id>` es
 * informativo (facilita auditar/borrar por organización), no una barrera.
 */
export async function uploadBuffer(prefix, file, orgId = null) {
  const ext = path.extname(file.originalname) || '';
  const orgSegment = Number.isInteger(Number(orgId)) && Number(orgId) > 0 ? `org-${Number(orgId)}/` : '';
  const key = `${prefix}/${orgSegment}${randomUUID()}${ext}`;
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
