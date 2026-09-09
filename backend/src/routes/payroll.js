import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import * as XLSX from 'xlsx';
import db from '../config/database.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();

// Allowed MIME types for payroll files
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

// Configure multer for PDF and XLSX uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o Excel (.xlsx)'), false);
    }
  }
});

/**
 * Parse Colombian currency format
 * Handles: $1.234.567,89 or 1.234.567,89 or 1234567.89
 */
function parseColombianMoney(str) {
  if (!str) return 0;
  // Remove $ and spaces
  str = str.replace(/\$|\s/g, '').trim();
  if (!str || str === '-') return 0;

  // Colombian format: 1.234.567,89
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse Aleluya payroll PDF text
 * Extracts employee data from each page
 */
function parseAleluyaPDF(text) {
  // Split by page markers or employee sections
  const pages = text.split(/(?=NOMINA INDIVIDUAL|COLILLA DE PAGO|COMPROBANTE DE NÓMINA)/i);

  const employees = [];
  let empresa = '';
  let fechaPago = '';
  let periodo = '';
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  // Try to extract company name and period from first page
  const empresaMatch = text.match(/(?:EMPRESA|RAZÓN SOCIAL|EMPLEADOR)[:\s]*([^\n]+)/i);
  if (empresaMatch) {
    empresa = empresaMatch[1].trim();
  }

  // Try to extract period - look for month names
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const periodoMatch = text.match(/(?:PERIODO|PERÍODO|MES)[:\s]*([^\n]+)/i) ||
                       text.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?(\d{4})/i);

  if (periodoMatch) {
    periodo = periodoMatch[1].trim();
    // Try to extract year
    const yearMatch = periodo.match(/(\d{4})/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
    }
    // Try to extract month
    for (let i = 0; i < monthNames.length; i++) {
      if (periodo.toLowerCase().includes(monthNames[i])) {
        month = i + 1;
        break;
      }
    }
  }

  // Try to extract payment date
  const fechaMatch = text.match(/(?:FECHA DE PAGO|FECHA PAGO)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (fechaMatch) {
    fechaPago = fechaMatch[1];
  }

  // Process each page/section for employee data
  for (const page of pages) {
    if (page.trim().length < 100) continue; // Skip empty pages

    const employee = extractEmployeeData(page);
    if (employee && employee.nombre) {
      employees.push(employee);
    }
  }

  // If no employees found with page splitting, try to parse as single employee
  if (employees.length === 0) {
    const employee = extractEmployeeData(text);
    if (employee && employee.nombre) {
      employees.push(employee);
    }
  }

  // Calculate totals
  const totales = {
    total_devengados: employees.reduce((sum, e) => sum + (e.total_devengados || 0), 0),
    total_deducciones: employees.reduce((sum, e) => sum + (e.total_deducciones || 0), 0),
    total_neto: employees.reduce((sum, e) => sum + (e.total_pagado || 0), 0),
  };

  // Generate period name
  const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return {
    empresa: empresa || 'LA REAL MARKETING SAS',
    fecha_pago: fechaPago || null,
    periodo: periodo || `${monthNamesEs[month - 1]} ${year}`,
    year,
    month,
    empleados: employees,
    totales,
  };
}

/**
 * Extract data for a single employee from text
 */
function extractEmployeeData(text) {
  const employee = {
    nombre: '',
    identificacion: '',
    cargo: '',
    salario_base: 0,
    dias_laborados: 30,
    devengados: {
      salario: 0,
      transporte: 0,
      prestaciones_sociales: 0,
      bonificaciones: 0,
      auxilios: 0,
      otros: 0,
    },
    deducciones: {
      seguridad_social: 0,
      retencion_fuente: 0,
      otros: 0,
    },
    total_devengados: 0,
    total_deducciones: 0,
    total_pagado: 0,
  };

  // Extract name - look for common patterns
  const nombrePatterns = [
    /(?:NOMBRE|EMPLEADO|TRABAJADOR)[:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|CEDULA|C\.?C\.?|IDENTIFICACIÓN)/i,
    /(?:^|\n)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{5,40})(?:\n)/m,
  ];

  for (const pattern of nombrePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out section headers
      if (!name.match(/DEVENGADOS|DEDUCCIONES|TOTAL|NETO|EMPRESA|NOMINA/i) && name.length > 3) {
        employee.nombre = name;
        break;
      }
    }
  }

  // Extract ID (cédula)
  const idMatch = text.match(/(?:CEDULA|C\.?C\.?|IDENTIFICACIÓN|DOCUMENTO)[:\s#]*(\d{5,12})/i);
  if (idMatch) {
    employee.identificacion = idMatch[1];
  }

  // Extract cargo
  const cargoMatch = text.match(/(?:CARGO|POSICIÓN|PUESTO)[:\s]*([^\n]+)/i);
  if (cargoMatch) {
    employee.cargo = cargoMatch[1].trim();
  }

  // Extract salario base
  const salarioMatch = text.match(/(?:SALARIO\s*(?:BASE|BÁSICO)?|SUELDO)[:\s]*\$?([\d\.,]+)/i);
  if (salarioMatch) {
    employee.salario_base = parseColombianMoney(salarioMatch[1]);
    employee.devengados.salario = employee.salario_base;
  }

  // Extract días laborados
  const diasMatch = text.match(/(?:DÍAS?\s*(?:LABORADOS?|TRABAJADOS?))[:\s]*(\d+)/i);
  if (diasMatch) {
    employee.dias_laborados = parseInt(diasMatch[1]) || 30;
  }

  // Extract devengados section values
  const transporteMatch = text.match(/(?:AUXILIO\s*)?(?:TRANSPORTE|TRANSP\.?)[:\s]*\$?([\d\.,]+)/i);
  if (transporteMatch) {
    employee.devengados.transporte = parseColombianMoney(transporteMatch[1]);
  }

  const bonificacionMatch = text.match(/(?:BONIFICACIÓN|BONIFICACION|BONO)[:\s]*\$?([\d\.,]+)/i);
  if (bonificacionMatch) {
    employee.devengados.bonificaciones = parseColombianMoney(bonificacionMatch[1]);
  }

  const auxiliosMatch = text.match(/(?:AUXILIOS?(?!\s*TRANSPORTE))[:\s]*\$?([\d\.,]+)/i);
  if (auxiliosMatch) {
    employee.devengados.auxilios = parseColombianMoney(auxiliosMatch[1]);
  }

  // Extract total devengados
  const totalDevMatch = text.match(/(?:TOTAL\s*DEVENGADOS?|DEVENGADO\s*TOTAL)[:\s]*\$?([\d\.,]+)/i);
  if (totalDevMatch) {
    employee.total_devengados = parseColombianMoney(totalDevMatch[1]);
  } else {
    // Calculate if not found
    employee.total_devengados =
      employee.devengados.salario +
      employee.devengados.transporte +
      employee.devengados.bonificaciones +
      employee.devengados.auxilios +
      employee.devengados.otros;
  }

  // Extract deducciones section values
  const saludMatch = text.match(/(?:SALUD|EPS)[:\s]*\$?([\d\.,]+)/i);
  const pensionMatch = text.match(/(?:PENSIÓN|PENSION|AFP)[:\s]*\$?([\d\.,]+)/i);
  const seguridadMatch = text.match(/(?:SEGURIDAD\s*SOCIAL)[:\s]*\$?([\d\.,]+)/i);

  if (seguridadMatch) {
    employee.deducciones.seguridad_social = parseColombianMoney(seguridadMatch[1]);
  } else if (saludMatch || pensionMatch) {
    const salud = saludMatch ? parseColombianMoney(saludMatch[1]) : 0;
    const pension = pensionMatch ? parseColombianMoney(pensionMatch[1]) : 0;
    employee.deducciones.seguridad_social = salud + pension;
  }

  const retencionMatch = text.match(/(?:RETENCIÓN|RETENCION)(?:\s*(?:EN\s*LA\s*)?FUENTE)?[:\s]*\$?([\d\.,]+)/i);
  if (retencionMatch) {
    employee.deducciones.retencion_fuente = parseColombianMoney(retencionMatch[1]);
  }

  // Extract total deducciones
  const totalDedMatch = text.match(/(?:TOTAL\s*DEDUCCIONES?|DEDUCCIONES?\s*TOTAL)[:\s]*\$?([\d\.,]+)/i);
  if (totalDedMatch) {
    employee.total_deducciones = parseColombianMoney(totalDedMatch[1]);
  } else {
    employee.total_deducciones =
      employee.deducciones.seguridad_social +
      employee.deducciones.retencion_fuente +
      employee.deducciones.otros;
  }

  // Extract neto a pagar
  const netoPatterns = [
    /(?:NETO\s*A?\s*PAGAR|TOTAL\s*A?\s*PAGAR|VALOR\s*NETO)[:\s]*\$?([\d\.,]+)/i,
    /(?:TOTAL\s*NETO)[:\s]*\$?([\d\.,]+)/i,
  ];

  for (const pattern of netoPatterns) {
    const match = text.match(pattern);
    if (match) {
      employee.total_pagado = parseColombianMoney(match[1]);
      break;
    }
  }

  // If total_pagado not found, calculate it
  if (employee.total_pagado === 0 && employee.total_devengados > 0) {
    employee.total_pagado = employee.total_devengados - employee.total_deducciones;
  }

  return employee;
}

/**
 * Parse Aleluya payroll XLSX file
 * Maps the 102-column Aleluya export format to our schema
 */
function parseAleluyaXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // Usually "Empleados"
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Row 1 (index 0): Period info - ["Desde", "01/09/2026", "Hasta", "15/09/2026", ...]
  const periodoRow = rows[0] || [];
  let fechaDesde = null;
  let fechaHasta = null;
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  let periodType = 'mensual'; // 'quincenal' or 'mensual'

  // Extract period dates
  for (let i = 0; i < periodoRow.length; i++) {
    const cell = String(periodoRow[i] || '').trim();
    if (cell.toLowerCase() === 'desde' && periodoRow[i + 1]) {
      fechaDesde = String(periodoRow[i + 1]).trim();
    }
    if (cell.toLowerCase() === 'hasta' && periodoRow[i + 1]) {
      fechaHasta = String(periodoRow[i + 1]).trim();
    }
  }

  // Parse dates to determine year/month
  if (fechaHasta) {
    const parts = fechaHasta.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2]);
      // Determine if quincenal (ends on 15th) or full month
      periodType = day === 15 ? 'quincenal_1' : (day >= 28 ? 'quincenal_2' : 'mensual');
    }
  }

  // Row 3 (index 2): Headers
  const headers = (rows[2] || []).map(h => String(h || '').trim().toLowerCase());

  // Find column indices by header name
  const findColumn = (keywords) => {
    for (const kw of keywords) {
      const idx = headers.findIndex(h => h.includes(kw.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Map columns to indices - based on Aleluya export structure
  const cols = {
    nombre: findColumn(['nombre']),
    apellido: findColumn(['apellido']),
    identificacion: findColumn(['número de identificación', 'identificación', 'identificacion', 'cedula']),
    sede: findColumn(['sede']),
    area: findColumn(['área', 'area']),
    cargo: findColumn(['cargo']),
    salarioMensual: findColumn(['salario mensual']),
    salarioBasico: findColumn(['salario básico', 'salario basico']),
    // Devengados
    totalIngresos: findColumn(['total ingresos']),
    auxTransporte: findColumn(['auxilio de transporte', 'aux transporte']),
    bonificacion: findColumn(['bonificación', 'bonificacion']),
    // Deducciones empleado
    pensionEmpleado: findColumn(['pensión empleado', 'pension empleado']),
    saludEmpleado: findColumn(['salud empleado']),
    totalDeducciones: findColumn(['total deducciones']),
    // Neto
    pagoNeto: findColumn(['pago neto empleado', 'pago neto', 'neto a pagar']),
    // Aportes empleador
    pensionEmpleador: findColumn(['pensión empleador', 'pension empleador']),
    saludEmpleador: findColumn(['salud empleador']),
    riesgosARL: findColumn(['riesgos laborales', 'arl']),
    sena: findColumn(['sena']),
    icbf: findColumn(['icbf']),
    ccf: findColumn(['caja de compensación', 'ccf']),
    // Provisiones
    cesantias: findColumn(['cesantías', 'cesantias']),
    intCesantias: findColumn(['intereses cesantías', 'intereses cesantias', 'int. cesant']),
    prima: findColumn(['prima']),
    vacaciones: findColumn(['vacaciones']),
    // Total costo empresa
    totalCostoEmpresa: findColumn(['total costo empresa', 'costo empresa']),
  };

  const employees = [];

  // Process employee rows (starting from row 4, index 3)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Check if row has valid employee data (has name or identification)
    const nombre = row[cols.nombre] ? String(row[cols.nombre]).trim() : '';
    const apellido = row[cols.apellido] ? String(row[cols.apellido]).trim() : '';
    const identificacion = row[cols.identificacion] ? String(row[cols.identificacion]).trim() : '';

    if (!nombre && !identificacion) continue;

    const getNum = (colIdx) => {
      if (colIdx < 0 || !row[colIdx]) return 0;
      const val = row[colIdx];
      return typeof val === 'number' ? Math.abs(val) : parseColombianMoney(String(val));
    };

    const fullName = apellido ? `${nombre} ${apellido}` : nombre;
    const salarioBase = getNum(cols.salarioBasico) || getNum(cols.salarioMensual);
    const totalDevengados = getNum(cols.totalIngresos);
    const totalDeducciones = getNum(cols.totalDeducciones);
    const pagoNeto = getNum(cols.pagoNeto);

    // Aportes parafiscales del empleador
    const pensionEmpleador = getNum(cols.pensionEmpleador);
    const saludEmpleador = getNum(cols.saludEmpleador);
    const arl = getNum(cols.riesgosARL);
    const sena = getNum(cols.sena);
    const icbf = getNum(cols.icbf);
    const ccf = getNum(cols.ccf);

    // Provisiones
    const cesantias = getNum(cols.cesantias);
    const intCesantias = getNum(cols.intCesantias);
    const prima = getNum(cols.prima);
    const vacaciones = getNum(cols.vacaciones);

    // Total costo empresa
    const totalCostoEmpresa = getNum(cols.totalCostoEmpresa);

    const employee = {
      nombre: fullName,
      identificacion,
      cargo: row[cols.cargo] ? String(row[cols.cargo]).trim() : '',
      area: row[cols.area] ? String(row[cols.area]).trim() : '',
      sede: row[cols.sede] ? String(row[cols.sede]).trim() : '',
      salario_base: salarioBase,
      dias_laborados: 15, // Quincenal default, could be 30 for monthly
      devengados: {
        salario: salarioBase,
        transporte: getNum(cols.auxTransporte),
        prestaciones_sociales: 0,
        bonificaciones: getNum(cols.bonificacion),
        auxilios: 0,
        otros: 0,
      },
      deducciones: {
        seguridad_social: getNum(cols.pensionEmpleado) + getNum(cols.saludEmpleado),
        pension_empleado: getNum(cols.pensionEmpleado),
        salud_empleado: getNum(cols.saludEmpleado),
        retencion_fuente: 0,
        otros: 0,
      },
      aportes_empleador: {
        pension: pensionEmpleador,
        salud: saludEmpleador,
        arl,
        sena,
        icbf,
        ccf,
        total_parafiscales: pensionEmpleador + saludEmpleador + arl + sena + icbf + ccf,
      },
      provisiones: {
        cesantias,
        intereses_cesantias: intCesantias,
        prima,
        vacaciones,
        total_provisiones: cesantias + intCesantias + prima + vacaciones,
      },
      total_devengados: totalDevengados,
      total_deducciones: totalDeducciones,
      total_pagado: pagoNeto,
      total_costo_empresa: totalCostoEmpresa,
    };

    employees.push(employee);
  }

  // Generate period name
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  let periodoName = `${monthNames[month - 1]} ${year}`;
  if (periodType === 'quincenal_1') {
    periodoName = `1-15 ${monthNames[month - 1]} ${year}`;
  } else if (periodType === 'quincenal_2') {
    periodoName = `16-${new Date(year, month, 0).getDate()} ${monthNames[month - 1]} ${year}`;
  }

  // Calculate totals
  const totales = {
    total_devengados: employees.reduce((sum, e) => sum + (e.total_devengados || 0), 0),
    total_deducciones: employees.reduce((sum, e) => sum + (e.total_deducciones || 0), 0),
    total_neto: employees.reduce((sum, e) => sum + (e.total_pagado || 0), 0),
    total_costo_empresa: employees.reduce((sum, e) => sum + (e.total_costo_empresa || 0), 0),
    total_parafiscales: employees.reduce((sum, e) => sum + (e.aportes_empleador?.total_parafiscales || 0), 0),
    total_provisiones: employees.reduce((sum, e) => sum + (e.provisiones?.total_provisiones || 0), 0),
  };

  return {
    empresa: 'LA REAL MARKETING SAS',
    fecha_inicio: fechaDesde,
    fecha_fin: fechaHasta,
    periodo: periodoName,
    period_type: periodType,
    year,
    month,
    empleados: employees,
    totales,
    source: 'aleluya_xlsx',
  };
}

/**
 * POST /api/payroll/upload
 * Uploads and parses an Aleluya payroll file (PDF or XLSX)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const pool = db.getPool();
  const orgId = req.orgId;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo PDF o Excel (.xlsx)' });
    }

    const isXLSX = req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel');
    const isPDF = req.file.mimetype === 'application/pdf';

    let payrollData;

    if (isXLSX) {
      // Parse XLSX file
      payrollData = parseAleluyaXLSX(req.file.buffer);
    } else if (isPDF) {
      // Parse PDF using pdf-parse
      const pdfData = await pdfParse(req.file.buffer);
      const text = pdfData.text;

      if (!text || text.trim().length < 50) {
        return res.status(400).json({ error: 'No se pudo extraer texto del PDF. ¿Es un PDF escaneado?' });
      }

      payrollData = parseAleluyaPDF(text);
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado. Use PDF o Excel (.xlsx)' });
    }

    // Validate we found at least one employee
    if (!payrollData.empleados || payrollData.empleados.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron empleados en el PDF',
        hint: 'Asegúrate de que el PDF sea un comprobante de nómina de Aleluya',
        extractedText: text.substring(0, 500),
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
