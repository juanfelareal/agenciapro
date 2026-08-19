import express from 'express';
import multer from 'multer';
import db from '../config/database.js';

const router = express.Router();

// Configure multer for CSV uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'), false);
    }
  }
});

/**
 * Parse Bancolombia CSV format
 * Typical Bancolombia CSV columns:
 * Fecha, Descripción, Referencia, Documento, Oficina, Débito, Crédito, Saldo
 */
function parseBancolombiaCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('El archivo CSV está vacío o no tiene datos');
  }

  // Try to detect header row - Bancolombia CSVs may have metadata rows before headers
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('fecha') && (line.includes('descripción') || line.includes('descripcion'))) {
      headerIndex = i;
      break;
    }
  }

  const headerLine = lines[headerIndex];
  const separator = headerLine.includes(';') ? ';' : ',';

  const headers = headerLine.split(separator).map(h =>
    h.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/"/g, '')
  );

  // Map headers to expected fields
  const columnMap = {
    fecha: headers.findIndex(h => h.includes('fecha')),
    descripcion: headers.findIndex(h => h.includes('descripcion')),
    referencia: headers.findIndex(h => h.includes('referencia') || h.includes('ref')),
    documento: headers.findIndex(h => h.includes('documento') || h.includes('doc')),
    oficina: headers.findIndex(h => h.includes('oficina') || h.includes('sucursal')),
    debito: headers.findIndex(h => h.includes('debito') || h.includes('debitos') || h.includes('cargo')),
    credito: headers.findIndex(h => h.includes('credito') || h.includes('creditos') || h.includes('abono')),
    saldo: headers.findIndex(h => h.includes('saldo') || h.includes('balance'))
  };

  if (columnMap.fecha === -1) {
    throw new Error('No se encontró la columna de Fecha en el CSV');
  }

  const transactions = [];
  let minDate = null;
  let maxDate = null;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV values
    const values = parseCSVLine(line, separator);

    const dateStr = values[columnMap.fecha]?.trim();
    if (!dateStr) continue;

    // Parse date (Bancolombia format: DD/MM/YYYY or DD-MM-YYYY)
    const dateParts = dateStr.split(/[\/\-]/);
    if (dateParts.length !== 3) continue;

    let transactionDate;
    // Try DD/MM/YYYY format (Colombian standard)
    if (dateParts[0].length <= 2) {
      transactionDate = new Date(
        parseInt(dateParts[2]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[0])
      );
    } else {
      // YYYY-MM-DD format
      transactionDate = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
    }

    if (isNaN(transactionDate.getTime())) continue;

    if (!minDate || transactionDate < minDate) minDate = transactionDate;
    if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

    const debit = parseColombianNumber(values[columnMap.debito]) || 0;
    const credit = parseColombianNumber(values[columnMap.credito]) || 0;
    const balance = parseColombianNumber(values[columnMap.saldo]) || 0;

    transactions.push({
      transaction_date: transactionDate.toISOString().split('T')[0],
      description: values[columnMap.descripcion]?.trim() || '',
      reference: columnMap.referencia >= 0 ? values[columnMap.referencia]?.trim() || '' : '',
      doc_number: columnMap.documento >= 0 ? values[columnMap.documento]?.trim() || '' : '',
      office: columnMap.oficina >= 0 ? values[columnMap.oficina]?.trim() || '' : '',
      debit,
      credit,
      balance
    });
  }

  if (transactions.length === 0) {
    throw new Error('No se encontraron transacciones válidas en el CSV');
  }

  // Calculate totals
  const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);
  const openingBalance = transactions[0].balance + transactions[0].debit - transactions[0].credit;
  const closingBalance = transactions[transactions.length - 1].balance;

  // Determine year and month from the majority of transactions
  const yearMonth = {};
  transactions.forEach(t => {
    const [year, month] = t.transaction_date.split('-');
    const key = `${year}-${month}`;
    yearMonth[key] = (yearMonth[key] || 0) + 1;
  });

  const dominantPeriod = Object.entries(yearMonth).sort((a, b) => b[1] - a[1])[0][0];
  const [year, month] = dominantPeriod.split('-').map(Number);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return {
    year,
    month,
    period_name: `${monthNames[month - 1]} ${year}`,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    total_credits: totalCredits,
    total_debits: totalDebits,
    transactions
  };
}

/**
 * Parse a CSV line handling quoted values with commas
 */
function parseCSVLine(line, separator) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      values.push(current.replace(/^"|"$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.replace(/^"|"$/g, '').trim());
  return values;
}

/**
 * Parse Colombian number format (1.234.567,89 or 1234567.89)
 */
