import db from '../config/database.js';

// Maps teamMemberId → Set of socketIds
const onlineUsers = new Map();

/**
 * Resuelve una sesión de equipo a partir del token Bearer (mismo esquema que teamAuth):
 * primero user_session_tokens (multi-tenant), luego team_session_tokens (legacy).
 * Devuelve { teamMemberId, orgId, name } o null si el token no es válido/expiró.
 * Compartido con collaborationService para autenticar sockets.
 */
export async function resolveSocketSession(token) {
  if (!token || typeof token !== 'string') return null;
  const notExpired = (row) => !row.expires_at || new Date(row.expires_at) >= new Date();

  const session = await db.get(`
    SELECT ust.user_id, ust.current_org_id, ust.expires_at
    FROM user_session_tokens ust
    WHERE ust.token = ? AND ust.status = 'active'
  `, [token]);
  if (session) {
    if (!notExpired(session)) return null;
    const member = await db.get(`
      SELECT id, name, organization_id FROM team_members
      WHERE user_id = ? AND organization_id = ? AND status = 'active'
    `, [session.user_id, session.current_org_id]);
    if (!member) return null;
    return { teamMemberId: Number(member.id), orgId: Number(member.organization_id), name: member.name };
  }

  const legacy = await db.get(`
    SELECT tst.expires_at, tm.id AS team_member_id, tm.name, tm.organization_id
    FROM team_session_tokens tst
    JOIN team_members tm ON tst.team_member_id = tm.id
    WHERE tst.token = ? AND tst.status = 'active' AND tm.status = 'active'
  `, [token]);
  if (!legacy || !notExpired(legacy) || !legacy.organization_id) return null;
  return { teamMemberId: Number(legacy.team_member_id), orgId: Number(legacy.organization_id), name: legacy.name };
}

// ¿El miembro autenticado en este socket es miembro de la conversación y ésta es de su org?
async function socketCanAccessConversation(socket, conversationId) {
  if (!socket.data.teamMemberId || !socket.data.orgId || !conversationId) return null;
  return await db.get(`
    SELECT cc.id, cc.organization_id
    FROM chat_conversations cc
    JOIN chat_members cm ON cm.conversation_id = cc.id AND cm.team_member_id = ?
    WHERE cc.id = ? AND cc.organization_id = ?
  `, [socket.data.teamMemberId, conversationId, socket.data.orgId]);
}

