/**
 * Base agent configuration and shared utilities.
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} name - Display name
 * @property {string} slug - URL-safe identifier
 * @property {string} description - Short description
 * @property {string} icon - Emoji icon
 * @property {string} color - Hex color
 * @property {string} systemPrompt - Full system prompt
 * @property {string} model - Claude model to use
 * @property {number} maxTokens - Max output tokens
 * @property {number} temperature - Sampling temperature
 */

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Create a standardized agent config.
 */
export function defineAgent({
  name,
  slug,
  description,
  icon = '🤖',
  color = '#6366f1',
  systemPrompt,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
}) {
  return {
    name,
    slug,
    description,
    icon,
    color,
    systemPrompt,
    model,
    maxTokens,
    temperature,
  };
}
