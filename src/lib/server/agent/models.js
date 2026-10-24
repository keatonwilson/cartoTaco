// src/lib/server/agent/models.js
// The concierge's model ids, in one place. Each tier can be overridden by env
// (AGENT_ROUTER_MODEL, AGENT_MODEL, AGENT_ESCALATION_MODEL), and evals pass
// their own config to run a model matrix.
import { ChatAnthropic } from '@langchain/anthropic';

export const DEFAULT_MODELS = {
  router: process.env.AGENT_ROUTER_MODEL || 'claude-haiku-4-5',
  agent: process.env.AGENT_MODEL || 'claude-haiku-4-5',
  escalation: process.env.AGENT_ESCALATION_MODEL || 'claude-sonnet-5-5'
};

// $ per million tokens. Cache reads bill at 0.1× input, cache writes at 1.25×.
// ponytail: hand-copied list prices; update when a model or price changes.
const PRICES = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 }
};

/** A LangChain chat model for one tier. */
export function chatModel(model, { maxTokens = 1024 } = {}) {
  return new ChatAnthropic({ model, maxTokens });
}

/**
 * Dollar cost of one call from LangChain's usage_metadata. input_tokens there
 * already includes cache reads and writes, which input_token_details splits out.
 */
export function callCost(model, usage) {
  const price = PRICES[model];
  if (!price || !usage) return 0;
  const read = usage.input_token_details?.cache_read ?? 0;
  const write = usage.input_token_details?.cache_creation ?? 0;
  const fresh = (usage.input_tokens ?? 0) - read - write;
  return (
    (fresh + read * 0.1 + write * 1.25) * price.input +
    (usage.output_tokens ?? 0) * price.output
  ) / 1e6;
}
