import express from 'express';
import db from '../config/database.js';
import axios from 'axios';
import { createRecurringInvoice } from '../utils/recurringInvoices.js';

const router = express.Router();

// Get all clients (org-scoped)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM clients WHERE organization_id = ?';
    const params = [req.orgId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const clients = await db.prepare(query).all(...params);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get client by ID (org-scoped)
router.get('/:id', async (req, res) => {
  try {
    const client = await db.prepare('SELECT * FROM clients WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search company by NIT (Colombia)
router.get('/search-nit/:nit', async (req, res) => {
  try {
    let nit = req.params.nit;

    // Limpiar NIT (remover guiones, puntos y espacios)
    nit = nit.replace(/[^0-9]/g, '');

    // Validar formato básico
    if (!nit || nit.length < 9) {
      return res.status(400).json({
        error: 'NIT inválido. Debe tener al menos 9 dígitos',
        nit: nit
      });
    }

    // Método 1: Intentar con API Colombia (requiere API key, pero intentamos)
    try {
      const apiColombiaUrl = `https://api-colombia.com/api/v1/Company/nit/${nit}`;

      const response = await axios.get(apiColombiaUrl, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.data) {
        return res.json({
          success: true,
          nit: nit,
          name: response.data.razonSocial || response.data.nombre || '',
          company: response.data.razonSocial || response.data.nombre || '',
          email: response.data.correoElectronico || response.data.email || '',
          phone: response.data.telefono || response.data.phone || '',
          address: response.data.direccion || response.data.address || '',
          source: 'API Colombia'
        });
      }
    } catch (apiError) {
      console.log('API Colombia error:', apiError.message);
    }

    // Método 2: Intentar con API pública del RUES (si está disponible)
    try {
      // Consulta RUES pública (Cámaras de Comercio)
      const ruesUrl = `https://www.rues.org.co/RM/consultas?nit=${nit}`;

      const ruesResponse = await axios.get(ruesUrl, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Si hay respuesta válida, procesarla
      if (ruesResponse.data && ruesResponse.data.razonSocial) {
        return res.json({
          success: true,
          nit: nit,
          name: ruesResponse.data.razonSocial,
          company: ruesResponse.data.razonSocial,
          email: '',
          phone: '',
          address: ruesResponse.data.direccion || '',
          source: 'RUES'
        });
      }
    } catch (ruesError) {
      console.log('RUES API error:', ruesError.message);
    }

    // Método 3: Datos de demostración con NITs conocidos
    const nitsDemoPorDefecto = {
      '860028363': {
        name: 'ALMACENES ÉXITO S.A.',
        company: 'ALMACENES ÉXITO S.A.',
        email: 'contacto@exito.com.co',
        phone: '+57 1 7956060',
        address: 'Carrera 48 No. 32B Sur 139, Envigado, Antioquia'
      },
      '890900608': {
        name: 'RAPPI S.A.S',
        company: 'RAPPI S.A.S',
        email: 'soporte@rappi.com',
        phone: '+57 1 5803000',
        address: 'Carrera 7 No. 71-52, Bogotá'
      },
      '8000521000': {
        name: 'BANCOLOMBIA S.A.',
        company: 'BANCOLOMBIA S.A.',
        email: 'contacto@bancolombia.com.co',
        phone: '+57 4 5945555',
        address: 'Carrera 48 No. 26-85, Medellín'
      },
      '860034313': {
        name: 'TERPEL S.A.',
        company: 'ORGANIZACION TERPEL S.A.',
        email: 'servicio@terpel.com',
        phone: '+57 1 4233000',
        address: 'Calle 93A No. 16-31, Bogotá'
      }
    };

    // Buscar NIT base (primeros 9 dígitos)
    const nitBase = nit.substring(0, 9);

    if (nitsDemoPorDefecto[nitBase] || nitsDemoPorDefecto[nit]) {
      const data = nitsDemoPorDefecto[nitBase] || nitsDemoPorDefecto[nit];
      return res.json({
        success: true,
        nit: nit,
        ...data,
        source: 'Demo Data'
      });
    }

    // Si no se encontró en ninguna fuente, retornar error informativo
    res.status(404).json({
      error: `No se encontró información para el NIT ${nit}. Intenta con: 860028363, 890900608, 8000521000, o 860034313 para ver ejemplos, o configura una API key en el archivo .env`,
      nit: nit,
      suggestion: 'Para búsquedas reales, registra una cuenta gratuita en https://api-colombia.com y agrega la API key en el archivo .env'
    });

  } catch (error) {
    console.error('Error en búsqueda de NIT:', error);
    res.status(500).json({
      error: 'Error interno del servidor al buscar NIT',
      details: error.message
    });
  }
});

// Create new client
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, nit, status, contract_value, contract_start_date, contract_end_date, notes, is_recurring, billing_day, recurring_amount, siigo_id } = req.body;

    if (!company) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Validate recurring billing fields
    if (is_recurring) {
      if (!billing_day || billing_day < 1 || billing_day > 28) {
        return res.status(400).json({ error: 'Billing day must be between 1 and 28' });
      }
      if (!recurring_amount || recurring_amount <= 0) {
        return res.status(400).json({ error: 'Recurring amount must be greater than 0' });
      }
    }

    const result = await db.prepare(`
      INSERT INTO clients (name, email, phone, company, nit, status, contract_value, contract_start_date, contract_end_date, notes, is_recurring, billing_day, recurring_amount, siigo_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, company, nit, status || 'active', contract_value || 0, contract_start_date, contract_end_date, notes, is_recurring ? 1 : 0, billing_day, recurring_amount || 0, siigo_id || null, req.orgId);

    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);

    // Create first recurring invoice if applicable
    if (client.is_recurring && client.status === 'active') {
      const invoiceId = createRecurringInvoice(client);
      if (invoiceId) {
        console.log(`✅ Created recurring invoice #${invoiceId} for client ${client.company}`);
      }
    }

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client (supports partial updates for bulk operations)
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, company, nit, status, contract_value, contract_start_date, contract_end_date, notes, is_recurring, billing_day, recurring_amount } = req.body;

    // Get current client to preserve existing values for partial updates (org-scoped)
    const currentClient = await db.prepare('SELECT * FROM clients WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!currentClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Use provided values or keep existing ones (for partial updates / bulk operations)
    const updatedName = name !== undefined ? name : currentClient.name;
    const updatedEmail = email !== undefined ? email : currentClient.email;
    const updatedPhone = phone !== undefined ? phone : currentClient.phone;
    const updatedCompany = company !== undefined ? company : currentClient.company;
    const updatedNit = nit !== undefined ? nit : currentClient.nit;
    const updatedStatus = status !== undefined ? status : currentClient.status;
    const updatedContractValue = contract_value !== undefined ? contract_value : currentClient.contract_value;
    const updatedContractStartDate = contract_start_date !== undefined ? contract_start_date : currentClient.contract_start_date;
    const updatedContractEndDate = contract_end_date !== undefined ? contract_end_date : currentClient.contract_end_date;
    const updatedNotes = notes !== undefined ? notes : currentClient.notes;
    const updatedIsRecurring = is_recurring !== undefined ? (is_recurring ? 1 : 0) : currentClient.is_recurring;
    const updatedBillingDay = billing_day !== undefined ? billing_day : currentClient.billing_day;
    const updatedRecurringAmount = recurring_amount !== undefined ? recurring_amount : currentClient.recurring_amount;

    // Validate recurring billing fields only if recurring is being enabled
    if (updatedIsRecurring) {
      if (!updatedBillingDay || updatedBillingDay < 1 || updatedBillingDay > 28) {
        return res.status(400).json({ error: 'Billing day must be between 1 and 28' });
      }
      if (!updatedRecurringAmount || updatedRecurringAmount <= 0) {
        return res.status(400).json({ error: 'Recurring amount must be greater than 0' });
      }
    }

    await db.prepare(`
      UPDATE clients
      SET name = ?, email = ?, phone = ?, company = ?, nit = ?, status = ?,
          contract_value = ?, contract_start_date = ?, contract_end_date = ?,
          notes = ?, is_recurring = ?, billing_day = ?, recurring_amount = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(updatedName, updatedEmail, updatedPhone, updatedCompany, updatedNit, updatedStatus,
           updatedContractValue, updatedContractStartDate, updatedContractEndDate,
           updatedNotes, updatedIsRecurring, updatedBillingDay, updatedRecurringAmount || 0, req.params.id, req.orgId);

    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);

    // If recurring billing was just activated and client is active, create first invoice
    if (client.is_recurring && client.status === 'active' && !currentClient.is_recurring) {
      const invoiceId = createRecurringInvoice(client);
      if (invoiceId) {
        console.log(`✅ Created recurring invoice #${invoiceId} for client ${client.company}`);
      }
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client (org-scoped)
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM clients WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
