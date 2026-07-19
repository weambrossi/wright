import { randomUUID } from "crypto";
import type { ZodType } from "zod";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildClassifyUserPrompt,
  buildContradictionUserPrompt,
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  buildSkipOptionsUserPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  CONTRADICTION_SYSTEM_PROMPT,
  SKIP_OPTIONS_SYSTEM_PROMPT,
  answerToText,
} from "./prompts";
import {
  contextClassificationSchema,
  contradictionOutputSchema,
  evaluationOutputSchema,
  extractJson,
  skipOptionsOutputSchema,
  type ContextClassification,
  type EvaluationOutput,
} from "./schemas";
import {
  selectRelevantContext,
  trimManuscriptForModel,
} from "./contextRetrieval";
import { listStoryContext } from "./storyContextStore";
import type {
  ClarificationCategory,
  ClarificationQuestion,
  PendingWritingRequest,
  StoryContextCategory,
  StoryContextConflict,
  StoryContextItem,
  StoryContextScope,
  SuggestedAnswer,
} from "./types";

// Server-side orchestration for the context-grounded writing workflow.
// Every structured step calls Claude non-streaming, extracts JSON, and
// validates it with zod. Invalid output gets one retry before failing.

export const STRUCTURED_MODEL = MODELS.sonnet;
export const CLASSIFY_MODEL = MODELS.haiku;
export const GENERATION_MODEL = MODELS.sonnet;
const STRUCTURED_MAX_TOKENS = 1500;

