import db from '../config/database.js';

// Maps teamMemberId → Set of socketIds
const onlineUsers = new Map();

export const setupChat = (io) => {
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat] Client connected: ${socket.id}`);

    // authenticate — receives { token, teamMemberId }
    socket.on('authenticate', async ({ token, teamMemberId }) => {
      try {
        // Trust the token (HTTP middleware already validated it)
        // Store member info on socket
        socket.data.teamMemberId = teamMemberId;

        // Fetch member name
        const member = await db.get('SELECT name FROM team_members WHERE id = ?', [teamMemberId]);
        socket.data.teamMemberName = member?.name || 'Usuario';

        // Add to onlineUsers map
        if (!onlineUsers.has(teamMemberId)) {
          onlineUsers.set(teamMemberId, new Set());
        }
        onlineUsers.get(teamMemberId).add(socket.id);

        // Fetch all conversation IDs for this member
        const conversations = await db.all(
          'SELECT conversation_id FROM chat_members WHERE team_member_id = ?',
          [teamMemberId]
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

        // Get org_id from conversation
        const conversation = await db.get(
          'SELECT organization_id FROM chat_conversations WHERE id = ?',
          [conversationId]
        );

        if (!conversation) {
          socket.emit('error', { message: 'Conversación no encontrada' });
          return;
        }

        const orgId = conversation.organization_id;

        // Insert message
        const msgType = imageUrl ? 'image' : 'text';
        const result = await db.run(
          `INSERT INTO chat_messages (conversation_id, sender_id, content, message_type, image_url, entity_mentions)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [conversationId, senderId, content || '', msgType, imageUrl || null, entityMentions ? JSON.stringify(entityMentions) : null]
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
              `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, organization_id)
               VALUES (?, 'chat_message', ?, ?, 'chat', ?, ?)`,
              [
                member.team_member_id,
                `${socket.data.teamMemberName} te envió un mensaje`,
                content.substring(0, 100),
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
    socket.on('typing', ({ conversationId }) => {
      if (!socket.data.teamMemberId) return;

      socket.to('chat:' + conversationId).emit('user-typing', {
        teamMemberId: socket.data.teamMemberId,
        name: socket.data.teamMemberName,
        conversationId
      });
    });

    // stop-typing — receives { conversationId }
    socket.on('stop-typing', ({ conversationId }) => {
      if (!socket.data.teamMemberId) return;

      socket.to('chat:' + conversationId).emit('user-stop-typing', {
        teamMemberId: socket.data.teamMemberId,
        conversationId
      });
    });

    // mark-read — receives { conversationId }
    socket.on('mark-read', async ({ conversationId }) => {
      if (!socket.data.teamMemberId) return;

      try {
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

export default { setupChat };
