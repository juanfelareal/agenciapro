import express from 'express';
import { streamAgentResponse } from '../agents/runner.js';
import db from '../config/database.js';

const router = express.Router();

// ========================================
// ADVISOR CRUD
// ========================================

router.get('/advisors', async (req, res) => {
  try {
    const advisors = await db.all(
      `SELECT id, name, slug, role, expertise, icon, avatar_color, example_prompts, is_active, created_at
       FROM board_advisors
       WHERE organization_id = ? AND is_active = 1
       ORDER BY created_at ASC`,
      [req.orgId]
    );
    res.json(advisors);
  } catch (error) {
    console.error('Error getting advisors:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/advisors', async (req, res) => {
  try {
    const { name, slug, role, expertise, icon, avatar_color, system_prompt, example_prompts } = req.body;

    if (!name || !slug || !role || !system_prompt) {
      return res.status(400).json({ error: 'name, slug, role, and system_prompt are required' });
    }

    const result = await db.run(`
      INSERT INTO board_advisors (name, slug, role, expertise, icon, avatar_color, system_prompt, example_prompts, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, slug, role, expertise || null,
      icon || '🧠', avatar_color || '#6366f1',
      system_prompt,
      JSON.stringify(example_prompts || []),
      req.orgId
    ]);

    const advisor = await db.get('SELECT * FROM board_advisors WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(advisor);
  } catch (error) {
    console.error('Error creating advisor:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/advisors/:id', async (req, res) => {
  try {
    const { name, slug, role, expertise, icon, avatar_color, system_prompt, example_prompts, is_active } = req.body;

    const existing = await db.get(
      'SELECT id FROM board_advisors WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Advisor not found' });

    await db.run(`
      UPDATE board_advisors SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        role = COALESCE(?, role),
        expertise = COALESCE(?, expertise),
        icon = COALESCE(?, icon),
        avatar_color = COALESCE(?, avatar_color),
        system_prompt = COALESCE(?, system_prompt),
        example_prompts = COALESCE(?, example_prompts),
        is_active = COALESCE(?, is_active)
      WHERE id = ? AND organization_id = ?
    `, [
      name || null, slug || null, role || null, expertise !== undefined ? expertise : null,
      icon || null, avatar_color || null, system_prompt || null,
      example_prompts ? JSON.stringify(example_prompts) : null,
      is_active !== undefined ? is_active : null,
      req.params.id, req.orgId
    ]);

    const advisor = await db.get('SELECT * FROM board_advisors WHERE id = ?', [req.params.id]);
    res.json(advisor);
  } catch (error) {
    console.error('Error updating advisor:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/advisors/:id', async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT id FROM board_advisors WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Advisor not found' });

    await db.run('DELETE FROM board_advisors WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Advisor deleted' });
  } catch (error) {
    console.error('Error deleting advisor:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CONVERSATIONS
// ========================================

router.get('/conversations', async (req, res) => {
  try {
    const conversations = await db.all(`
      SELECT bc.*,
        ba.name as advisor_name, ba.slug as advisor_slug, ba.icon as advisor_icon, ba.avatar_color as advisor_color,
        (SELECT content FROM board_messages WHERE conversation_id = bc.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM board_messages WHERE conversation_id = bc.id) as message_count
      FROM board_conversations bc
      LEFT JOIN board_advisors ba ON bc.advisor_id = ba.id
      WHERE bc.team_member_id = ? AND bc.organization_id = ?
      ORDER BY bc.updated_at DESC
    `, [req.teamMember.id, req.orgId]);

    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const { type, advisor_slug, title } = req.body;
    const convType = type || 'group';

    let advisorId = null;
    if (convType === 'direct') {
      if (!advisor_slug) return res.status(400).json({ error: 'advisor_slug required for direct conversations' });
      const advisor = await db.get(
        'SELECT id FROM board_advisors WHERE slug = ? AND organization_id = ?',
        [advisor_slug, req.orgId]
      );
      if (!advisor) return res.status(404).json({ error: 'Advisor not found' });
      advisorId = advisor.id;
    }

    const result = await db.run(`
      INSERT INTO board_conversations (type, advisor_id, title, team_member_id, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `, [convType, advisorId, title || 'Nueva conversación', req.teamMember.id, req.orgId]);

    const conversation = await db.get(`
      SELECT bc.*, ba.name as advisor_name, ba.slug as advisor_slug, ba.icon as advisor_icon, ba.avatar_color as advisor_color
      FROM board_conversations bc
      LEFT JOIN board_advisors ba ON bc.advisor_id = ba.id
      WHERE bc.id = ?
    `, [result.lastInsertRowid]);
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await db.get(`
      SELECT bc.*, ba.name as advisor_name, ba.slug as advisor_slug, ba.icon as advisor_icon,
             ba.avatar_color as advisor_color, ba.role as advisor_role
      FROM board_conversations bc
      LEFT JOIN board_advisors ba ON bc.advisor_id = ba.id
      WHERE bc.id = ? AND bc.team_member_id = ? AND bc.organization_id = ?
    `, [req.params.id, req.teamMember.id, req.orgId]);

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await db.all(`
      SELECT bm.*, ba.name as advisor_name, ba.slug as advisor_slug, ba.icon as advisor_icon, ba.avatar_color as advisor_color
      FROM board_messages bm
      LEFT JOIN board_advisors ba ON bm.advisor_id = ba.id
      WHERE bm.conversation_id = ?
      ORDER BY bm.created_at ASC
    `, [req.params.id]);

    let advisors = [];
    if (conversation.type === 'group') {
      advisors = await db.all(
        'SELECT id, name, slug, icon, avatar_color, role FROM board_advisors WHERE organization_id = ? AND is_active = 1 ORDER BY created_at ASC',
        [req.orgId]
      );
    }

    res.json({ conversation, messages, advisors });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const conversation = await db.get(
      'SELECT id FROM board_conversations WHERE id = ? AND team_member_id = ? AND organization_id = ?',
      [req.params.id, req.teamMember.id, req.orgId]
    );
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    await db.run('DELETE FROM board_conversations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// MESSAGES + STREAMING (using Claude Agent SDK via runner.js)
// ========================================

// Helper: stream a single advisor response using Agent SDK
async function streamAdvisorResponse(advisor, promptText, res, conversationId, orgId) {
  let fullContent = '';

  try {
    // Signal advisor start
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'advisor_start',
        advisor_id: advisor.id,
        advisor_name: advisor.name,
        advisor_slug: advisor.slug,
        advisor_icon: advisor.icon,
        advisor_color: advisor.avatar_color,
      })}\n\n`);
    }

    const agentConfig = {
      systemPrompt: advisor.system_prompt,
      allowedTools: [],
      maxTurns: 1,
      maxBudgetUsd: 0.50,
      model: 'claude-sonnet-4-6',
      permissionMode: 'plan',
    };

    await streamAgentResponse(agentConfig, promptText, null, {
      onText: (text) => {
        fullContent += text;
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'text',
            text,
            advisor_id: advisor.id,
          })}\n\n`);
        }
      },
      onMessage: () => {},
      onDone: async (result) => {
        // Save advisor message to DB
        await db.run(
          'INSERT INTO board_messages (conversation_id, role, content, advisor_id, organization_id) VALUES (?, ?, ?, ?, ?)',
          [conversationId, 'assistant', fullContent, advisor.id, orgId]
        );

        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'advisor_done',
            advisor_id: advisor.id,
            advisor_name: advisor.name,
            content: fullContent,
          })}\n\n`);
        }
      },
      onError: (err) => {
        console.error(`[Board] Stream error for ${advisor.name}:`, err.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: 'advisor_error',
            advisor_id: advisor.id,
            advisor_name: advisor.name,
            error: err.message,
          })}\n\n`);
        }
      },
    });

    return fullContent;
  } catch (err) {
    console.error(`[Board] Stream error for ${advisor.name}:`, err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: 'advisor_error',
        advisor_id: advisor.id,
        advisor_name: advisor.name,
        error: err.message,
      })}\n\n`);
    }
    return '';
  }
}

