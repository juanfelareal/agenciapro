/**
 * Socket.io namespace for real-time agent streaming.
 * Namespace: /agents
 * Uses Claude Agent SDK (no API key needed).
 */

import { getAgentBySlug } from './index.js';
import { streamAgentResponse } from './runner.js';

export const setupAgentSocket = (io) => {
  const agentNamespace = io.of('/agents');

  agentNamespace.on('connection', (socket) => {
    console.log(`[Agents] Client connected: ${socket.id}`);

    // query — receives { slug, message, sessionId }
    socket.on('query', async ({ slug, message, sessionId }) => {
      const agent = getAgentBySlug(slug);
      if (!agent) {
        socket.emit('error', { message: `Agent "${slug}" not found` });
        return;
      }

      if (!message?.trim()) {
        socket.emit('error', { message: 'message is required' });
        return;
      }

      try {
        await streamAgentResponse(agent, message.trim(), sessionId, {
          onMessage: (msg) => {
            socket.emit('message', { type: msg.type, data: msg });
          },
          onText: (text) => {
            socket.emit('text', { text });
          },
          onDone: (result) => {
            socket.emit('done', {
              content: result.content,
              sessionId: result.sessionId,
              cost: result.cost,
              usage: result.usage,
            });
          },
          onError: (err) => {
            socket.emit('error', { message: err.message });
          },
        });
      } catch (err) {
        console.error(`[Agents] Error running ${slug}:`, err.message);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Agents] Client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Agent WebSocket service initialized (Claude Agent SDK)');
};
