import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { uploadBuffer } from '../utils/blobStorage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for profile photos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
});

const router = express.Router();

// GET /api/ugc/register/:token - Get registration form info
router.get('/register/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token
    const tokenRecord = await db.get(
      'SELECT * FROM ugc_registration_tokens WHERE token = ? AND status = ?',
      [token, 'active']
    );

    if (!tokenRecord) {
      return res.status(404).json({ error: 'Link de registro inválido o expirado' });
    }

    // Get organization info
    const org = await db.get(
      'SELECT id, name, logo_url FROM organizations WHERE id = ?',
      [tokenRecord.organization_id]
    );

    // Get industries for this organization
    const industries = await db.all(
      'SELECT id, name, slug, icon FROM ugc_industries WHERE organization_id = ? ORDER BY name',
      [tokenRecord.organization_id]
    );

    res.json({
      organization: {
        id: org.id,
        name: org.name,
        logo_url: org.logo_url
      },
      industries
    });
  } catch (error) {
    console.error('Error getting registration info:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/register/:token - Register a new creator
router.post('/register/:token', upload.single('profile_photo'), async (req, res) => {
  try {
    const { token } = req.params;
    const {
      full_name,
      email,
      phone,
      cedula,
      social_networks,
      address,
      city,
      department,
      postal_code,
      shipping_notes,
      industries,
      other_industry,
      bio,
      portfolio_url
    } = req.body;

    // Validate required fields
    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Nombre completo y WhatsApp son obligatorios' });
    }

    // Validate token
    const tokenRecord = await db.get(
      'SELECT * FROM ugc_registration_tokens WHERE token = ? AND status = ?',
      [token, 'active']
    );

    if (!tokenRecord) {
      return res.status(404).json({ error: 'Link de registro inválido o expirado' });
    }

    const orgId = tokenRecord.organization_id;

    // Check if phone already exists for this org
    const existing = await db.get(
      'SELECT id FROM ugc_creators WHERE phone = ? AND organization_id = ?',
      [phone, orgId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Este número de WhatsApp ya está registrado' });
    }

    // Get the first stage (Registrado)
    const firstStage = await db.get(
      'SELECT id FROM ugc_creator_stages WHERE organization_id = ? ORDER BY position ASC LIMIT 1',
      [orgId]
    );

    // Handle profile photo upload if provided
    let profilePhotoUrl = null;
    if (req.file) {
      try {
        const blob = await uploadBuffer('ugc-creators', req.file);
        profilePhotoUrl = blob.url;
      } catch (uploadErr) {
        console.error('Error uploading profile photo:', uploadErr);
        // Continue without the photo - not a critical error
      }
    }

    // Parse social_networks if it's a string (from FormData)
    let parsedSocialNetworks = social_networks;
    if (typeof social_networks === 'string') {
      try {
        parsedSocialNetworks = JSON.parse(social_networks);
      } catch (e) {
        parsedSocialNetworks = {};
      }
    }

    // Parse industries if it's a string (from FormData)
    let parsedIndustries = industries;
    if (typeof industries === 'string') {
      try {
        parsedIndustries = JSON.parse(industries);
      } catch (e) {
        parsedIndustries = [];
      }
    }

    // Create the creator
    const result = await db.run(
      `INSERT INTO ugc_creators (
        full_name, email, phone, cedula, social_networks,
        address, city, department, postal_code, shipping_notes,
        industries, other_industry, bio, portfolio_url, profile_photo_url, stage_id, source, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email || null,
        phone,
        cedula || null,
        JSON.stringify(parsedSocialNetworks || {}),
        address || null,
        city || null,
        department || null,
        postal_code || null,
        shipping_notes || null,
        parsedIndustries || [],
        other_industry || null,
        bio || null,
        portfolio_url || null,
        profilePhotoUrl,
        firstStage?.id || null,
        'landing',
        orgId
      ]
    );

    // Increment uses count
    await db.run(
      'UPDATE ugc_registration_tokens SET uses_count = uses_count + 1 WHERE id = ?',
      [tokenRecord.id]
    );

    res.status(201).json({
      success: true,
      message: '¡Registro exitoso! Pronto nos pondremos en contacto contigo.',
      creator_id: result.lastID
    });
  } catch (error) {
    console.error('Error registering creator:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