// POST /conversations/:id/messages — Send message + stream responses via SSE
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Verify conversation ownership
    const conversation = await db.get(`
      SELECT bc.*, ba.system_prompt, ba.name as advisor_name, ba.id as single_advisor_id
      FROM board_conversations bc
      LEFT JOIN board_advisors ba ON bc.advisor_id = ba.id
      WHERE bc.id = ? AND bc.team_member_id = ? AND bc.organization_id = ?
    `, [req.params.id, req.teamMember.id, req.orgId]);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Save user message to DB
    await db.run(
      'INSERT INTO board_messages (conversation_id, role, content, advisor_id, organization_id) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, 'user', message.trim(), null, req.orgId]
    );

    // Update conversation title if first user message
    const userMsgCount = await db.get(
      "SELECT COUNT(*) as count FROM board_messages WHERE conversation_id = ? AND role = 'user'",
      [req.params.id]
    );
    if (userMsgCount.count === 1) {
      const title = message.trim().substring(0, 80) + (message.length > 80 ? '...' : '');
      await db.run('UPDATE board_conversations SET title = ? WHERE id = ?', [title, req.params.id]);
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    if (conversation.type === 'direct') {
      // ===== DIRECT: Single advisor responds =====
      const advisor = await db.get(
        'SELECT * FROM board_advisors WHERE id = ? AND organization_id = ?',
        [conversation.single_advisor_id, req.orgId]
      );

      if (!advisor) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Advisor not found' })}\n\n`);
        res.end();
        return;
      }

      // Build prompt from conversation history
      const history = await db.all(`
        SELECT bm.role, bm.content
        FROM board_messages bm
        WHERE bm.conversation_id = ? AND (bm.advisor_id IS NULL OR bm.advisor_id = ?)
        ORDER BY bm.created_at ASC
      `, [req.params.id, advisor.id]);

      // Format history as a single prompt string for the Agent SDK
      const historyLines = history.map(m => {
        if (m.role === 'user') return `[Usuario]: ${m.content}`;
        return `[${advisor.name}]: ${m.content}`;
      });
      const promptText = historyLines.join('\n\n');

      await streamAdvisorResponse(advisor, promptText, res, req.params.id, req.orgId);

    } else {
      // ===== GROUP: All advisors respond sequentially =====
      const advisors = await db.all(
        'SELECT * FROM board_advisors WHERE organization_id = ? AND is_active = 1 ORDER BY created_at ASC',
        [req.orgId]
      );

      if (advisors.length === 0) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'No advisors configured' })}\n\n`);
        res.end();
        return;
      }

      // Signal which advisors will respond
      res.write(`data: ${JSON.stringify({
        type: 'group_start',
        advisors: advisors.map(a => ({ id: a.id, name: a.name, slug: a.slug, icon: a.icon, color: a.avatar_color })),
      })}\n\n`);

      // Get full conversation history for context
      const history = await db.all(`
        SELECT bm.role, bm.content, ba.name as advisor_name
        FROM board_messages bm
        LEFT JOIN board_advisors ba ON bm.advisor_id = ba.id
        WHERE bm.conversation_id = ?
        ORDER BY bm.created_at ASC
      `, [req.params.id]);

      // Each advisor responds with context of the whole conversation + previous advisors' responses in this round
      const roundResponses = [];

      for (const advisor of advisors) {
        // Build history text (everything except the last user message which is already in history)
        const historyText = history.slice(0, -1).map(m => {
          if (m.role === 'user') return `[Usuario]: ${m.content}`;
          return `[${m.advisor_name || 'Advisor'}]: ${m.content}`;
        }).join('\n\n');

        // Add round context (other advisors' responses this round)
        let roundContext = '';
        if (roundResponses.length > 0) {
          roundContext = '\n\n--- Respuestas de otros advisors en esta ronda ---\n' +
            roundResponses.map(r => `[${r.name}]: ${r.content}`).join('\n\n') +
            '\n--- Fin ---\nAhora es tu turno. Complementa, debate o agrega tu perspectiva. No repitas lo que ya dijeron.';
        }

        const promptText = [historyText, `[Usuario]: ${message.trim()}`, roundContext].filter(Boolean).join('\n\n');

        const content = await streamAdvisorResponse(advisor, promptText, res, req.params.id, req.orgId);
        roundResponses.push({ name: advisor.name, content });
      }
    }

    await db.run('UPDATE board_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in board message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
