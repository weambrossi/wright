import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoryContextItem } from "@/lib/writing/types";

const createMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: createMock } }),
  MODELS: { haiku: "haiku", sonnet: "sonnet", opus: "opus" },
  MODEL_BY_MODE: {},
  CLAUDE_MODEL: "sonnet",
  MAX_TOKENS: 2048,
}));

import {
  isPlausibleRevision,
  reviewDraftForAIPatterns,
  shouldReviewDraft,
} from "@/lib/writing/draftReview";
import {
  buildDraftReviewSystemPrompt,
  buildGenerationSystemPrompt,
  naturalnessInstructions,
  NATURAL_PROSE_RULES,
} from "@/lib/writing/prompts";

function modelReply(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

// A draft dense with AI-typical patterns: stacked similes, an explained
// emotion after body language, and a thesis ending.
const PATTERNED_DRAFT =
  "Marcus gripped the chair like a drowning man clutching driftwood, his knuckles white as bone. " +
  "He was afraid. Elena's voice cut through the room like a knife through silk, sharp as broken glass. " +
  "It was not anger that filled the room, but grief. " +
  "In that moment, they both understood that love and loss were the same thing.";

const REVISED_DRAFT =
  "Marcus gripped the chair. Elena's voice was louder than it needed to be. " +
  "He didn't answer right away. When he did, he asked whether she'd eaten anything, " +
  "which was not what either of them expected him to say.";

beforeEach(() => {
  createMock.mockReset();
});

describe("shouldReviewDraft", () => {
  it("skips the review entirely when the author preserves current style", () => {
    expect(shouldReviewDraft("preserve_current_style")).toBe(false);
    expect(shouldReviewDraft("balanced")).toBe(true);
    expect(shouldReviewDraft("natural_understated")).toBe(true);
    expect(shouldReviewDraft("raw_conversational")).toBe(true);
  });
});

describe("reviewDraftForAIPatterns", () => {
  it("applies the model's revision when repeated metaphors and explained emotions are flagged", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        needsRevision: true,
        patternsFound: [
          "three similes in one paragraph",
          "emotion explained after physical action",
          "not X, but Y construction",
          "ending states the emotional thesis",
        ],
        revisedDraft: REVISED_DRAFT,
      })
    );
    const result = await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "balanced",
      model: "sonnet",
    });
    expect(result.revised).toBe(true);
    expect(result.text).toBe(REVISED_DRAFT);
    expect(result.patternsFound).toHaveLength(4);
  });

  it("preserves intentionally literary prose when the model finds nothing to fix", async () => {
    const literary =
      "The orchard had gone feral in the years since her mother stopped pruning it, and Elena liked it better this way.";
    createMock.mockResolvedValueOnce(
      modelReply({ needsRevision: false, patternsFound: [] })
    );
    const result = await reviewDraftForAIPatterns({
      draft: literary,
      naturalness: "natural_understated",
      model: "sonnet",
    });
    expect(result.revised).toBe(false);
    expect(result.text).toBe(literary);
  });

  it("never calls the model when naturalness preserves current style", async () => {
    const result = await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "preserve_current_style",
      model: "sonnet",
    });
    expect(result.revised).toBe(false);
    expect(result.text).toBe(PATTERNED_DRAFT);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("falls back to the original draft when the model call fails", async () => {
    createMock.mockRejectedValue(new Error("model down"));
    const result = await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "balanced",
      model: "sonnet",
    });
    expect(result.revised).toBe(false);
    expect(result.text).toBe(PATTERNED_DRAFT);
  });

  it("falls back to the original draft when the model returns invalid JSON", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "This draft has too many metaphors." }],
    });
    const result = await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "balanced",
      model: "sonnet",
    });
    expect(result.revised).toBe(false);
    expect(result.text).toBe(PATTERNED_DRAFT);
  });

  it("rejects implausible revisions (deterministic guard) and keeps the draft", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        needsRevision: true,
        patternsFound: ["everything"],
        revisedDraft: "He left.",
      })
    );
    const result = await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "raw_conversational",
      model: "sonnet",
    });
    expect(result.revised).toBe(false);
    expect(result.text).toBe(PATTERNED_DRAFT);
  });

  it("passes stored style context so deliberate choices are respected", async () => {
    const styleItem: StoryContextItem = {
      id: "ctx-style",
      documentId: "doc-1",
      category: "style",
      scope: "story",
      content: "The author writes long lyrical sentences on purpose.",
      characterNames: [],
      source: "manual_entry",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    createMock.mockResolvedValueOnce(
      modelReply({ needsRevision: false, patternsFound: [] })
    );
    await reviewDraftForAIPatterns({
      draft: PATTERNED_DRAFT,
      naturalness: "balanced",
      model: "sonnet",
      contextItems: [styleItem],
    });
    const userPrompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(userPrompt).toContain("long lyrical sentences on purpose");
  });
});

describe("isPlausibleRevision", () => {
  it("rejects empty, truncated, inflated, or meta-commentary output", () => {
    const original = "a".repeat(1000);
    expect(isPlausibleRevision(original, undefined)).toBe(false);
    expect(isPlausibleRevision(original, "")).toBe(false);
    expect(isPlausibleRevision(original, "a".repeat(100))).toBe(false);
    expect(isPlausibleRevision(original, "a".repeat(5000))).toBe(false);
    expect(
      isPlausibleRevision(original, `Here is the revised ${"a".repeat(900)}`)
    ).toBe(false);
    expect(isPlausibleRevision(original, "b".repeat(900))).toBe(true);
  });
});

describe("natural prose prompt rules", () => {
  it("are appended to the generation prompt without replacing the existing prompt", () => {
    const system = buildGenerationSystemPrompt("ask_me_first", "balanced");
    expect(system).toContain("NATURAL PROSE RULES");
    expect(system).toContain("WRITING QUALITY RULES");
    expect(system).toContain("Return ONLY the requested prose");
  });

  it("are omitted when the author preserves their current style", () => {
    const system = buildGenerationSystemPrompt(
      "ask_me_first",
      "preserve_current_style"
    );
    expect(system).not.toContain("NATURAL PROSE RULES");
    expect(system).toContain("WRITING QUALITY RULES");
  });

  it("scale in strictness across naturalness levels", () => {
    expect(naturalnessInstructions("preserve_current_style")).toBe("");
    const balanced = naturalnessInstructions("balanced");
    const understated = naturalnessInstructions("natural_understated");
    const raw = naturalnessInstructions("raw_conversational");
    for (const text of [balanced, understated, raw]) {
      expect(text).toContain(NATURAL_PROSE_RULES);
    }
    expect(new Set([balanced, understated, raw]).size).toBe(3);
    expect(balanced).toContain("light hand");
    expect(raw).toContain("strictly");
  });

  it("review prompt covers every AI-pattern check", () => {
    const system = buildDraftReviewSystemPrompt("balanced");
    expect(system).toContain("metaphor or simile");
    expect(system).toContain('"not X, but Y"');
    expect(system).toContain("emotional thesis");
    expect(system).toContain("Do not flatten the prose");
    expect(system).toContain("needsRevision");
  });
});
