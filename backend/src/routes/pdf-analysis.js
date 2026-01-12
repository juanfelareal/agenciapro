import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

// Configure multer for PDF uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
 * POST /api/pdf/analyze-rut
 * Analyzes a Colombian RUT PDF and extracts client information
 */
router.post('/analyze-rut', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo PDF' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurado' });
    }

    // Convert PDF to base64
    const pdfBase64 = req.file.buffer.toString('base64');

    // Use Claude to analyze the PDF
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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
              text: `Analiza este documento RUT colombiano de la DIAN y extrae la información del contribuyente.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto adicional) con la siguiente estructura:

{
  "nit": "número de NIT con dígito de verificación (ej: 901995509-4)",
  "company": "razón social o nombre de la empresa",
  "name": "nombre del representante legal (primer nombre y apellidos)",
  "email": "correo electrónico si está disponible",
  "phone": "teléfono si está disponible",
  "address": "dirección principal",
  "city": "ciudad/municipio",
  "department": "departamento",
  "economic_activity": "actividad económica principal si está disponible"
}

Si algún campo no está disponible en el documento, usa una cadena vacía "".
Asegúrate de extraer el NIT del campo 5 incluyendo el dígito de verificación del campo 6.
La razón social está en el campo 35.
El correo electrónico está en el campo 42.
El teléfono está en el campo 44.
La dirección está en el campo 41.
El representante legal está en la página 3 (campos 104-107).`
            }
          ],
        }
      ],
    });

    // Parse Claude's response
    const text = response.content[0].text.trim();

    let extractedData;
    try {
      extractedData = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON from the response if it contains extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se pudo parsear la respuesta de Claude');
      }
    }

    // Format the response for the client form
    const clientData = {
      nit: extractedData.nit || '',
      company: extractedData.company || '',
      name: extractedData.name || '',
      email: extractedData.email || '',
      phone: extractedData.phone || '',
      address: extractedData.address || '',
      city: extractedData.city || '',
      department: extractedData.department || '',
      economic_activity: extractedData.economic_activity || '',
      notes: `Dirección: ${extractedData.address || ''}, ${extractedData.city || ''}, ${extractedData.department || ''}${extractedData.economic_activity ? `\nActividad económica: ${extractedData.economic_activity}` : ''}`
    };

    res.json({
      success: true,
      data: clientData,
      message: 'RUT analizado exitosamente'
    });

  } catch (error) {
    console.error('Error analyzing RUT PDF:', error);
    res.status(500).json({
      error: error.message || 'Error al analizar el PDF',
      details: error.response?.data || null
    });
  }
});

export default router;
