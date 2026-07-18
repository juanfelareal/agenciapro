import express from 'express';
import db from '../config/database.js';
import crypto from 'crypto';

const router = express.Router();

// GET /api/ugc/contracts/:token - Get contract info for signing (public, no auth)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the project_creator by token
    const projectCreator = await db.get(`
      SELECT
        pc.id,
        pc.project_id,
        pc.creator_id,
        pc.status,
        pc.agreed_rate,
        pc.video_count,
        pc.contract_token,
        c.full_name as creator_name,
        c.email as creator_email,
        c.phone as creator_phone,
        c.cedula as creator_cedula,
        p.title as project_title,
        p.description as project_description,
        p.creator_cost_per_video,
        cl.company as client_name,
        o.id as organization_id,
        o.name as organization_name
      FROM ugc_project_creators pc
      JOIN ugc_creators c ON pc.creator_id = c.id
      JOIN ugc_projects p ON pc.project_id = p.id
      JOIN clients cl ON p.client_id = cl.id
      JOIN organizations o ON p.organization_id = o.id
      WHERE pc.contract_token = ?
    `, [token]);

    if (!projectCreator) {
      return res.status(404).json({ error: 'Contrato no encontrado o token inválido' });
    }

    // Check if already signed
    const existingSignature = await db.get(
      'SELECT id FROM ugc_signed_contracts WHERE project_creator_id = ?',
      [projectCreator.id]
    );

    if (existingSignature) {
      return res.status(400).json({
        error: 'Este contrato ya fue firmado',
        already_signed: true
      });
    }

    // Calculate payment details
    const videoCount = projectCreator.video_count || 1;
    const pricePerVideo = projectCreator.agreed_rate || projectCreator.creator_cost_per_video || 0;
    const totalPayment = videoCount * pricePerVideo;

    res.json({
      contract: {
        id: projectCreator.id,
        status: projectCreator.status,
        creator: {
          name: projectCreator.creator_name,
          email: projectCreator.creator_email,
          phone: projectCreator.creator_phone,
          cedula: projectCreator.creator_cedula
        },
        project: {
          title: projectCreator.project_title,
          description: projectCreator.project_description,
          client_name: projectCreator.client_name
        },
        payment: {
          video_count: videoCount,
          price_per_video: pricePerVideo,
          total: totalPayment,
          currency: 'COP'
        },
        organization: {
          name: projectCreator.organization_name
        }
      }
    });
  } catch (error) {
    console.error('Error getting contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/contracts/:token/sign - Sign the contract (public, no auth)
router.post('/:token/sign', async (req, res) => {
  try {
    const { token } = req.params;
    const {
      signer_name,
      signer_cedula,
      signer_email,
      signer_phone,
      bank_name,
      bank_account_type,
      bank_account_number,
      signature_data,
      accepted_terms,
      accepted_data_policy
    } = req.body;

    // Validate required fields
    if (!signer_name || !signer_cedula) {
      return res.status(400).json({ error: 'Nombre y cédula son obligatorios' });
    }

    if (!accepted_terms) {
      return res.status(400).json({ error: 'Debes aceptar los términos del contrato' });
    }

    // Find the project_creator by token
    const projectCreator = await db.get(`
      SELECT
        pc.id,
        pc.project_id,
        pc.creator_id,
        pc.status,
        pc.agreed_rate,
        pc.video_count,
        p.title as project_title,
        p.creator_cost_per_video,
        cl.company as client_name,
        p.organization_id
      FROM ugc_project_creators pc
      JOIN ugc_projects p ON pc.project_id = p.id
      JOIN clients cl ON p.client_id = cl.id
      WHERE pc.contract_token = ?
    `, [token]);

    if (!projectCreator) {
      return res.status(404).json({ error: 'Contrato no encontrado o token inválido' });
    }

    // Check if already signed
    const existingSignature = await db.get(
      'SELECT id FROM ugc_signed_contracts WHERE project_creator_id = ?',
      [projectCreator.id]
    );

    if (existingSignature) {
      return res.status(400).json({
        error: 'Este contrato ya fue firmado',
        already_signed: true
      });
    }

    // Get IP and User Agent
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Calculate payment details for storage
    const videoCount = projectCreator.video_count || 1;
    const pricePerVideo = projectCreator.agreed_rate || projectCreator.creator_cost_per_video || 0;
    const totalPayment = videoCount * pricePerVideo;

    const projectDetails = {
      project_title: projectCreator.project_title,
      client_name: projectCreator.client_name,
      video_count: videoCount,
      price_per_video: pricePerVideo,
      total_payment: totalPayment
    };

    // Insert signed contract
    const result = await db.run(`
      INSERT INTO ugc_signed_contracts (
        project_creator_id,
        signer_name,
        signer_cedula,
        signer_email,
        signer_phone,
        bank_name,
        bank_account_type,
        bank_account_number,
        signature_data,
        project_details,
        ip_address,
        user_agent,
        accepted_terms,
        accepted_data_policy,
        organization_id,
        signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      projectCreator.id,
      signer_name,
      signer_cedula,
      signer_email || null,
      signer_phone || null,
      bank_name || null,
      bank_account_type || null,
      bank_account_number || null,
      signature_data || null,
      JSON.stringify(projectDetails),
      ipAddress,
      userAgent,
      accepted_terms ? true : false,
      accepted_data_policy ? true : false,
      projectCreator.organization_id
    ]);

    // Update project_creator status to contract_signed
    await db.run(`
      UPDATE ugc_project_creators
      SET status = 'contract_signed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [projectCreator.id]);

    // Also update the creator's bank info if provided
    if (bank_name && bank_account_number) {
      // Store bank info in creator's record (as JSON in social_networks or a dedicated field)
      // For now, we'll just keep it in the signed contract
    }

    res.status(201).json({
      success: true,
      message: '¡Contrato firmado exitosamente!',
      contract_id: result.lastID
    });

  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Utility function to generate contract token (used internally by ugc routes)
export function generateContractToken() {
  return crypto.randomBytes(16).toString('hex');
}

export default router;
