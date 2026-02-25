import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import db from '../config/database.js';
import { teamAuthMiddleware } from '../middleware/teamAuth.js';
import { askClaude, askClaudeJSON } from '../services/claudeService.js';

const router = express.Router();

// Apply teamAuthMiddleware to all routes except webhook
router.use((req, res, next) => {
  if (req.path === '/webhook/transcript') {
    return next();
  }
  teamAuthMiddleware(req, res, next);
});

// ========================================
// PIPELINE STAGES
// ========================================

router.get('/stages', async (req, res) => {
  try {
    const stages = await db.all(
      'SELECT * FROM crm_pipeline_stages WHERE organization_id = ? OR organization_id IS NULL ORDER BY position ASC',
      [req.orgId]
    );
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DEALS
// ========================================

// List deals (grouped by stage for kanban)
router.get('/deals', async (req, res) => {
  try {
    const { search, assigned_to, stage_id } = req.query;
    let sql = `
      SELECT d.*, s.name as stage_name, s.color as stage_color, s.position as stage_position,
             tm.name as assigned_to_name
      FROM crm_deals d
      LEFT JOIN crm_pipeline_stages s ON d.stage_id = s.id
      LEFT JOIN team_members tm ON d.assigned_to = tm.id
      WHERE d.organization_id = ?
    `;
    const params = [req.orgId];

    if (search) {
      sql += ' AND (d.name ILIKE ? OR d.client_name ILIKE ? OR d.company ILIKE ? OR d.email ILIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (assigned_to) {
      sql += ' AND d.assigned_to = ?';
      params.push(assigned_to);
    }
    if (stage_id) {
      sql += ' AND d.stage_id = ?';
      params.push(stage_id);
    }

    sql += ' ORDER BY s.position ASC, d.updated_at DESC';

    const deals = await db.all(sql, params);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single deal with activities
router.get('/deals/:id', async (req, res) => {
  try {
    const deal = await db.get(`
      SELECT d.*, s.name as stage_name, s.color as stage_color, s.position as stage_position,
             tm.name as assigned_to_name, c.name as converted_client_name
      FROM crm_deals d
      LEFT JOIN crm_pipeline_stages s ON d.stage_id = s.id
      LEFT JOIN team_members tm ON d.assigned_to = tm.id
      LEFT JOIN clients c ON d.converted_client_id = c.id
      WHERE d.id = ? AND d.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const activities = await db.all(`
      SELECT a.*, tm.name as created_by_name
      FROM crm_activities a
      LEFT JOIN team_members tm ON a.created_by = tm.id
      WHERE a.deal_id = ? AND a.organization_id = ?
      ORDER BY a.created_at DESC
    `, [req.params.id, req.orgId]);

    // Get all stages for the pipeline indicator
    const stages = await db.all(
      'SELECT * FROM crm_pipeline_stages WHERE organization_id = ? OR organization_id IS NULL ORDER BY position ASC',
      [req.orgId]
    );

    res.json({ ...deal, activities, stages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create deal
router.post('/deals', async (req, res) => {
  try {
    const { name, client_name, email, phone, company, source, estimated_value, stage_id, notes, assigned_to } = req.body;

    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

    // Default to first stage (Lead) if not specified
    let finalStageId = stage_id;
    if (!finalStageId) {
      const firstStage = await db.get(
        'SELECT id FROM crm_pipeline_stages WHERE (organization_id = ? OR organization_id IS NULL) ORDER BY position ASC LIMIT 1',
        [req.orgId]
      );
      finalStageId = firstStage?.id;
    }

    const result = await db.run(`
      INSERT INTO crm_deals (name, client_name, email, phone, company, source, estimated_value, stage_id, notes, assigned_to, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, client_name, email, phone, company, source, estimated_value || 0, finalStageId, notes, assigned_to, req.orgId]);

    const deal = await db.get('SELECT * FROM crm_deals WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update deal
router.put('/deals/:id', async (req, res) => {
  try {
    const { name, client_name, email, phone, company, source, estimated_value, notes, assigned_to } = req.body;

    await db.run(`
      UPDATE crm_deals
      SET name = ?, client_name = ?, email = ?, phone = ?, company = ?, source = ?,
          estimated_value = ?, notes = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [name, client_name, email, phone, company, source, estimated_value, notes, assigned_to, req.params.id, req.orgId]);

    const deal = await db.get('SELECT * FROM crm_deals WHERE id = ?', [req.params.id]);
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete deal
router.delete('/deals/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM crm_deals WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Deal eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move deal to a different stage
router.patch('/deals/:id/stage', async (req, res) => {
  try {
    const { stage_id } = req.body;

    const deal = await db.get('SELECT * FROM crm_deals WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const oldStage = await db.get('SELECT name FROM crm_pipeline_stages WHERE id = ?', [deal.stage_id]);
    const newStage = await db.get('SELECT name FROM crm_pipeline_stages WHERE id = ?', [stage_id]);

    await db.run(`
      UPDATE crm_deals SET stage_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [stage_id, req.params.id]);

    // Auto-set won_at / lost_at based on stage name
    if (newStage?.name === 'Cliente Ganado') {
      await db.run('UPDATE crm_deals SET won_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    } else if (newStage?.name === 'Perdido') {
      await db.run('UPDATE crm_deals SET lost_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    }

    // Create stage_change activity
    await db.run(`
      INSERT INTO crm_activities (deal_id, type, title, content, created_by, organization_id)
      VALUES (?, 'stage_change', ?, ?, ?, ?)
    `, [
      req.params.id,
      `Movido a ${newStage?.name || 'etapa desconocida'}`,
      `De "${oldStage?.name || '?'}" a "${newStage?.name || '?'}"`,
      req.teamMember.id,
      req.orgId
    ]);

    const updated = await db.get('SELECT * FROM crm_deals WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ACTIVITIES
// ========================================

router.get('/deals/:id/activities', async (req, res) => {
  try {
    const activities = await db.all(`
      SELECT a.*, tm.name as created_by_name
      FROM crm_activities a
      LEFT JOIN team_members tm ON a.created_by = tm.id
      WHERE a.deal_id = ? AND a.organization_id = ?
      ORDER BY a.created_at DESC
    `, [req.params.id, req.orgId]);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/deals/:id/activities', async (req, res) => {
  try {
    const { type, title, content } = req.body;
    if (!type) return res.status(400).json({ error: 'Tipo es requerido' });

    const result = await db.run(`
      INSERT INTO crm_activities (deal_id, type, title, content, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, type, title, content, req.teamMember.id, req.orgId]);

    const activity = await db.get('SELECT * FROM crm_activities WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/activities/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM crm_activities WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// TRANSCRIPT PROCESSING
// ========================================

router.post('/deals/:id/transcript', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto del transcript es requerido' });

    const deal = await db.get('SELECT * FROM crm_deals WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const prompt = `Analiza esta transcripción de una reunión de ventas y extrae la siguiente información en formato JSON. Responde SOLO con el JSON, sin markdown ni texto adicional.

Transcripción:
${text}

Extrae:
{
  "summary": "Resumen de la reunión en 2-3 oraciones",
  "pain_points": ["dolor 1", "dolor 2"],
  "services_interested": ["servicio 1", "servicio 2"],
  "budget_signals": "Lo que mencionaron sobre presupuesto",
  "current_metrics": "Métricas actuales que mencionaron",
  "next_steps": ["paso 1", "paso 2"],
  "urgency": "alta/media/baja"
}`;

    let extracted;
    try {
      extracted = await askClaudeJSON(prompt);
    } catch {
      const rawText = await askClaude(prompt);
      extracted = { summary: rawText };
    }

    // Save full transcript text alongside extracted data
    const metadataWithTranscript = { ...extracted, full_transcript: text };

    // Save as transcript activity
    await db.run(`
      INSERT INTO crm_activities (deal_id, type, title, content, metadata, created_by, organization_id)
      VALUES (?, 'transcript', ?, ?, ?, ?, ?)
    `, [
      req.params.id,
      'Transcripción de reunión',
      extracted.summary || '',
      JSON.stringify(metadataWithTranscript),
      req.teamMember.id,
      req.orgId
    ]);

    res.json(extracted);
  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: 'Error procesando transcripción' });
  }
});

// ========================================
// CONVERT DEAL TO CLIENT
// ========================================

router.post('/deals/:id/convert', async (req, res) => {
  try {
    const deal = await db.get('SELECT * FROM crm_deals WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    if (deal.converted_client_id) {
      return res.status(400).json({ error: 'Este deal ya fue convertido a cliente' });
    }

    // Create client from deal data
    const result = await db.run(`
      INSERT INTO clients (name, company, email, phone, status, organization_id)
      VALUES (?, ?, ?, ?, 'active', ?)
    `, [deal.client_name || deal.name, deal.company, deal.email, deal.phone, req.orgId]);

    const clientId = result.lastInsertRowid;

    // Mark deal as won and link to client
    const wonStage = await db.get(
      "SELECT id FROM crm_pipeline_stages WHERE name = 'Cliente Ganado' AND (organization_id = ? OR organization_id IS NULL)",
      [req.orgId]
    );

    await db.run(`
      UPDATE crm_deals
      SET converted_client_id = ?, won_at = CURRENT_TIMESTAMP, stage_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [clientId, wonStage?.id || deal.stage_id, req.params.id]);

    // Create activity
    await db.run(`
      INSERT INTO crm_activities (deal_id, type, title, content, created_by, organization_id)
      VALUES (?, 'stage_change', 'Convertido a cliente', ?, ?, ?)
    `, [req.params.id, `Cliente creado con ID ${clientId}`, req.teamMember.id, req.orgId]);

    const client = await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);
    res.status(201).json({ client, deal_id: deal.id });
  } catch (error) {
    console.error('Error converting deal:', error);
    res.status(500).json({ error: 'Error convirtiendo deal a cliente' });
  }
});

// ========================================
// WEBHOOK (for Tactiq/Zapier integration)
// ========================================

router.post('/webhook/transcript', async (req, res) => {
  try {
    const webhookSecret = req.headers['x-webhook-secret'];
    if (!webhookSecret || webhookSecret !== process.env.CRM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { deal_id, text, organization_id } = req.body;
    if (!deal_id || !text) {
      return res.status(400).json({ error: 'deal_id y text son requeridos' });
    }

    const prompt = `Analiza esta transcripción de una reunión de ventas y extrae la siguiente información en formato JSON. Responde SOLO con el JSON.

Transcripción:
${text}

{
  "summary": "Resumen en 2-3 oraciones",
  "pain_points": [],
  "services_interested": [],
  "budget_signals": "",
  "next_steps": [],
  "urgency": "alta/media/baja"
}`;

    let extracted;
    try {
      extracted = await askClaudeJSON(prompt);
    } catch {
      const rawText = await askClaude(prompt);
      extracted = { summary: rawText };
    }

    await db.run(`
      INSERT INTO crm_activities (deal_id, type, title, content, metadata, organization_id)
      VALUES (?, 'transcript', 'Transcripción (webhook)', ?, ?, ?)
    `, [deal_id, extracted.summary || '', JSON.stringify(extracted), organization_id]);

    res.json({ success: true, extracted });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PROPOSAL TEMPLATES
// ========================================

router.get('/proposals/templates', async (req, res) => {
  try {
    const templates = await db.all(
      'SELECT * FROM proposal_templates WHERE organization_id = ? OR organization_id IS NULL ORDER BY name',
      [req.orgId]
    );
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate proposal from template + deal context
router.post('/proposals/generate', async (req, res) => {
  try {
    const { deal_id, template_slug, variables } = req.body;

    // Get template
    const template = await db.get('SELECT * FROM proposal_templates WHERE slug = ?', [template_slug]);
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

    // Read template HTML
    let html;
    try {
      html = await fs.readFile(template.template_path, 'utf-8');
    } catch {
      return res.status(404).json({ error: 'Archivo de plantilla no encontrado en disco' });
    }

    const providedVars = { ...(variables || {}) };

    // Get deal info + transcripts for context
    let dealContext = '';
    let allPainPoints = [];
    let allServices = [];
    let allBudgetSignals = [];
    let allNextSteps = [];
    let allSummaries = [];
    let urgency = '';

    if (deal_id) {
      const deal = await db.get('SELECT * FROM crm_deals WHERE id = ? AND organization_id = ?', [deal_id, req.orgId]);
      if (deal) {
        dealContext += `\nNombre del cliente: ${deal.client_name || deal.name}`;
        dealContext += `\nEmpresa: ${deal.company || ''}`;
        dealContext += `\nEmail: ${deal.email || ''}`;
        dealContext += `\nValor estimado: $${(deal.estimated_value || 0).toLocaleString()} COP`;
        if (deal.notes) dealContext += `\nNotas del deal: ${deal.notes}`;

        // Pre-fill basic variables from deal data
        if (!providedVars.NOMBRE_CLIENTE) providedVars.NOMBRE_CLIENTE = deal.company || deal.client_name || deal.name || '';

        const transcripts = await db.all(
          "SELECT content, metadata FROM crm_activities WHERE deal_id = ? AND type = 'transcript' ORDER BY created_at DESC LIMIT 5",
          [deal_id]
        );

        const fullTranscripts = [];

        for (const t of transcripts) {
          if (t.content) allSummaries.push(t.content);
          if (t.metadata) {
            try {
              const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
              if (meta.pain_points?.length) allPainPoints.push(...meta.pain_points);
              if (meta.services_interested?.length) allServices.push(...meta.services_interested);
              if (meta.budget_signals) allBudgetSignals.push(meta.budget_signals);
              if (meta.next_steps?.length) allNextSteps.push(...meta.next_steps);
              if (meta.current_metrics) dealContext += `\nMétricas actuales del cliente: ${meta.current_metrics}`;
              if (meta.urgency) urgency = meta.urgency;
              if (meta.full_transcript) fullTranscripts.push(meta.full_transcript);
            } catch { /* ignore */ }
          }
        }

        // Include full transcripts first — the most important context for proposals
        if (fullTranscripts.length) {
          dealContext += `\n\n=== TRANSCRIPCIONES COMPLETAS DE REUNIONES ===\n`;
          fullTranscripts.forEach((ft, i) => {
            dealContext += `\n--- Reunión ${i + 1} ---\n${ft}\n`;
          });
        }

        if (allSummaries.length) dealContext += `\n\nResúmenes de reuniones:\n${allSummaries.join('\n')}`;
        if (allPainPoints.length) dealContext += `\n\nPain points detectados:\n${[...new Set(allPainPoints)].map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
        if (allServices.length) dealContext += `\n\nServicios de interés: ${[...new Set(allServices)].join(', ')}`;
        if (allBudgetSignals.length) dealContext += `\n\nSeñales de presupuesto:\n${allBudgetSignals.join('\n')}`;
        if (allNextSteps.length) dealContext += `\n\nPróximos pasos acordados: ${[...new Set(allNextSteps)].join(', ')}`;
        if (urgency) dealContext += `\nUrgencia: ${urgency}`;
      }
    }

    // Find all {{VARIABLES}} in template
    const templateVars = [...html.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    const uniqueVars = [...new Set(templateVars)];

    // Find missing variables that need AI completion
    const missingVars = uniqueVars.filter(v => !providedVars[v]);

    let finalVars = { ...providedVars };

    if (missingVars.length > 0 && dealContext) {
      const prompt = `Eres un experto en propuestas comerciales para una agencia de marketing digital colombiana llamada LA REAL. Basándote en la información real del cliente (extraída de reuniones y transcripciones), llena las variables de la plantilla de propuesta.

INFORMACIÓN DEL CLIENTE Y REUNIONES:
${dealContext}

VARIABLES QUE NECESITO LLENAR: ${JSON.stringify(missingVars)}

INSTRUCCIONES IMPORTANTES:
- PAIN_1, PAIN_2, PAIN_3, PAIN_4: Usa los pain points reales detectados en las reuniones. Deben ser frases cortas y directas (ej: "No tienen presencia digital", "Pierden ventas por falta de tienda online").
- INVERSION_MENSUAL: Si hay señales de presupuesto, usa un valor realista basado en lo que mencionó el cliente. Formato: "$X.XXX.XXX"
- PRECIO_PAUTA, PRECIO_METODO, PRECIO_BASICO, PRECIO_PRO, PRECIO_PREMIUM: Sugiere precios en COP basándote en las señales de presupuesto. Formato: "$X.XXX.XXX"
- NOMBRE_CLIENTE: Nombre de la empresa/cliente
- LOGO_CLIENTE: Déjalo vacío ("")
- Si no hay información suficiente para una variable, pon un placeholder descriptivo entre corchetes como "[Pendiente: descripción de lo que va aquí]"

Responde SOLO con el objeto JSON, sin markdown ni texto adicional:`;

      try {
        const aiVars = await askClaudeJSON(prompt);
        finalVars = { ...aiVars, ...providedVars }; // User-provided values take priority
      } catch (err) {
        console.error('AI variable fill error:', err.message);
      }
    }

    // Replace variables in HTML
    let finalHtml = html;
    for (const [key, value] of Object.entries(finalVars)) {
      finalHtml = finalHtml.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }

    res.json({
      html: finalHtml,
      variables: finalVars,
      template_vars: uniqueVars,
    });
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({ error: 'Error generando propuesta' });
  }
});

// Generate custom proposal from scratch using AI
// Strategy: Use the pauta-metodo-real template as a shell, have Claude generate ONLY the slide content as JSON, then inject it.
router.post('/proposals/generate-custom', async (req, res) => {
  try {
    const { deal_id, services_description } = req.body;
    if (!services_description) return res.status(400).json({ error: 'Descripción de servicios es requerida' });

    // Build deal context
    let dealContext = '';
    let clientName = '';
    if (deal_id) {
      const deal = await db.get('SELECT * FROM crm_deals WHERE id = ? AND organization_id = ?', [deal_id, req.orgId]);
      if (deal) {
        clientName = deal.company || deal.client_name || deal.name || '';
        dealContext += `Nombre: ${clientName}`;
        dealContext += `\nValor estimado: $${(deal.estimated_value || 0).toLocaleString()} COP`;
        if (deal.notes) dealContext += `\nNotas: ${deal.notes}`;

        const transcripts = await db.all(
          "SELECT content, metadata FROM crm_activities WHERE deal_id = ? AND type = 'transcript' ORDER BY created_at DESC LIMIT 5",
          [deal_id]
        );

        for (const t of transcripts) {
          if (t.content) dealContext += `\nResumen: ${t.content}`;
          if (t.metadata) {
            try {
              const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
              if (meta.pain_points?.length) dealContext += `\nPain points: ${meta.pain_points.join('; ')}`;
              if (meta.services_interested?.length) dealContext += `\nServicios: ${meta.services_interested.join('; ')}`;
              if (meta.budget_signals) dealContext += `\nPresupuesto: ${meta.budget_signals}`;
              if (meta.current_metrics) dealContext += `\nMétricas: ${meta.current_metrics}`;
              if (meta.next_steps?.length) dealContext += `\nPróximos pasos: ${meta.next_steps.join('; ')}`;
              if (meta.full_transcript) dealContext += `\n\nTRANSCRIPCIÓN COMPLETA:\n${meta.full_transcript.substring(0, 3000)}`;
            } catch { /* ignore */ }
          }
        }
      }
    }

    const prompt = `Genera contenido para una presentación comercial de LA REAL (agencia de marketing digital colombiana).

SERVICIOS A PROPONER: ${services_description}

INFORMACIÓN DEL CLIENTE:
${dealContext || 'Sin datos — usa placeholders genéricos'}

Responde SOLO con JSON (sin markdown, sin code fences):
{
  "titulo_portada": "Título emocional para la portada (máx 10 palabras, la palabra clave en **negritas**)",
  "subtitulo_portada": "Subtítulo corto",
  "pills": ["Servicio 1", "Servicio 2", "Servicio 3"],
  "titulo_problema": "Título del slide de problema con palabra clave en **negritas**",
  "pain_points": [
    {"icon": "emoji", "text": "Pain point 1"},
    {"icon": "emoji", "text": "Pain point 2"},
    {"icon": "emoji", "text": "Pain point 3"},
    {"icon": "emoji", "text": "Pain point 4"}
  ],
  "titulo_solucion": "Título del slide de solución",
  "metricas": [
    {"valor": "10x", "label": "Descripción corta"},
    {"valor": "∞", "label": "Descripción corta"},
    {"valor": "24/7", "label": "Descripción corta"},
    {"valor": "100%", "label": "Descripción corta"}
  ],
  "titulo_proceso": "Título del slide de proceso",
  "pasos": [
    {"mes": "Fase 1", "titulo": "Título", "items": ["item1", "item2", "item3"]},
    {"mes": "Fase 2", "titulo": "Título", "items": ["item1", "item2", "item3"]},
    {"mes": "Fase 3", "titulo": "Título", "items": ["item1", "item2", "item3"]}
  ],
  "servicios_detalle": [
    {"nombre": "Servicio 1", "descripcion": "Descripción", "incluye": ["item 1", "item 2", "item 3", "item 4"]},
    {"nombre": "Servicio 2", "descripcion": "Descripción", "incluye": ["item 1", "item 2", "item 3", "item 4"]}
  ],
  "titulo_inversion": "Título del slide de inversión",
  "paquetes": [
    {"nombre": "PAQUETE 1", "precio": "$X.XXX.XXX", "periodo": "/mes +IVA", "incluye": "Descripción", "audiencia": "Para quién es", "recomendado": false},
    {"nombre": "PAQUETE 2", "precio": "$X.XXX.XXX", "periodo": "/mes +IVA", "incluye": "Descripción", "audiencia": "Para quién es", "recomendado": true},
    {"nombre": "PAQUETE 3", "precio": "$X.XXX.XXX", "periodo": "/mes +IVA", "incluye": "Descripción", "audiencia": "Para quién es", "recomendado": false}
  ],
  "nota_precios": "Nota adicional sobre precios",
  "titulo_cierre": "Título emocional del cierre con palabra clave en **negritas**"
}

IMPORTANTE:
- Personaliza TODO basándote en la transcripción y datos del cliente
- Pain points deben ser problemas REALES mencionados en la reunión
- Precios en COP, usa señales de presupuesto del cliente si hay
- El paquete recomendado debe alinearse con lo que el cliente necesita
- Usa lenguaje profesional pero cercano, en español colombiano`;

    console.log(`[Proposal] Generating for deal ${deal_id}, prompt length: ${prompt.length} chars`);
    const content = await askClaudeJSON(prompt, { model: 'sonnet', timeout: 180000 });

    // Now build the HTML using the template shell
    const html = buildCustomPresentation(content, clientName);

    res.json({ html });
  } catch (error) {
    console.error('Error generating custom proposal:', error);
    res.status(500).json({ error: 'Error generando propuesta personalizada' });
  }
});

// Build HTML presentation from JSON content
function buildCustomPresentation(c, clientName) {
  const name = clientName || 'Cliente';
  const totalSlides = 7 + (c.servicios_detalle?.length > 2 ? 1 : 0);
  const formatTitle = (t) => t?.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>') || '';

  // Build service slides
  let serviceSlides = '';
  let slideNum = 5;
  if (c.servicios_detalle?.length) {
    // Group services into slides of 2
    for (let i = 0; i < c.servicios_detalle.length; i += 2) {
      const batch = c.servicios_detalle.slice(i, i + 2);
      serviceSlides += `
        <div class="slide slide-light" id="slide${slideNum}">
            <span class="section-tag">Servicios</span>
            <h2>Lo que haremos por <span class="highlight">${name}</span></h2>
            <div class="includes-grid">
                ${batch.map(s => `
                <div style="background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.04);">
                    <h3 style="font-size:20px;font-weight:900;color:#0D1B2A;letter-spacing:-0.5px;margin-bottom:8px;text-align:left;">${s.nombre}</h3>
                    <p style="font-size:15px;color:#6b7280;margin-bottom:16px;line-height:1.5;text-align:left;">${s.descripcion}</p>
                    <ul style="list-style:none;display:flex;flex-direction:column;gap:8px;">
                        ${(s.incluye || []).map(item => `<li style="font-size:14px;font-weight:500;color:#374151;display:flex;align-items:flex-start;gap:10px;"><span style="color:#16a34a;font-weight:800;">&#10003;</span> ${item}</li>`).join('')}
                    </ul>
                </div>`).join('')}
            </div>
        </div>`;
      slideNum++;
    }
  }

  const investmentSlideNum = slideNum;
  const closeSlideNum = slideNum + 1;
  const total = closeSlideNum;

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Propuesta ${name} — LA REAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #0D1B2A; color: #1a1a1a; overflow: hidden; -webkit-font-smoothing: antialiased; }
        .presentation { width: 100vw; height: 100vh; position: relative; }
        .slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding: 100px 80px 80px; opacity: 0; visibility: hidden; transition: opacity 0.6s ease, visibility 0.6s ease; overflow: hidden; }
        .slide-portada, .slide-cierre { justify-content: center; }
        .slide.active { opacity: 1; visibility: visible; }
        .slide > * { position: relative; z-index: 2; }
        .slide-dark { background: #0D1B2A; color: #ffffff; }
        .slide-dark::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(ellipse at 30% 50%, rgba(74,222,128,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.04) 0%, transparent 50%); pointer-events: none; z-index: 1; }
        .slide-light { background: #F5F0EB; color: #1a1a1a; }
        .slide-light::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(ellipse at 80% 20%, rgba(74,222,128,0.04) 0%, transparent 50%); pointer-events: none; z-index: 1; }
        h1 { font-size: 72px; font-weight: 900; line-height: 1.0; letter-spacing: -3px; max-width: 1000px; text-align: center; margin-bottom: 30px; }
        h2 { font-size: 52px; font-weight: 900; line-height: 1.1; letter-spacing: -2px; max-width: 900px; text-align: center; margin-bottom: 40px; }
        .highlight { color: #4ADE80; }
        .slide-light .highlight { color: #16a34a; }
        .subtitle { font-size: 20px; color: #94A3B8; text-align: center; max-width: 600px; line-height: 1.6; }
        .slide-light .subtitle { color: #6b7280; }
        .section-tag { font-size: 12px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 24px; padding: 8px 20px; border-radius: 50px; }
        .slide-dark .section-tag { color: #4ADE80; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); }
        .slide-light .section-tag { color: #0D1B2A; background: rgba(13,27,42,0.06); border: 1px solid rgba(13,27,42,0.1); }
        .pain-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 30px; max-width: 800px; width: 100%; }
        .pain-card { background: #fff; border-radius: 16px; padding: 28px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); transition: transform 0.3s ease; }
        .pain-card:hover { transform: translateY(-3px); }
        .pain-icon { width: 48px; height: 48px; border-radius: 14px; background: #FEE2E2; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .pain-text { font-size: 16px; font-weight: 500; color: #374151; line-height: 1.4; }
        .metrics-row { display: flex; gap: 24px; margin-top: 40px; max-width: 900px; width: 100%; justify-content: center; flex-wrap: wrap; }
        .metric-card { background: #fff; border-radius: 20px; padding: 32px 28px; text-align: center; flex: 1; min-width: 180px; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); transition: transform 0.3s ease; }
        .metric-card:hover { transform: translateY(-3px); }
        .metric-value { font-size: 48px; font-weight: 900; color: #0D1B2A; letter-spacing: -2px; line-height: 1; }
        .metric-label { font-size: 14px; font-weight: 500; color: #6b7280; margin-top: 8px; }
        .roadmap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; max-width: 1000px; width: 100%; }
        .roadmap-card { background: #fff; border-radius: 20px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); transition: transform 0.3s ease; }
        .roadmap-card:hover { transform: translateY(-4px); }
        .roadmap-month { font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #16a34a; margin-bottom: 8px; }
        .roadmap-title { font-size: 22px; font-weight: 900; color: #0D1B2A; letter-spacing: -0.5px; margin-bottom: 16px; line-height: 1.2; }
        .roadmap-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .roadmap-list li { font-size: 14px; font-weight: 500; color: #374151; line-height: 1.4; display: flex; align-items: flex-start; gap: 10px; }
        .roadmap-list li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #16a34a; flex-shrink: 0; margin-top: 6px; }
        .includes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 30px; max-width: 900px; width: 100%; }
        .tier-table { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; max-width: 900px; width: 100%; }
        .tier-card { background: #fff; border-radius: 20px; padding: 32px 24px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04); transition: transform 0.3s ease; display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; }
        .tier-card:hover { transform: translateY(-4px); }
        .tier-card.recommended { border: 2px solid #16a34a; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 30px rgba(22,163,74,0.12); transform: scale(1.04); }
        .tier-name { font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #16a34a; }
        .tier-price { font-size: 36px; font-weight: 900; color: #0D1B2A; letter-spacing: -1.5px; }
        .tier-period { font-size: 13px; font-weight: 600; color: #9ca3af; }
        .tier-desc { font-size: 14px; font-weight: 500; color: #6b7280; line-height: 1.4; }
        .tier-audience { font-size: 13px; font-style: italic; color: #9ca3af; }
        .pricing-recommended-tag { position: absolute; top: -14px; background: #16a34a; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 18px; border-radius: 50px; }
        .hero-pills { display: flex; gap: 16px; margin-top: 40px; flex-wrap: wrap; justify-content: center; }
        .hero-pill { display: flex; align-items: center; gap: 10px; padding: 12px 24px; border: 1px solid rgba(74,222,128,0.3); border-radius: 50px; font-size: 15px; font-weight: 600; color: #fff; background: rgba(74,222,128,0.06); box-shadow: 0 0 20px rgba(74,222,128,0.1); opacity: 0; transform: translateY(20px); animation: pillFadeIn 0.6s ease forwards; }
        .hero-pill:nth-child(1) { animation-delay: 0.3s; }
        .hero-pill:nth-child(2) { animation-delay: 0.5s; }
        .hero-pill:nth-child(3) { animation-delay: 0.7s; }
        .navigation { position: fixed; bottom: 30px; right: 30px; display: flex; gap: 10px; z-index: 100; }
        .nav-btn { width: 44px; height: 44px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-size: 18px; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .nav-btn:hover { background: #4ADE80; color: #0D1B2A; border-color: #4ADE80; }
        .progress { position: fixed; bottom: 0; left: 0; height: 3px; background: #4ADE80; transition: width 0.3s ease; z-index: 200; }
        .slide-counter { position: fixed; bottom: 38px; left: 30px; font-size: 13px; font-weight: 500; color: #64748B; z-index: 100; }
        @keyframes pillFadeIn { to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
            h1 { font-size: 32px; letter-spacing: -1.5px; }
            h2 { font-size: 26px; letter-spacing: -1px; }
            .slide { padding: 60px 20px 20px !important; overflow-y: auto; }
            .pain-grid, .includes-grid { grid-template-columns: 1fr; }
            .metrics-row { flex-direction: column; }
            .roadmap { grid-template-columns: 1fr; }
            .tier-table { grid-template-columns: 1fr; }
            .tier-card.recommended { transform: none; }
            .hero-pills { flex-direction: column; align-items: center; }
            .navigation { bottom: 16px; right: 16px; }
            .nav-btn { width: 38px; height: 38px; }
        }
    </style>
</head>
<body>
    <div class="presentation">
        <div class="progress" id="progress"></div>
        <div class="slide-counter" id="slideCounter">1 / ${total}</div>
        <img src="logo-la-real.png" style="position:fixed;top:30px;left:30px;width:50px;z-index:100;opacity:0.8;">

        <!-- PORTADA -->
        <div class="slide slide-dark slide-portada active" id="slide1">
            <p style="font-size:14px;color:#64748B;font-weight:500;margin-bottom:30px;letter-spacing:2px;text-transform:uppercase;">Preparado para ${name}</p>
            <h1>${formatTitle(c.titulo_portada)}</h1>
            <p class="subtitle" style="font-size:22px;">${c.subtitulo_portada || ''}</p>
            <div class="hero-pills">
                ${(c.pills || []).map(p => `<div class="hero-pill">${p}</div>`).join('')}
            </div>
            <p style="font-size:13px;color:#64748B;margin-top:30px;">Por <img src="logo-la-real.png" alt="LA REAL" style="height:18px;vertical-align:middle;opacity:0.7;margin:0 4px;"> LA REAL</p>
        </div>

        <!-- PROBLEMA -->
        <div class="slide slide-light" id="slide2">
            <span class="section-tag">El problema</span>
            <h2>${formatTitle(c.titulo_problema)}</h2>
            <div class="pain-grid">
                ${(c.pain_points || []).map(p => `
                <div class="pain-card">
                    <div class="pain-icon">${p.icon}</div>
                    <div class="pain-text">${p.text}</div>
                </div>`).join('')}
            </div>
        </div>

        <!-- SOLUCIÓN -->
        <div class="slide slide-light" id="slide3">
            <span class="section-tag">La solución</span>
            <h2>${formatTitle(c.titulo_solucion)}</h2>
            <div class="metrics-row">
                ${(c.metricas || []).map(m => `
                <div class="metric-card">
                    <div class="metric-value">${m.valor}</div>
                    <div class="metric-label">${m.label}</div>
                </div>`).join('')}
            </div>
        </div>

        <!-- PROCESO -->
        <div class="slide slide-light" id="slide4">
            <span class="section-tag">Proceso</span>
            <h2>${formatTitle(c.titulo_proceso)}</h2>
            <div class="roadmap">
                ${(c.pasos || []).map(p => `
                <div class="roadmap-card">
                    <div class="roadmap-month">${p.mes}</div>
                    <div class="roadmap-title">${p.titulo}</div>
                    <ul class="roadmap-list">
                        ${(p.items || []).map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>`).join('')}
            </div>
        </div>

        <!-- SERVICIOS -->
        ${serviceSlides}

        <!-- INVERSIÓN -->
        <div class="slide slide-light" id="slide${investmentSlideNum}">
            <span class="section-tag">Inversión</span>
            <h2>${formatTitle(c.titulo_inversion) || `Inversión para <span class="highlight">${name}</span>`}</h2>
            <div class="tier-table">
                ${(c.paquetes || []).map(p => `
                <div class="tier-card${p.recomendado ? ' recommended' : ''}">
                    ${p.recomendado ? '<div class="pricing-recommended-tag">Recomendado</div>' : ''}
                    <div class="tier-name">${p.nombre}</div>
                    <div class="tier-price">${p.precio}</div>
                    <div class="tier-period">${p.periodo || '/mes +IVA'}</div>
                    <div class="tier-desc">${p.incluye}</div>
                    <div class="tier-audience">${p.audiencia}</div>
                </div>`).join('')}
            </div>
            ${c.nota_precios ? `<p style="margin-top:24px;font-size:14px;color:#9ca3af;text-align:center;max-width:700px;">${c.nota_precios}</p>` : ''}
        </div>

        <!-- CIERRE -->
        <div class="slide slide-dark slide-cierre" id="slide${closeSlideNum}">
            <img src="logo-la-real.png" alt="LA REAL" style="width:80px;margin-bottom:40px;opacity:0.9;">
            <h1>${formatTitle(c.titulo_cierre) || `¿Listos para <span class="highlight">crecer</span>?`}</h1>
            <p class="subtitle" style="font-size:20px;margin-top:10px;">Hablemos de tu proyecto</p>
            <div class="hero-pills" style="margin-top:50px;">
                <a href="https://wa.me/573043148428" target="_blank" class="hero-pill" style="animation-delay:0.4s;font-size:17px;padding:14px 28px;text-decoration:none;cursor:pointer;">
                    Escríbele a Juanfe
                </a>
            </div>
        </div>

        <div class="navigation">
            <button class="nav-btn" onclick="prevSlide()">&#8592;</button>
            <button class="nav-btn" onclick="nextSlide()">&#8594;</button>
        </div>
    </div>
    <script>
        let currentSlide = 1;
        const totalSlides = ${total};
        function showSlide(n) {
            document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
            const slide = document.getElementById('slide'+n);
            if (!slide) return;
            slide.classList.add('active');
            document.getElementById('slideCounter').textContent = n+' / '+totalSlides;
            document.getElementById('progress').style.width = (n/totalSlides*100)+'%';
            const isLight = slide.classList.contains('slide-light');
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
                btn.style.borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
                btn.style.color = isLight ? '#374151' : '#fff';
            });
            document.getElementById('slideCounter').style.color = isLight ? '#9ca3af' : '#64748B';
            document.getElementById('progress').style.background = isLight ? '#0D1B2A' : '#4ADE80';
        }
        function nextSlide() { if (currentSlide < totalSlides) { currentSlide++; showSlide(currentSlide); } }
        function prevSlide() { if (currentSlide > 1) { currentSlide--; showSlide(currentSlide); } }
        document.addEventListener('keydown', e => {
            if (e.key==='ArrowRight'||e.key===' '||e.key==='Enter') { e.preventDefault(); nextSlide(); }
            else if (e.key==='ArrowLeft') { e.preventDefault(); prevSlide(); }
        });
        document.querySelector('.presentation').addEventListener('click', e => {
            if (!e.target.closest('.navigation')&&!e.target.closest('a')) nextSlide();
        });
        showSlide(1);
    </script>
</body>
</html>`;
}

// Deploy proposal to GitHub Pages
router.post('/proposals/deploy', async (req, res) => {
  try {
    const { html, repo_name, deal_id } = req.body;
    if (!html || !repo_name) return res.status(400).json({ error: 'html y repo_name son requeridos' });

    // Sanitize repo name
    const safeName = repo_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const tmpDir = `/tmp/proposal-${safeName}-${Date.now()}`;

    // Create temp directory and write files
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'index.html'), html);

    // Copy logo if it exists
    try {
      await fs.copyFile(
        '/Users/realjuanfe/plantillas-presentaciones/la-real/logo-la-real.png',
        path.join(tmpDir, 'logo-la-real.png')
      );
    } catch { /* logo not found, skip */ }

    // Git init and push
    execSync(`cd "${tmpDir}" && git init && git add -A && git commit -m "Propuesta generada por AgenciaPRO"`, { stdio: 'pipe' });
    execSync(`cd "${tmpDir}" && gh repo create juanfelareal/${safeName} --public --source=. --push`, { stdio: 'pipe' });

    // Enable GitHub Pages
    try {
      execSync(`gh api repos/juanfelareal/${safeName}/pages -X POST -f build_type=legacy -f source[branch]=main -f "source[path]=/"`, { stdio: 'pipe' });
    } catch { /* Pages might already be enabled */ }

    const pagesUrl = `https://juanfelareal.github.io/${safeName}/`;

    // Create proposal_sent activity on deal
    if (deal_id) {
      await db.run(`
        INSERT INTO crm_activities (deal_id, type, title, content, metadata, created_by, organization_id)
        VALUES (?, 'proposal_sent', 'Propuesta publicada', ?, ?, ?, ?)
      `, [
        deal_id,
        `Propuesta publicada en ${pagesUrl}`,
        JSON.stringify({ url: pagesUrl, repo: safeName }),
        req.teamMember.id,
        req.orgId
      ]);
    }

    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true });

    res.json({ url: pagesUrl, repo: `juanfelareal/${safeName}` });
  } catch (error) {
    console.error('Error deploying proposal:', error);
    res.status(500).json({ error: 'Error publicando propuesta: ' + error.message });
  }
});

export default router;
