import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Helper: fetch members for a conversation
async function getConversationMembers(conversationId) {
  return await db.prepare(`
    SELECT cm.team_member_id, tm.name
    FROM chat_members cm
    JOIN team_members tm ON cm.team_member_id = tm.id
    WHERE cm.conversation_id = ?
  `).all(conversationId);
}

// Helper: verify current user is a member of a conversation
async function verifyMembership(conversationId, teamMemberId) {
  return await db.prepare(`
    SELECT id FROM chat_members
    WHERE conversation_id = ? AND team_member_id = ?
  `).get(conversationId, teamMemberId);
}

// GET /conversations — list conversations with last message preview + unread count
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await db.prepare(`
      SELECT cc.id, cc.type, cc.name, cc.created_by, cc.created_at, cc.updated_at,
        (SELECT content FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id,
        (SELECT created_at FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.conversation_id = cc.id AND cm.created_at > cmb.last_read_at AND cm.sender_id != ?) as unread_count
      FROM chat_conversations cc
      JOIN chat_members cmb ON cc.id = cmb.conversation_id AND cmb.team_member_id = ?
      WHERE cc.organization_id = ?
      ORDER BY last_message_at DESC NULLS LAST
    `).all(req.teamMember.id, req.teamMember.id, req.orgId);

    // Fetch members for each conversation
    for (const conv of conversations) {
      conv.members = await getConversationMembers(conv.id);
    }

    res.json(conversations);
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations — create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { type, name, member_ids } = req.body;

    if (!type || !['direct', 'group'].includes(type)) {
      return res.status(400).json({ error: 'type must be "direct" or "group"' });
    }

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ error: 'member_ids is required and must be a non-empty array' });
    }

    // For direct: check if conversation already exists between the 2 members
    if (type === 'direct') {
      const otherMemberId = member_ids[0];
      const existing = await db.prepare(`
        SELECT cc.id
        FROM chat_conversations cc
        JOIN chat_members cm1 ON cc.id = cm1.conversation_id AND cm1.team_member_id = ?
        JOIN chat_members cm2 ON cc.id = cm2.conversation_id AND cm2.team_member_id = ?
        WHERE cc.type = 'direct' AND cc.organization_id = ?
        LIMIT 1
      `).get(req.teamMember.id, otherMemberId, req.orgId);

      if (existing) {
        const conversation = await db.prepare(`
          SELECT * FROM chat_conversations WHERE id = ?
        `).get(existing.id);
        conversation.members = await getConversationMembers(existing.id);
        return res.json(conversation);
      }
    }

    // For group: name is required
    if (type === 'group' && !name) {
      return res.status(400).json({ error: 'name is required for group conversations' });
    }

    // Insert conversation
    const result = await db.prepare(`
      INSERT INTO chat_conversations (type, name, created_by, organization_id)
      VALUES (?, ?, ?, ?)
    `).run(type, name || null, req.teamMember.id, req.orgId);

    const conversationId = result.lastInsertRowid;

    // Add all members + current user
    const allMemberIds = [...new Set([req.teamMember.id, ...member_ids])];
    for (const memberId of allMemberIds) {
      await db.prepare(`
        INSERT INTO chat_members (conversation_id, team_member_id)
        VALUES (?, ?)
      `).run(conversationId, memberId);
    }

    // For group: insert system message
    if (type === 'group') {
      await db.prepare(`
        INSERT INTO chat_messages (conversation_id, sender_id, content, message_type)
        VALUES (?, ?, ?, 'system')
      `).run(conversationId, req.teamMember.id, `${req.teamMember.name} creó el grupo`);
    }

    // Return created conversation with members
    const conversation = await db.prepare(`
      SELECT * FROM chat_conversations WHERE id = ?
    `).get(conversationId);
    conversation.members = await getConversationMembers(conversationId);

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /conversations/:id — get conversation details + members
router.get('/conversations/:id', async (req, res) => {
  try {
    const membership = await verifyMembership(req.params.id, req.teamMember.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const conversation = await db.prepare(`
      SELECT * FROM chat_conversations
      WHERE id = ? AND organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.members = await getConversationMembers(conversation.id);
    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /conversations/:id — update group name
router.put('/conversations/:id', async (req, res) => {
  try {
    const membership = await verifyMembership(req.params.id, req.teamMember.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const conversation = await db.prepare(`
      SELECT * FROM chat_conversations
      WHERE id = ? AND organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({ error: 'Can only update name for group conversations' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    await db.prepare(`
      UPDATE chat_conversations SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(name, req.params.id, req.orgId);

    const updated = await db.prepare(`
      SELECT * FROM chat_conversations WHERE id = ?
    `).get(req.params.id);
    updated.members = await getConversationMembers(updated.id);

    res.json(updated);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /conversations/:id/messages — get messages with pagination
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const membership = await verifyMembership(req.params.id, req.teamMember.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    let messages;
    if (before) {
      messages = await db.prepare(`
        SELECT cm.*, tm.name as sender_name
        FROM chat_messages cm
        JOIN team_members tm ON cm.sender_id = tm.id
        WHERE cm.conversation_id = ? AND cm.id < ?
        ORDER BY cm.created_at DESC
        LIMIT ?
      `).all(req.params.id, before, limit);
    } else {
      messages = await db.prepare(`
        SELECT cm.*, tm.name as sender_name
        FROM chat_messages cm
        JOIN team_members tm ON cm.sender_id = tm.id
        WHERE cm.conversation_id = ?
        ORDER BY cm.created_at DESC
        LIMIT ?
      `).all(req.params.id, limit);
    }

    // Reverse to return oldest first
    messages.reverse();

    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations/:id/messages — send a message
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const membership = await verifyMembership(req.params.id, req.teamMember.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const { content, entity_mentions } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await db.prepare(`
      INSERT INTO chat_messages (conversation_id, sender_id, content, entity_mentions)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, req.teamMember.id, content.trim(), entity_mentions ? JSON.stringify(entity_mentions) : null);

    // Update conversation updated_at
    await db.prepare(`
      UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);

    // Return saved message with sender info
    const message = await db.prepare(`
      SELECT cm.*, tm.name as sender_name
      FROM chat_messages cm
      JOIN team_members tm ON cm.sender_id = tm.id
      WHERE cm.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /conversations/:id/read — mark conversation as read
router.put('/conversations/:id/read', async (req, res) => {
  try {
    await db.prepare(`
      UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND team_member_id = ?
    `).run(req.params.id, req.teamMember.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /unread-count — total unread count across all conversations
router.get('/unread-count', async (req, res) => {
  try {
    const result = await db.prepare(`
      SELECT COALESCE(SUM(unread), 0) as total_unread
      FROM (
        SELECT COUNT(*) as unread
        FROM chat_messages cm
        JOIN chat_members cmb ON cm.conversation_id = cmb.conversation_id AND cmb.team_member_id = ?
        JOIN chat_conversations cc ON cm.conversation_id = cc.id AND cc.organization_id = ?
        WHERE cm.created_at > cmb.last_read_at AND cm.sender_id != ?
      )
    `).get(req.teamMember.id, req.orgId, req.teamMember.id);

    res.json({ unread_count: result.total_unread });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /search/entities — search tasks and projects for mentions
router.get('/search/entities', async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    const results = [];

    if (!type || type === 'task') {
      const tasks = await db.prepare(`
        SELECT id, title FROM tasks
        WHERE title ILIKE ? AND organization_id = ?
        LIMIT 10
      `).all(searchTerm, req.orgId);

      for (const task of tasks) {
        results.push({ type: 'task', id: task.id, label: task.title, title: task.title });
      }
    }

    if (!type || type === 'project') {
      const projects = await db.prepare(`
        SELECT id, name FROM projects
        WHERE name ILIKE ? AND organization_id = ?
        LIMIT 10
      `).all(searchTerm, req.orgId);

      for (const project of projects) {
        results.push({ type: 'project', id: project.id, label: project.name, title: project.name });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error searching entities:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /entity-preview/:type/:id — get entity preview for mention cards
router.get('/entity-preview/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'task') {
      const task = await db.prepare(`
        SELECT t.id, t.title, t.status, t.priority, t.due_date,
          tm.name as assigned_to_name,
          p.name as project_name
        FROM tasks t
        LEFT JOIN team_members tm ON t.assigned_to = tm.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = ? AND t.organization_id = ?
      `).get(id, req.orgId);

      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json({ type: 'task', ...task });
    }

    if (type === 'project') {
      const project = await db.prepare(`
        SELECT p.id, p.name, p.status, p.deadline,
          c.name as client_name
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.id = ? AND p.organization_id = ?
      `).get(id, req.orgId);

      if (!project) return res.status(404).json({ error: 'Project not found' });
      return res.json({ type: 'project', ...project });
    }

    res.status(400).json({ error: 'Invalid entity type' });
  } catch (error) {
    console.error('Error getting entity preview:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
