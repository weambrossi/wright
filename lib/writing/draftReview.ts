import { getAnthropic } from "@/lib/anthropic";
import {
  buildDraftReviewSystemPrompt,
  buildDraftReviewUserPrompt,
} from "./prompts";
import { draftReviewOutputSchema, extractJson } from "./schemas";
import type { NaturalnessLevel, StoryContextItem } from "./types";

// Post-generation AI-pattern review: an internal revision pass that runs on
// the finished draft before the author sees it. The model checks for
// AI-typical prose patterns (stacked metaphors, explained emotions, mirrored
// phrasing, thesis endings…) and revises only where needed. Any failure —
// model error, invalid JSON, implausible revision — falls back to the
// original draft so the review can never block or corrupt a generation.

const REVIEW_MAX_TOKENS = 4096;

/** Revisions outside these bounds are treated as the model going off-script. */
const MIN_LENGTH_RATIO = 0.5;
const MAX_LENGTH_RATIO = 2.0;

export interface DraftReviewResult {
  /** The text to show the author (revised, or the original on any failure). */
  text: string;
  /** True when the review actually changed the draft. */
  revised: boolean;
  /** Patterns the model reported, for analytics/debugging. */
  patternsFound: string[];
}

/** The review pass only runs when the author opted into naturalness control. */
export function shouldReviewDraft(naturalness: NaturalnessLevel): boolean {
  return naturalness !== "preserve_current_style";
}

export async function reviewDraftForAIPatterns(input: {
  draft: string;
  naturalness: NaturalnessLevel;
  model: string;
  /** Author prose near the insertion point — the voice the draft should match. */
  nearby?: string;
  /** Stored style/preference context so deliberate choices are respected. */
  contextItems?: StoryContextItem[];
}): Promise<DraftReviewResult> {
  const original = input.draft;
  const unrevised: DraftReviewResult = {
    text: original,
    revised: false,
    patternsFound: [],
  };

  if (!shouldReviewDraft(input.naturalness) || !original.trim()) {
    return unrevised;
  }

  const styleContext = (input.contextItems ?? [])
    .filter((i) => i.category === "style" || i.category === "theme")
    .map((i) => `- ${i.content}`)
    .join("\n");

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: input.model,
      max_tokens: REVIEW_MAX_TOKENS,
      system: buildDraftReviewSystemPrompt(input.naturalness),
      messages: [
        {
          role: "user",
          content: buildDraftReviewUserPrompt({
            draft: original,
            nearby: input.nearby,
            styleContext,
          }),
        },
      ],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const parsed = draftReviewOutputSchema.safeParse(extractJson(text));
    if (!parsed.success) return unrevised;

    const output = parsed.data;
    if (!output.needsRevision) {
      return { ...unrevised, patternsFound: output.patternsFound };
    }

    const revised = output.revisedDraft?.trim();
    if (!isPlausibleRevision(original, revised)) {
      // The model flagged patterns but returned an unusable revision — the
      // author still gets their draft rather than a blocked generation.
      return { ...unrevised, patternsFound: output.patternsFound };
    }

    return {
      text: revised as string,
      revised: true,
      patternsFound: output.patternsFound,
    };
  } catch {
    return unrevised;
  }
}

/**
 * Deterministic validation of a model revision: non-empty, roughly the same
 * length as the original, and free of meta-commentary markers.
 */
export function isPlausibleRevision(
  original: string,
  revised: string | undefined
): boolean {
  if (!revised) return false;
  const ratio = revised.length / Math.max(original.length, 1);
  if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) return false;
  // The revision must be prose, not analysis of the prose.
  const metaMarkers = [
    "needsRevision",
    "patternsFound",
    "revisedDraft",
    "Here is the revised",
    "I revised",
    "[error]",
  ];
  return !metaMarkers.some((m) => revised.includes(m));
}