function parseColombianNumber(str) {
  if (!str) return 0;

  // Remove any quotes and trim
  str = str.replace(/"/g, '').trim();

  // If empty or not a number, return 0
  if (!str || str === '-' || str === '') return 0;

  // Check if it's Colombian format (uses . as thousands separator and , as decimal)
  if (str.includes('.') && str.includes(',')) {
    // Colombian format: 1.234.567,89
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',') && !str.includes('.')) {
    // Could be Colombian decimal: 1234,89
    str = str.replace(',', '.');
  }
  // Otherwise assume US format or plain number

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * POST /api/bank-statements/upload
 * Uploads and parses a Bancolombia CSV bank statement
 */
router.post('/upload', upload.single('csv'), async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo CSV' });
    }

    // Parse CSV content
    const csvContent = req.file.buffer.toString('utf-8');
    const statementData = parseBancolombiaCSV(csvContent);

    // Get account number from request or use default
    const accountNumber = req.body.account_number || 'default';

    // Check if period already exists
    const existingPeriod = await pool.query(
      `SELECT id FROM bank_statement_periods
       WHERE organization_id = $1 AND account_number = $2 AND year = $3 AND month = $4`,
      [orgId, accountNumber, statementData.year, statementData.month]
    );

    if (existingPeriod.rows.length > 0) {
      // Delete existing data to replace with new upload
      await pool.query('DELETE FROM bank_statement_periods WHERE id = $1', [existingPeriod.rows[0].id]);
    }

    // Insert statement period
    const periodResult = await pool.query(`
      INSERT INTO bank_statement_periods (
        organization_id, bank_name, account_number, year, month, period_name,
        opening_balance, closing_balance, total_credits, total_debits,
        transaction_count, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      orgId,
      'Bancolombia',
      accountNumber,
      statementData.year,
      statementData.month,
      statementData.period_name,
      statementData.opening_balance,
      statementData.closing_balance,
      statementData.total_credits,
      statementData.total_debits,
      statementData.transactions.length,
      JSON.stringify(statementData)
    ]);

    const periodId = periodResult.rows[0].id;

    // Insert transactions
    for (const txn of statementData.transactions) {
      await pool.query(`
        INSERT INTO bank_transactions (
          statement_period_id, transaction_date, description, reference,
          doc_number, office, debit, credit, balance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        periodId,
        txn.transaction_date,
        txn.description,
        txn.reference,
        txn.doc_number,
        txn.office,
        txn.debit,
        txn.credit,
        txn.balance
      ]);
    }

    res.json({
      success: true,
      message: `Extracto de ${statementData.period_name} importado: ${statementData.transactions.length} transacciones`,
      periodId,
      data: {
        year: statementData.year,
        month: statementData.month,
        periodo: statementData.period_name,
        transactionCount: statementData.transactions.length,
        openingBalance: statementData.opening_balance,
        closingBalance: statementData.closing_balance,
        totalCredits: statementData.total_credits,
        totalDebits: statementData.total_debits
      }
    });

  } catch (error) {
    console.error('Error uploading bank statement:', error);
    res.status(500).json({ error: error.message || 'Error procesando extracto' });
  }
});

/**
 * GET /api/bank-statements/periods
 * Get all bank statement periods for the organization
 */
router.get('/periods', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    const result = await pool.query(`
      SELECT id, bank_name, account_number, year, month, period_name,
             opening_balance, closing_balance, total_credits, total_debits,
             transaction_count, created_at, updated_at
      FROM bank_statement_periods
      WHERE organization_id = $1
      ORDER BY year DESC, month DESC
    `, [orgId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bank statement periods:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bank-statements/periods/:id
 * Get a specific bank statement period with all transactions
 */
router.get('/periods/:id', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;
  const { id } = req.params;

  try {
    const periodResult = await pool.query(`
      SELECT * FROM bank_statement_periods
      WHERE id = $1 AND organization_id = $2
    `, [id, orgId]);

    if (periodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    const transactionsResult = await pool.query(`
      SELECT * FROM bank_transactions
      WHERE statement_period_id = $1
      ORDER BY transaction_date ASC, id ASC
    `, [id]);

    res.json({
      ...periodResult.rows[0],
      transactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching bank statement period:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bank-statements/current
 * Get the most recent bank statement period
 */
router.get('/current', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    const periodResult = await pool.query(`
      SELECT * FROM bank_statement_periods
      WHERE organization_id = $1
      ORDER BY year DESC, month DESC
      LIMIT 1
    `, [orgId]);

    if (periodResult.rows.length === 0) {
      return res.json(null);
    }

    const period = periodResult.rows[0];

    const transactionsResult = await pool.query(`
      SELECT * FROM bank_transactions
      WHERE statement_period_id = $1
      ORDER BY transaction_date ASC, id ASC
    `, [period.id]);

    res.json({
      ...period,
      transactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching current bank statement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bank-statements/summary
 * Get summary of all bank transactions for a date range
 */
router.get('/summary', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;
  const { start, end } = req.query;

  try {
    let query = `
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(bt.credit), 0) as total_credits,
        COALESCE(SUM(bt.debit), 0) as total_debits
      FROM bank_transactions bt
      JOIN bank_statement_periods bsp ON bt.statement_period_id = bsp.id
      WHERE bsp.organization_id = $1
    `;
    const params = [orgId];

    if (start && end) {
      query += ` AND bt.transaction_date BETWEEN $2 AND $3`;
      params.push(start, end);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching bank summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/bank-statements/periods/:id
 * Delete a bank statement period (cascades to transactions)
 */
router.delete('/periods/:id', async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;
  const { id } = req.params;

  try {
    const result = await pool.query(`
      DELETE FROM bank_statement_periods
      WHERE id = $1 AND organization_id = $2
      RETURNING id
    `, [id, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    res.json({ success: true, message: 'Extracto eliminado' });
  } catch (error) {
    console.error('Error deleting bank statement period:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