async function callStructured<T>(
  model: string,
  system: string,
  user: string,
  schema: ZodType<T>
): Promise<T> {
  const anthropic = getAnthropic();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model,
      max_tokens: STRUCTURED_MAX_TOKENS,
      system,
      messages: [
        {
          role: "user",
          content:
            attempt === 0
              ? user
              : `${user}\n\nYour previous reply was not valid JSON for the required shape. Respond again with ONLY the JSON object.`,
        },
      ],
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `AI returned an invalid structured response: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// ---------------------------------------------------------------------------
// Context loading shared by all steps
// ---------------------------------------------------------------------------

export async function loadRelevantContext(input: {
  documentId: string;
  prompt: string;
  selectedText?: string;
  manuscriptText: string;
}): Promise<{
  items: StoryContextItem[];
  manuscript: string;
  nearby: string;
}> {
  const all = await listStoryContext(input.documentId);
  const { manuscript, nearby } = trimManuscriptForModel(
    input.manuscriptText,
    input.selectedText
  );
  const items = selectRelevantContext(all, {
    prompt: input.prompt,
    selectedText: input.selectedText,
    nearbyText: nearby,
  });
  return { items, manuscript, nearby };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface EvaluationResult {
  output: EvaluationOutput;
  /** The question with server-assigned ids, when clarification is needed. */
  question?: ClarificationQuestion;
}

export async function evaluateRequest(input: {
  request: PendingWritingRequest;
  contextItems: StoryContextItem[];
  manuscript: string;
  nearby: string;
  conversation: { role: "user" | "assistant"; content: string }[];
}): Promise<EvaluationResult> {
  const { request } = input;
  const answeredSoFar = request.questions
    .filter((q) => request.answers[q.id])
    .map((q) => ({
      question: q.question,
      answer: answerToText(request.answers[q.id]),
    }));

  const output = await callStructured(
    STRUCTURED_MODEL,
    buildEvaluationSystemPrompt(request.writingControlMode),
    buildEvaluationUserPrompt({
      prompt: request.originalPrompt,
      selectedText: request.selectedText,
      manuscript: input.manuscript,
      nearby: input.nearby,
      contextItems: input.contextItems,
      conversation: input.conversation,
      answeredSoFar,
      previouslyAskedQuestions: request.questions.map((q) => q.question),
    }),
    evaluationOutputSchema
  );

  if (output.decision !== "needs_clarification") {
    return { output };
  }

  // Guard against the model looping on equivalent questions: if we already
  // asked something nearly identical, treat the request as ready.
  const normalized = normalizeQuestion(output.question.question);
  const repeated = request.questions.some(
    (q) => normalizeQuestion(q.question) === normalized
  );
  if (repeated || request.questions.length >= MAX_QUESTIONS_PER_REQUEST) {
    return { output: { decision: "ready", assumptions: [] } };
  }

  const question: ClarificationQuestion = {
    id: randomUUID(),
    question: output.question.question,
    whyItMatters: output.question.whyItMatters,
    category: output.question.category as ClarificationCategory,
    required: true,
    answerType: output.question.answerType,
    suggestedAnswers: (output.question.suggestedAnswers ?? []).map((s) => ({
      id: randomUUID(),
      label: s.label,
      description: s.description,
    })),
    allowCustomAnswer: true,
  };
  return { output, question };
}

export const MAX_QUESTIONS_PER_REQUEST = 5;

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Contradiction check
// ---------------------------------------------------------------------------

export async function checkAnswerContradictions(input: {
  question: ClarificationQuestion;
  answerText: string;
  contextItems: StoryContextItem[];
  nearby: string;
}): Promise<StoryContextConflict[]> {
  // Nothing established yet — nothing to contradict.
  if (input.contextItems.length === 0 && !input.nearby.trim()) return [];

  const output = await callStructured(
    STRUCTURED_MODEL,
    CONTRADICTION_SYSTEM_PROMPT,
    buildContradictionUserPrompt({
      question: input.question.question,
      answer: input.answerText,
      contextItems: input.contextItems,
      nearby: input.nearby,
    }),
    contradictionOutputSchema
  );

  const knownIds = new Set(input.contextItems.map((i) => i.id));
  return output.conflicts.map((c) => {
    const item = knownIds.has(c.existingContextId)
      ? input.contextItems.find((i) => i.id === c.existingContextId)
      : undefined;
    return {
      id: randomUUID(),
      newStatement: c.newStatement,
      existingStatement: c.existingStatement,
      existingContextId: item ? item.id : "manuscript",
      existingSource: item
        ? sourceLabel(item)
        : "the manuscript text",
      explanation: c.explanation,
    };
  });
}

function sourceLabel(item: StoryContextItem): string {
  switch (item.source) {
    case "author_answer":
      return item.sourceQuestion
        ? `your earlier answer to "${item.sourceQuestion}"`
        : "an earlier answer you gave";
    case "manual_entry":
      return "a context entry you added";
    case "resolved_conflict":
      return "a contradiction you resolved earlier";
    case "manuscript":
    default:
      return "the manuscript";
  }
}

// ---------------------------------------------------------------------------
// Skip options
// ---------------------------------------------------------------------------

export async function generateSkipOptions(input: {
  question: ClarificationQuestion;
  prompt: string;
  contextItems: StoryContextItem[];
  nearby: string;
}): Promise<SuggestedAnswer[]> {
  const output = await callStructured(
    STRUCTURED_MODEL,
    SKIP_OPTIONS_SYSTEM_PROMPT,
    buildSkipOptionsUserPrompt(input),
    skipOptionsOutputSchema
  );
  return output.options.map((o) => ({
    id: randomUUID(),
    label: o.label,
    description: o.description,
  }));
}

// ---------------------------------------------------------------------------
// Answer classification for storage
// ---------------------------------------------------------------------------

export async function classifyAnswerForStorage(input: {
  question: ClarificationQuestion;
  answerText: string;
  prompt: string;
}): Promise<ContextClassification> {
  try {
    return await callStructured(
      CLASSIFY_MODEL,
      CLASSIFY_SYSTEM_PROMPT,
      buildClassifyUserPrompt({
        question: input.question.question,
        answer: input.answerText,
        prompt: input.prompt,
      }),
      contextClassificationSchema
    );
  } catch {
    // Classification is best-effort; fall back to a deterministic mapping so
    // the author's answer is never lost.
    return {
      category: fallbackCategory(input.question.category),
      scope: fallbackScope(input.question.category),
      characterNames: [],
      canonicalStatement: `${input.question.question} — ${input.answerText}`,
    };
  }
}

export function fallbackCategory(
  category: ClarificationCategory
): StoryContextCategory {
  // Clarification categories are a subset of story context categories.
  return category;
}

export function fallbackScope(
  category: ClarificationCategory
): StoryContextScope {
  switch (category) {
    case "character_emotion":
    case "character_action":
    case "scene_outcome":
    case "dialogue_intent":
      return "scene";
    case "style":
      return "request";
    default:
      return "story";
  }
}
