import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ─── Helpers ───
const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const verifyClient = async (clientId, orgId) => {
  const client = await db.get('SELECT id FROM clients WHERE id = $1 AND organization_id = $2', [clientId, orgId]);
  return !!client;
};

// ─── Client visibility ───

// Toggle hide client from general metrics
router.put('/clients/:clientId/hide', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { is_hidden } = req.body;
    await db.run(
      'UPDATE clients SET is_hidden_from_metrics = $1 WHERE id = $2 AND organization_id = $3',
      [is_hidden ? 1 : 0, clientId, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling client visibility:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set client service type (growth / fee / null)
router.put('/clients/:clientId/service-type', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { service_type } = req.body;
    await db.run(
      'UPDATE clients SET service_type = $1 WHERE id = $2 AND organization_id = $3',
      [service_type || null, clientId, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting service type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get growth clients with metrics summary
router.get('/clients', async (req, res) => {
  try {
    const clients = await db.all(`
      SELECT c.id, c.name, c.nickname, c.company, c.service_type, c.is_hidden_from_metrics
      FROM clients c
      WHERE c.organization_id = $1 AND c.service_type = 'growth' AND c.status != 'inactive'
      ORDER BY c.nickname ASC, c.name ASC
    `, [req.orgId]);
    res.json(clients);
  } catch (error) {
    console.error('Error getting growth clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all client data for a period (objectives + palancas + milestones + banderas)
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = req.query.period || getCurrentPeriod();
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const [objectives, palancas, milestones, banderas] = await Promise.all([
      db.all('SELECT * FROM growth_objectives WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_palancas WHERE client_id = $1 AND period = $2 AND organization_id = $3 ORDER BY rank ASC', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_milestones WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_banderas WHERE client_id = $1 AND period = $2 AND organization_id = $3 AND is_active = 1', [clientId, period, req.orgId]),
    ]);

    res.json({ objectives, palancas, milestones, banderas });
  } catch (error) {
    console.error('Error getting growth data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Objectives CRUD ───

router.post('/:clientId/objectives', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, metric, conservador, base, optimista } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    // Upsert: delete existing + insert
    await db.run('DELETE FROM growth_objectives WHERE client_id = $1 AND period = $2 AND metric = $3 AND organization_id = $4', [clientId, period, metric, req.orgId]);
    const result = await db.run(`
      INSERT INTO growth_objectives (client_id, period, metric, conservador, base, optimista, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, period, metric, conservador || 0, base || 0, optimista || 0, req.orgId]);

    res.json({ id: result.lastID, client_id: clientId, period, metric, conservador, base, optimista });
  } catch (error) {
    console.error('Error creating objective:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/objectives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { conservador, base, optimista } = req.body;
    await db.run(
      'UPDATE growth_objectives SET conservador = $1, base = $2, optimista = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND organization_id = $5',
      [conservador, base, optimista, id, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating objective:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Palancas CRUD ───

router.post('/:clientId/palancas', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, rank, nombre, estado, kpi_label, kpi_valor, impacto } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_palancas (client_id, period, rank, nombre, estado, kpi_label, kpi_valor, impacto, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [clientId, period || getCurrentPeriod(), rank || 1, nombre, estado, kpi_label, kpi_valor, impacto || 'medio', req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating palanca:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/palancas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rank, nombre, estado, kpi_label, kpi_valor, impacto } = req.body;
    await db.run(`
      UPDATE growth_palancas SET rank = $1, nombre = $2, estado = $3, kpi_label = $4, kpi_valor = $5, impacto = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND organization_id = $8
    `, [rank, nombre, estado, kpi_label, kpi_valor, impacto, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating palanca:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/palancas/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_palancas WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Milestones CRUD ───

router.post('/:clientId/milestones', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, nombre, meta, status, responsable } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_milestones (client_id, period, nombre, meta, status, responsable, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, period || getCurrentPeriod(), nombre, meta, status || 'pending', responsable || 'lareal', req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/milestones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, meta, status, responsable } = req.body;
    await db.run(`
      UPDATE growth_milestones SET nombre = $1, meta = $2, status = $3, responsable = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND organization_id = $6
    `, [nombre, meta, status, responsable, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/milestones/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_milestones WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Banderas CRUD ───

router.post('/:clientId/banderas', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, nivel, titulo, descripcion } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_banderas (client_id, period, nivel, titulo, descripcion, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [clientId, period || getCurrentPeriod(), nivel || 'media', titulo, descripcion, req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating bandera:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/banderas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nivel, titulo, descripcion, is_active } = req.body;
    await db.run(`
      UPDATE growth_banderas SET nivel = $1, titulo = $2, descripcion = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND organization_id = $6
    `, [nivel, titulo, descripcion, is_active ?? 1, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/banderas/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_banderas WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
