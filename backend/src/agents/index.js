/**
 * Agent Registry — Central registry of all available agents.
 * Import and register new agents here.
 */

import { marcaPersonalAgent } from './marca-personal.js';

// All registered agents
const agents = [
  marcaPersonalAgent,
];

// Lookup by slug
const agentsBySlug = new Map(agents.map((a) => [a.slug, a]));

export function getAllAgents() {
  // Return public info only (no systemPrompt, no internal config)
  return agents.map(({ systemPrompt, allowedTools, permissionMode, ...rest }) => rest);
}

export function getAgentBySlug(slug) {
  return agentsBySlug.get(slug) || null;
}

export function getAgentSlugs() {
  return agents.map((a) => a.slug);
}

export default { getAllAgents, getAgentBySlug, getAgentSlugs };
