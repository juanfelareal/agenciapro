import express from 'express';
import { getAllAgents, getAgentBySlug } from '../agents/index.js';
import { runAgentQuery, streamAgentResponse } from '../agents/runner.js';

const router = express.Router();

// GET /agents — List all available agents
router.get('/', (req, res) => {
  const agents = getAllAgents();
  res.json(agents);
});

// GET /agents/:slug — Get agent details
router.get('/:slug', (req, res) => {
  const agent = getAgentBySlug(req.params.slug);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  const { systemPrompt, ...publicInfo } = agent;
  res.json(publicInfo);
});

// POST /agents/:slug/query — Synchronous query
router.post('/:slug/query', async (req, res) => {
  const agent = getAgentBySlug(req.params.slug);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const { message, history } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const result = await runAgentQuery(agent, message.trim(), history || []);
    res.json({
      agent: agent.slug,
      ...result,
    });
  } catch (error) {
    console.error(`[Agent:${agent.slug}] Query error:`, error.message);
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /agents/:slug/stream — Server-Sent Events streaming
router.post('/:slug/stream', async (req, res) => {
  const agent = getAgentBySlug(req.params.slug);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const { message, history } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    await streamAgentResponse(agent, message.trim(), history || [], {
      onChunk: (text) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      },
      onDone: (result) => {
        res.write(`data: ${JSON.stringify({ type: 'done', usage: result.usage, model: result.model })}\n\n`);
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      },
    });
  } catch (error) {
    console.error(`[Agent:${agent.slug}] Stream error:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
