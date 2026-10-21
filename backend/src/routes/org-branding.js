/**
 * /api/org/branding — marca de la organización (logo, acento, tema, barra, radios…).
 * Montado con teamAuthMiddleware en server.js. Lectura para cualquier miembro,
 * escritura solo para admin. Contrato del JSON en utils/branding.js.
 */
import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { requireAdmin } from '../middleware/teamAuth.js';
import { uploadBuffer, deleteBlob } from '../utils/blobStorage.js';
import { normalizeBranding, validateBrandingPatch, DEFAULT_BRANDING } from '../utils/branding.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/i.test(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes (PNG, JPG, WEBP, SVG o GIF).'));
    }
    cb(null, true);
  },
});

const LOGO_KINDS = { logo: 'logo_url', logo_dark: 'logo_dark_url', icon: 'icon_url' };

/** Lee la organización y devuelve el branding normalizado (logo_url cae al logo clásico). */
export async function getOrgBranding(orgId) {
  const org = await db.get('SELECT id, name, logo_url, branding FROM organizations WHERE id = ?', [orgId]);
  if (!org) return null;
  return {
    org: { id: org.id, name: org.name, logo_url: org.logo_url || null },
    branding: normalizeBranding(org.branding, { logo_url: org.logo_url }),
  };
}

async function saveBranding(orgId, branding) {
  // Guardamos el objeto completo normalizado; logo_url se sincroniza con la
  // columna clásica para que el resto de la app (sidebar, /auth/me) lo vea igual.
  await db.run(
    `UPDATE organizations
        SET branding = ?::jsonb,
            logo_url = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [JSON.stringify(branding), branding.logo_url || null, orgId]
  );
}

const isBlobUrl = (url) => typeof url === 'string' && /vercel-storage\.com\//.test(url);

/** GET /api/org/branding */
router.get('/', async (req, res) => {
  try {
    const result = await getOrgBranding(req.orgId);
    if (!result) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ ...result, defaults: DEFAULT_BRANDING });
  } catch (error) {
    console.error('Error getting org branding:', error);
    res.status(500).json({ error: 'Error al obtener la marca' });
  }
});

/** PUT /api/org/branding — parcial: solo las claves enviadas se cambian. */
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { ok, errors, value } = validateBrandingPatch(req.body);
    if (!ok) return res.status(400).json({ error: errors.join(' '), errors });

    const current = await getOrgBranding(req.orgId);
    if (!current) return res.status(404).json({ error: 'Organización no encontrada' });

    const merged = normalizeBranding({ ...current.branding, ...value });
    await saveBranding(req.orgId, merged);
    res.json({ success: true, branding: merged });
  } catch (error) {
    console.error('Error updating org branding:', error);
    res.status(500).json({ error: 'Error al guardar la marca' });
  }
});

/** POST /api/org/branding/reset — vuelve a LA REAL (conserva el logo clásico). */
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    const current = await getOrgBranding(req.orgId);
    if (!current) return res.status(404).json({ error: 'Organización no encontrada' });
    const reset = normalizeBranding({ logo_url: current.branding.logo_url });
    await saveBranding(req.orgId, reset);
    res.json({ success: true, branding: reset });
  } catch (error) {
    console.error('Error resetting org branding:', error);
    res.status(500).json({ error: 'Error al restablecer la marca' });
  }
});

/**
 * POST /api/org/branding/logo
 * multipart: field `file` + `kind`   |   JSON: { kind, data: 'data:image/...;base64,...' }
 * kind: 'logo' | 'logo_dark' | 'icon'
 */
router.post('/logo', requireAdmin, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Archivo inválido' });
      next();
    });
  }
  next();
}, async (req, res) => {
  try {
    const kind = String(req.body?.kind || 'logo');
    const column = LOGO_KINDS[kind];
    if (!column) return res.status(400).json({ error: 'kind debe ser logo, logo_dark o icon' });

    let url = null;
    if (req.file) {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await uploadBuffer(`org-branding/${req.orgId}`, req.file);
        url = blob.url;
      } else {
        url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    } else if (typeof req.body?.data === 'string') {
      const data = req.body.data.trim();
      if (!/^data:image\/[a-z+.-]+;base64,/i.test(data)) {
        return res.status(400).json({ error: 'La imagen debe venir como data:image/...;base64' });
      }
      if (data.length > 1_500_000) {
        return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo ~1 MB.' });
      }
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const [, mimetype, b64] = /^data:(image\/[a-z+.-]+);base64,(.*)$/i.exec(data);
        const ext = mimetype.includes('svg') ? '.svg' : `.${mimetype.split('/')[1].replace('jpeg', 'jpg')}`;
        const blob = await uploadBuffer(`org-branding/${req.orgId}`, {
          originalname: `${kind}${ext}`, mimetype, buffer: Buffer.from(b64, 'base64'),
        });
        url = blob.url;
      } else {
        url = data;
      }
    } else {
      return res.status(400).json({ error: 'Falta la imagen (file o data)' });
    }

    const current = await getOrgBranding(req.orgId);
    if (!current) return res.status(404).json({ error: 'Organización no encontrada' });
    const previous = current.branding[column];
    const merged = normalizeBranding({ ...current.branding, [column]: url });
    await saveBranding(req.orgId, merged);
    if (previous && previous !== url && isBlobUrl(previous)) await deleteBlob(previous);

    res.json({ success: true, branding: merged, url });
  } catch (error) {
    console.error('Error uploading org logo:', error);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

/** DELETE /api/org/branding/logo/:kind */
router.delete('/logo/:kind', requireAdmin, async (req, res) => {
  try {
    const column = LOGO_KINDS[req.params.kind];
    if (!column) return res.status(400).json({ error: 'kind debe ser logo, logo_dark o icon' });
    const current = await getOrgBranding(req.orgId);
    if (!current) return res.status(404).json({ error: 'Organización no encontrada' });
    const previous = current.branding[column];
    const merged = normalizeBranding({ ...current.branding, [column]: null });
    // normalizeBranding vuelve a caer al logo clásico si se borra logo_url; forzamos null.
    if (column === 'logo_url') merged.logo_url = null;
    await saveBranding(req.orgId, merged);
    if (previous && isBlobUrl(previous)) await deleteBlob(previous);
    res.json({ success: true, branding: merged });
  } catch (error) {
    console.error('Error deleting org logo:', error);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
});

export default router;
