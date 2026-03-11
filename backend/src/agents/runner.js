/**
 * Agent Runner — Executes agents using the Claude Agent SDK.
 * No API key needed — inherits auth from Claude Code CLI (Team plan).
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Run an agent query and collect all events.
 * @param {Object} agent - Agent config from registry
 * @param {string} prompt - User's query
 * @param {string} [sessionId] - Optional session ID for conversation continuity
 * @returns {Promise<{messages: Array, result: Object}>}
 */
export async function runAgentQuery(agent, prompt, sessionId) {
  const messages = [];
  let result = null;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
      maxTurns: agent.maxTurns,
      maxBudgetUsd: agent.maxBudgetUsd,
      model: agent.model,
      permissionMode: agent.permissionMode,
      ...(sessionId && { sessionId }),
    },
  })) {
    messages.push(message);

    if (message.type === 'result') {
      result = message;
    }
  }

  // Extract text content from assistant messages
  const textParts = messages
    .filter((m) => m.type === 'assistant')
    .flatMap((m) => (m.message?.content || []))
    .filter((block) => block.type === 'text')
    .map((block) => block.text);

  return {
    content: textParts.join('\n'),
    messages,
    result: result ? {
      sessionId: result.sessionId,
      cost: result.cost,
      usage: result.usage,
      exitReason: result.exitReason,
    } : null,
  };
}

/**
 * Stream agent events to callbacks in real time.
 * The Agent SDK query() is already an async iterator — each message is emitted as it arrives.
 *
 * @param {Object} agent - Agent config
 * @param {string} prompt - User's query
 * @param {string} [sessionId] - Optional session ID
 * @param {Object} callbacks
 * @param {Function} callbacks.onMessage - Called for each event (assistant, system, result, etc.)
 * @param {Function} callbacks.onText - Called when assistant text content is detected
 * @param {Function} callbacks.onDone - Called when the stream finishes
 * @param {Function} callbacks.onError - Called on error
 */
export async function streamAgentResponse(agent, prompt, sessionId, { onMessage, onText, onDone, onError }) {
  try {
    let fullText = '';
    let result = null;

    for await (const message of query({
      prompt,
      options: {
        systemPrompt: agent.systemPrompt,
        allowedTools: agent.allowedTools,
        maxTurns: agent.maxTurns,
        maxBudgetUsd: agent.maxBudgetUsd,
        model: agent.model,
        permissionMode: agent.permissionMode,
        ...(sessionId && { sessionId }),
      },
    })) {
      // Forward every event
      onMessage?.(message);

      // Extract text from assistant messages
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            fullText += block.text;
            onText?.(block.text);
          }
        }
      }

      if (message.type === 'result') {
        result = message;
      }
    }

    onDone?.({
      content: fullText,
      sessionId: result?.sessionId,
      cost: result?.cost,
      usage: result?.usage,
      exitReason: result?.exitReason,
    });

    return { content: fullText, result };
  } catch (err) {
    onError?.(err);
    throw err;
  }
}
