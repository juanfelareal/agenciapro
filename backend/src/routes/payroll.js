import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import db from '../config/database.js';

const router = express.Router();

// Configure multer for PDF uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for multi-page PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/payroll/upload
 * Uploads and parses an Aleluya payroll PDF
 */
router.post('/upload', upload.single('pdf'), async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo PDF' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurado' });
    }

    // Convert PDF to base64
    const pdfBase64 = req.file.buffer.toString('base64');

    // Use Claude to analyze the payroll PDF
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `Analiza este documento de nómina de Aleluya (Colombia) y extrae la información de TODOS los empleados.
El documento tiene una página por empleado con la siguiente estructura típica:
- Encabezado: Empresa, Fecha de pago, Periodo de liquidación
- Datos del empleado: Nombre, Identificación, Cargo, Salario base, Días laborados
- Devengados: Salario, Transporte, Prestaciones Sociales, Bonificaciones, Auxilios
- Deducciones: Seguridad Social, Retención en la Fuente
- Total pagado

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
{
  "empresa": "Nombre de la empresa",
  "fecha_pago": "YYYY-MM-DD",
  "periodo": "Descripción del periodo (ej: 'Junio 2026')",
  "year": 2026,
  "month": 6,
  "empleados": [
    {
      "nombre": "Nombre completo",
      "identificacion": "número de cédula",
      "cargo": "Cargo del empleado",
      "salario_base": 0,
      "dias_laborados": 30,
      "devengados": {
        "salario": 0,
        "transporte": 0,
        "prestaciones_sociales": 0,
        "bonificaciones": 0,
        "auxilios": 0,
        "otros": 0
      },
      "deducciones": {
        "seguridad_social": 0,
        "retencion_fuente": 0,
        "otros": 0
      },
      "total_devengados": 0,
      "total_deducciones": 0,
      "total_pagado": 0
    }
  ],
  "totales": {
    "total_devengados": 0,
    "total_deducciones": 0,
    "total_neto": 0
  }
}

Nota: Todos los valores monetarios deben ser números (sin puntos ni comas de formato), no strings.`
            }
          ]
        }
      ]
    });

    // Parse the response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent) {
      return res.status(500).json({ error: 'No se pudo analizar el PDF' });
    }

    let payrollData;
    try {
      // Clean the response (remove potential markdown formatting)
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      payrollData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing payroll JSON:', parseError);
      console.error('Raw response:', textContent.text);
      return res.status(500).json({
        error: 'Error parseando datos de nómina',
        details: parseError.message,
        raw: textContent.text.substring(0, 500)
      });
    }

    // Validate required fields
    if (!payrollData.year || !payrollData.month || !payrollData.empleados) {
      return res.status(400).json({
        error: 'Datos de nómina incompletos',
        data: payrollData
      });
    }

    // Check if period already exists
    const existingPeriod = await pool.query(
      'SELECT id FROM payroll_periods WHERE organization_id = $1 AND year = $2 AND month = $3',
      [orgId, payrollData.year, payrollData.month]
    );

    if (existingPeriod.rows.length > 0) {
      // Delete existing data to replace with new upload
      await pool.query('DELETE FROM payroll_periods WHERE id = $1', [existingPeriod.rows[0].id]);
    }

    // Insert payroll period
    const periodResult = await pool.query(`
      INSERT INTO payroll_periods (
        organization_id, year, month, period_name, payment_date, source,
        total_devengados, total_deducciones, total_neto, employee_count, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      orgId,
      payrollData.year,
      payrollData.month,
      payrollData.periodo || `${payrollData.month}/${payrollData.year}`,
      payrollData.fecha_pago || null,
      'aleluya',
      payrollData.totales?.total_devengados || 0,
      payrollData.totales?.total_deducciones || 0,
      payrollData.totales?.total_neto || 0,
      payrollData.empleados.length,
      JSON.stringify(payrollData)
    ]);

    const periodId = periodResult.rows[0].id;

    // Insert employees
    for (const emp of payrollData.empleados) {
      await pool.query(`
        INSERT INTO payroll_employees (
          payroll_period_id, nombre, identificacion, cargo, salario_base, dias_laborados,
          dev_salario, dev_transporte, dev_prestaciones_sociales, dev_bonificaciones, dev_auxilios, dev_otros,
          total_devengados, ded_seguridad_social, ded_retencion_fuente, ded_otros, total_deducciones, total_pagado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        periodId,
        emp.nombre,
        emp.identificacion,
        emp.cargo,
        emp.salario_base || 0,
        emp.dias_laborados || 0,
        emp.devengados?.salario || 0,
        emp.devengados?.transporte || 0,
        emp.devengados?.prestaciones_sociales || 0,
        emp.devengados?.bonificaciones || 0,
        emp.devengados?.auxilios || 0,
        emp.devengados?.otros || 0,
        emp.total_devengados || 0,
        emp.deducciones?.seguridad_social || 0,
        emp.deducciones?.retencion_fuente || 0,
        emp.deducciones?.otros || 0,
        emp.total_deducciones || 0,
        emp.total_pagado || 0
      ]);
    }

    res.json({
      success: true,
      message: `Nómina de ${payrollData.periodo} importada: ${payrollData.empleados.length} empleados`,
      periodId,
      data: {
        year: payrollData.year,
        month: payrollData.month,
        periodo: payrollData.periodo,
        employeeCount: payrollData.empleados.length,
        totals: payrollData.totales
      }
    });

  } catch (error) {
    console.error('Error uploading payroll:', error);
    res.status(500).json({ error: error.message || 'Error procesando nómina' });
  }
});

