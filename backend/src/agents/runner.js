/**
 * Agent Runner — Executes agents using the Anthropic SDK.
 * Supports both synchronous queries and streaming responses.
 */

import Anthropic from '@anthropic-ai/sdk';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to your environment variables.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Run a synchronous query against an agent.
 * @param {Object} agent - Agent config from registry
 * @param {string} userMessage - User's query
 * @param {Array} history - Previous messages [{role, content}]
 * @returns {Promise<{content: string, usage: Object}>}
 */
export async function runAgentQuery(agent, userMessage, history = []) {
  const anthropic = getClient();

  const messages = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: agent.model,
    max_tokens: agent.maxTokens,
    temperature: agent.temperature,
    system: agent.systemPrompt,
    messages,
  });

  const textContent = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    content: textContent,
    usage: response.usage,
    stop_reason: response.stop_reason,
    model: response.model,
  };
}

/**
 * Stream a response from an agent.
 * @param {Object} agent - Agent config
 * @param {string} userMessage - User's query
 * @param {Array} history - Previous messages
 * @param {Function} onChunk - Callback for each text chunk (delta)
 * @param {Function} onDone - Callback when streaming completes
 * @param {Function} onError - Callback on error
 */
export async function streamAgentResponse(agent, userMessage, history = [], { onChunk, onDone, onError }) {
  const anthropic = getClient();

  const messages = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const stream = await anthropic.messages.stream({
      model: agent.model,
      max_tokens: agent.maxTokens,
      temperature: agent.temperature,
      system: agent.systemPrompt,
      messages,
    });

    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      onChunk?.(text);
    });

    stream.on('error', (err) => {
      onError?.(err);
    });

    const finalMessage = await stream.finalMessage();

    onDone?.({
      content: fullText,
      usage: finalMessage.usage,
      stop_reason: finalMessage.stop_reason,
      model: finalMessage.model,
    });

    return { content: fullText, usage: finalMessage.usage };
  } catch (err) {
    onError?.(err);
    throw err;
  }
}
