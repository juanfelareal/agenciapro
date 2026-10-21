// [email] Vista previa de plantillas de correo con la marca de la organización.
// Montado en /api/org/emails con teamAuthMiddleware + requireAdmin (ver server.js).
//
//   GET /api/org/emails/templates          → lista de plantillas + proveedor activo
//   GET /api/org/emails/preview/:template  → HTML renderizado con datos de ejemplo (?format=json → {subject, html, text})

import express from 'express';
import { renderTemplate, getOrgBrand, sampleDataFor, templates, detectProvider } from '../services/email.js';

const router = express.Router();

router.get('/templates', async (req, res) => {
  const brand = await getOrgBrand(req.orgId);
  res.json({
    provider: detectProvider(),
    brand: { name: brand.name, accent: brand.accent, has_logo: Boolean(brand.logoUrl) },
    templates: Object.entries(templates).map(([name, t]) => ({ name, label: t.label, audience: t.audience })),
  });
});

router.get('/preview/:template', async (req, res) => {
  const name = req.params.template;
  if (!templates[name]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  try {
    const org = await getOrgBrand(req.orgId);
    const data = sampleDataFor(name);
    const rendered = renderTemplate(name, { org, ...data });
    if (req.query.format === 'json') return res.json(rendered);
    res.type('html').send(rendered.html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
