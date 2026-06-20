import Anthropic from "@anthropic-ai/sdk";
import type { AIMode } from "@/lib/prompts";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
} as const;

// Each AI feature is matched to the model that best fits its task:
//  - grammar:    fast, cheap, structured extraction over the whole document
//  - rewrite:    frequent interactive edits — balanced quality/speed
//  - brainstorm: open-ended creativity — strongest model
//  - continue:   long-form prose that matches the author's voice — strongest model
export const MODEL_BY_MODE: Record<AIMode, string> = {
  grammar: MODELS.haiku,
  rewrite: MODELS.sonnet,
  brainstorm: MODELS.opus,
  continue: MODELS.opus,
};

// Fallback used if a request arrives without a recognized mode.
export const CLAUDE_MODEL = MODELS.sonnet;
export const MAX_TOKENS = 2048;
