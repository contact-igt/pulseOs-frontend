import { FixtureSummarizer } from "./fixture-summarizer.js";
import type { ConversationSummarizer } from "./summarizer.js";

export * from "./summarizer.js";
export * from "./session-time.js";

/**
 * Which summarizer runs. Only a real language model is "AI"; without one configured the deterministic fixture
 * is used and every summary says FIXTURE. (An Anthropic-backed implementation plugs in here.)
 */
export function getSummarizer(): ConversationSummarizer {
  return new FixtureSummarizer();
}
