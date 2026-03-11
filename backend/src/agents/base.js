/**
 * Base agent configuration and shared utilities.
 * Uses Claude Agent SDK (inherits Claude Code CLI auth).
 */

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TURNS = 25;
export const DEFAULT_MAX_BUDGET_USD = 0.50;
export const DEFAULT_PERMISSION_MODE = 'acceptEdits';

export const BASE_TOOLS = ['Read', 'Write', 'Glob', 'Grep'];
export const WEB_TOOLS = ['WebSearch', 'WebFetch'];

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
  maxTurns = DEFAULT_MAX_TURNS,
  maxBudgetUsd = DEFAULT_MAX_BUDGET_USD,
  permissionMode = DEFAULT_PERMISSION_MODE,
  allowedTools = [...BASE_TOOLS, ...WEB_TOOLS],
}) {
  return {
    name,
    slug,
    description,
    icon,
    color,
    systemPrompt,
    model,
    maxTurns,
    maxBudgetUsd,
    permissionMode,
    allowedTools,
  };
}