/**
 * GET /api/payroll/periods
 * Get all payroll periods for the organization
 */
router.get('/periods', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    const result = await pool.query(`
      SELECT id, year, month, period_name, payment_date, source,
             total_devengados, total_deducciones, total_neto, employee_count,
             created_at, updated_at
      FROM payroll_periods
      WHERE organization_id = $1
      ORDER BY year DESC, month DESC
    `, [orgId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payroll periods:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payroll/periods/:id
 * Get a specific payroll period with all employees
 */
router.get('/periods/:id', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;
  const { id } = req.params;

  try {
    const periodResult = await pool.query(`
      SELECT * FROM payroll_periods
      WHERE id = $1 AND organization_id = $2
    `, [id, orgId]);

    if (periodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    const employeesResult = await pool.query(`
      SELECT * FROM payroll_employees
      WHERE payroll_period_id = $1
      ORDER BY nombre ASC
    `, [id]);

    res.json({
      ...periodResult.rows[0],
      employees: employeesResult.rows
    });
  } catch (error) {
    console.error('Error fetching payroll period:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payroll/current
 * Get the most recent payroll period
 */
router.get('/current', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    const periodResult = await pool.query(`
      SELECT * FROM payroll_periods
      WHERE organization_id = $1
      ORDER BY year DESC, month DESC
      LIMIT 1
    `, [orgId]);

    if (periodResult.rows.length === 0) {
      return res.json(null);
    }

    const period = periodResult.rows[0];

    const employeesResult = await pool.query(`
      SELECT * FROM payroll_employees
      WHERE payroll_period_id = $1
      ORDER BY nombre ASC
    `, [period.id]);

    res.json({
      ...period,
      employees: employeesResult.rows
    });
  } catch (error) {
    console.error('Error fetching current payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/payroll/periods/:id
 * Delete a payroll period (cascades to employees)
 */
router.delete('/periods/:id', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;
  const { id } = req.params;

  try {
    const result = await pool.query(`
      DELETE FROM payroll_periods
      WHERE id = $1 AND organization_id = $2
      RETURNING id
    `, [id, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    res.json({ success: true, message: 'Periodo eliminado' });
  } catch (error) {
    console.error('Error deleting payroll period:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