export const setupChat = (io) => {
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Client connected: ${socket.id}`);

    // authenticate — receives { token, teamMemberId }
    socket.on('authenticate', async ({ token, teamMemberId: claimedId } = {}) => {
      try {
        // Validar el token contra la BD: el teamMemberId lo decide la sesión, NO el cliente.
        const session = await resolveSocketSession(token);
        if (!session) {
          socket.emit('error', { message: 'Error de autenticación' });
          return;
        }
        if (claimedId !== undefined && claimedId !== null && Number(claimedId) !== session.teamMemberId) {
          socket.emit('error', { message: 'Error de autenticación' });
          return;
        }
        const teamMemberId = session.teamMemberId;
        socket.data.teamMemberId = teamMemberId;
        socket.data.orgId = session.orgId;
        socket.data.teamMemberName = session.name || 'Usuario';

        // Add to onlineUsers map
        if (!onlineUsers.has(teamMemberId)) {
          onlineUsers.set(teamMemberId, new Set());
        }
        onlineUsers.get(teamMemberId).add(socket.id);

        // Fetch all conversation IDs for this member (solo conversaciones de su organización)
        const conversations = await db.all(
          `SELECT cm.conversation_id
           FROM chat_members cm
           JOIN chat_conversations cc ON cc.id = cm.conversation_id
           WHERE cm.team_member_id = ? AND cc.organization_id = ?`,
          [teamMemberId, socket.data.orgId]
        );

        // Auto-join all conversation rooms
        for (const conv of conversations) {
          socket.join('chat:' + conv.conversation_id);
        }

        // Emit authenticated back to socket
        socket.emit('authenticated', { teamMemberId, name: socket.data.teamMemberName });

        // Broadcast user-online to all joined rooms
        for (const conv of conversations) {
          socket.to('chat:' + conv.conversation_id).emit('user-online', { teamMemberId });
        }

        // Emit current online users list
        const onlineMemberIds = Array.from(onlineUsers.keys());
        socket.emit('online-users', onlineMemberIds);

        console.log(`[Chat] ${socket.data.teamMemberName} (${teamMemberId}) authenticated, joined ${conversations.length} conversations`);
      } catch (error) {
        console.error('[Chat] Authentication error:', error.message);
        socket.emit('error', { message: 'Error de autenticación' });
      }
    });

    // send-message — receives { conversationId, content, entityMentions, imageUrl, messageType }
    socket.on('send-message', async ({ conversationId, content, entityMentions, imageUrl, messageType }) => {
      if (!socket.data.teamMemberId) {
        socket.emit('error', { message: 'No autenticado' });
        return;
      }

      try {
        const senderId = socket.data.teamMemberId;

        // La conversación debe ser de la org del socket y el emisor debe ser miembro
        const conversation = await socketCanAccessConversation(socket, conversationId);

        if (!conversation) {
          socket.emit('error', { message: 'Conversación no encontrada' });
          return;
        }

        const orgId = conversation.organization_id;

        // Insert message (con organization_id explícito)
        const msgType = imageUrl ? 'image' : 'text';
        const result = await db.run(
          `INSERT INTO chat_messages (conversation_id, sender_id, content, message_type, image_url, entity_mentions, organization_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [conversationId, senderId, content || '', msgType, imageUrl || null, entityMentions ? JSON.stringify(entityMentions) : null, orgId]
        );

        const messageId = result.lastInsertRowid;

        // Get the inserted message with sender info
        const savedMessage = await db.get(
          `SELECT cm.*, tm.name as sender_name
           FROM chat_messages cm
           JOIN team_members tm ON cm.sender_id = tm.id
           WHERE cm.id = ?`,
          [messageId]
        );

        // Update conversation updated_at
        await db.run(
          'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [conversationId]
        );

        // Emit message-sent to sender (ack)
        socket.emit('message-sent', savedMessage);

        // Broadcast new-message to room (excluding sender)
        socket.to('chat:' + conversationId).emit('new-message', savedMessage);

        // Create notifications for offline members
        const members = await db.all(
          'SELECT team_member_id FROM chat_members WHERE conversation_id = ? AND team_member_id != ?',
          [conversationId, senderId]
        );

        for (const member of members) {
          // Check if member is offline (not in onlineUsers map)
          if (!onlineUsers.has(member.team_member_id)) {
            await db.run(
              `INSERT INTO notifications (user_id, type, category, title, message, entity_type, entity_id, organization_id)
               VALUES (?, 'chat_message', 'system', ?, ?, 'chat', ?, ?)`,
              [
                member.team_member_id,
                `${socket.data.teamMemberName} te envió un mensaje`,
                (content || '').substring(0, 100),
                conversationId,
                orgId
              ]
            );
          }
        }

        console.log(`[Chat] Message sent by ${senderId} in conversation ${conversationId}`);
      } catch (error) {
        console.error('[Chat] Send message error:', error.message);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // typing — receives { conversationId }
    socket.on('typing', ({ conversationId } = {}) => {
      if (!socket.data.teamMemberId) return;
      // Solo a salas en las que el socket realmente está (se unió tras autenticarse)
      if (!socket.rooms.has('chat:' + conversationId)) return;

      socket.to('chat:' + conversationId).emit('user-typing', {
        teamMemberId: socket.data.teamMemberId,
        name: socket.data.teamMemberName,
        conversationId
      });
    });

    // stop-typing — receives { conversationId }
    socket.on('stop-typing', ({ conversationId } = {}) => {
      if (!socket.data.teamMemberId) return;
      if (!socket.rooms.has('chat:' + conversationId)) return;

      socket.to('chat:' + conversationId).emit('user-stop-typing', {
        teamMemberId: socket.data.teamMemberId,
        conversationId
      });
    });

    // mark-read — receives { conversationId }
    socket.on('mark-read', async ({ conversationId } = {}) => {
      if (!socket.data.teamMemberId) return;

      try {
        if (!(await socketCanAccessConversation(socket, conversationId))) return;
        await db.run(
          'UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND team_member_id = ?',
          [conversationId, socket.data.teamMemberId]
        );

        // Broadcast read-receipt to room
        socket.to('chat:' + conversationId).emit('read-receipt', {
          teamMemberId: socket.data.teamMemberId,
          conversationId
        });
      } catch (error) {
        console.error('[Chat] Mark read error:', error.message);
      }
    });

    // disconnect
    socket.on('disconnect', () => {
      const teamMemberId = socket.data.teamMemberId;

      if (teamMemberId) {
        // Remove socket from onlineUsers map
        const sockets = onlineUsers.get(teamMemberId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(teamMemberId);
          }
        }

        // Broadcast user-offline to all rooms the socket was in
        for (const room of socket.rooms) {
          if (room.startsWith('chat:')) {
            socket.to(room).emit('user-offline', { teamMemberId });
          }
        }

        console.log(`[Chat] ${socket.data.teamMemberName} (${teamMemberId}) disconnected`);
      } else {
        console.log(`[Chat] Unauthenticated client disconnected: ${socket.id}`);
      }
    });
  });

  console.log('✅ Chat WebSocket service initialized');
};

export default { setupChat, resolveSocketSession };
