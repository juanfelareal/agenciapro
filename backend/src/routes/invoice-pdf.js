import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import siigoService from '../services/siigoService.js';

const router = express.Router();

// Secreto para firmar los enlaces públicos de PDF. Si no hay PDF_LINK_SECRET se deriva de
// DATABASE_URL (estable entre reinicios y desconocido para terceros) en vez de usar una
// constante pública: con un secreto conocido cualquiera podría firmar `${invoiceId}:${orgId}`
// y descargar facturas de cualquier organización.
const PDF_SECRET = process.env.PDF_LINK_SECRET
  || crypto.createHash('sha256').update(`orbit-pdf:${process.env.DATABASE_URL || ''}`).digest('hex');
if (!process.env.PDF_LINK_SECRET) {
  console.warn('⚠️  PDF_LINK_SECRET no está definido: los enlaces de PDF se firman con un secreto derivado de DATABASE_URL');
}

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// Generate a signed token for an invoice PDF link
export function generatePdfToken(invoiceId, orgId) {
  const data = `${invoiceId}:${orgId}`;
  const signature = crypto.createHmac('sha256', PDF_SECRET).update(data).digest('hex').substring(0, 16);
  return Buffer.from(`${data}:${signature}`).toString('base64url');
}

// Public endpoint: view invoice PDF from Siigo (no auth, token-verified)
router.get('/:token', async (req, res) => {
  try {
    const decoded = Buffer.from(req.params.token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 3) return res.status(400).send('Link invalido');

    const [invoiceId, orgId, signature] = parts;
    if (!/^\d+$/.test(invoiceId) || !/^\d+$/.test(orgId)) return res.status(404).send('Link invalido o expirado');
    const expected = crypto.createHmac('sha256', PDF_SECRET).update(`${invoiceId}:${orgId}`).digest('hex').substring(0, 16);

    // Firma inválida → 404 (no revelamos si la factura existe)
    if (!safeEqual(signature, expected)) return res.status(404).send('Link invalido o expirado');

    const invoice = await db.get(`
      SELECT siigo_id, invoice_number FROM invoices WHERE id = ? AND organization_id = ?
    `, [invoiceId, orgId]);

    if (!invoice?.siigo_id) {
      return res.status(404).send(`
        <html><body style="font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f4f4f5;">
          <div style="text-align:center;"><h2>Factura no disponible</h2><p>Esta factura aun no ha sido registrada en Siigo.</p></div>
        </body></html>
      `);
    }

    const pdfData = await siigoService.getInvoicePdf(orgId, invoice.siigo_id);

    if (pdfData?.base64) {
      const pdfBuffer = Buffer.from(pdfData.base64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Factura-${invoice.invoice_number}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.status(404).send('PDF no disponible');
    }
  } catch (error) {
    console.error('PDF view error:', error.message);
    res.status(500).send('Error al obtener el PDF');
  }
});

export default router;
