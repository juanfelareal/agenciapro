import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import siigoService from '../services/siigoService.js';

const router = express.Router();

const PDF_SECRET = process.env.PDF_LINK_SECRET || 'orbit-pdf-secret-2024';

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
    const expected = crypto.createHmac('sha256', PDF_SECRET).update(`${invoiceId}:${orgId}`).digest('hex').substring(0, 16);

    if (signature !== expected) return res.status(403).send('Link invalido o expirado');

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
