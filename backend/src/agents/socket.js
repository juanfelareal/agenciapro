/**
 * Socket.io namespace for real-time agent streaming.
 * Namespace: /agents
 */

import { getAgentBySlug } from './index.js';
import { streamAgentResponse } from './runner.js';

export const setupAgentSocket = (io) => {
  const agentNamespace = io.of('/agents');

  agentNamespace.on('connection', (socket) => {
    console.log(`[Agents] Client connected: ${socket.id}`);

    // query — receives { slug, message, history }
    socket.on('query', async ({ slug, message, history }) => {
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
        await streamAgentResponse(agent, message.trim(), history || [], {
          onChunk: (text) => {
            socket.emit('chunk', { text });
          },
          onDone: (result) => {
            socket.emit('done', {
              content: result.content,
              usage: result.usage,
              model: result.model,
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

  console.log('✅ Agent WebSocket service initialized');
};
