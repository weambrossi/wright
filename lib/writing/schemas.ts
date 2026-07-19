import { z } from "zod";

// Server-side validation of everything the model returns and everything the
// client sends. Model output is never trusted raw — it is parsed with these
// schemas before it reaches the client or the database.

export const clarificationCategorySchema = z.enum([
  "character_action",
  "character_emotion",
  "character_motivation",
  "relationship",
  "dialogue_intent",
  "plot",
  "backstory",
  "setting",
  "worldbuilding",
  "timeline",
  "scene_outcome",
  "theme",
  "style",
  "other",
]);

export const storyContextCategorySchema = z.enum([
  "character",
  "character_motivation",
  "character_emotion",
  "character_action",
  "relationship",
  "dialogue_intent",
  "plot",
  "backstory",
  "setting",
  "worldbuilding",
  "timeline",
  "scene_outcome",
  "theme",
  "style",
  "other",
]);

export const storyContextScopeSchema = z.enum(["story", "scene", "request"]);

export const writingControlModeSchema = z.enum([
  "ask_me_first",
  "suggest_options",
  "draft_freely",
]);

export const suggestedAnswerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const clarificationQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  whyItMatters: z.string().optional(),
  category: clarificationCategorySchema,
  required: z.boolean(),
  answerType: z.enum(["short_text", "long_text", "single_choice", "multi_choice"]),
  suggestedAnswers: z.array(suggestedAnswerSchema).optional(),
  allowCustomAnswer: z.boolean(),
});

export const clarificationAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.union([z.string(), z.array(z.string())]),
  source: z.enum(["author", "selected_option", "temporary_ai_assumption"]),
});

export const writingAssumptionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  importance: z.enum(["minor", "major"]),
});

export const storyContextConflictSchema = z.object({
  id: z.string().min(1),
  newStatement: z.string().min(1),
  existingStatement: z.string().min(1),
  existingContextId: z.string().min(1),
  existingSource: z.string().min(1),
  explanation: z.string().min(1),
});

// --------------------------------------------------------------------------
// Model output schemas (what Claude must return per orchestration step)
// --------------------------------------------------------------------------

/** Evaluation step: does the model have enough context to write? */
export const evaluationOutputSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("ready"),
    assumptions: z.array(
      z.object({
        description: z.string().min(1),
        importance: z.enum(["minor", "major"]),
      })
    ),
  }),
  z.object({
    decision: z.literal("needs_clarification"),
    reason: z.string().min(1),
    question: z.object({
      question: z.string().min(1),
      whyItMatters: z.string().optional(),
      category: clarificationCategorySchema,
      answerType: z
        .enum(["short_text", "long_text", "single_choice", "multi_choice"])
        .default("short_text"),
      suggestedAnswers: z
        .array(
          z.object({
            label: z.string().min(1),
            description: z.string().optional(),
          })
        )
        .optional(),
    }),
    remainingQuestionCount: z.number().int().min(0).optional(),
  }),
  z.object({
    decision: z.literal("not_a_writing_request"),
  }),
]);
export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

/** Contradiction check step. */
export const contradictionOutputSchema = z.object({
  conflicts: z.array(
    z.object({
      newStatement: z.string().min(1),
      existingStatement: z.string().min(1),
      existingContextId: z.string().min(1),
      explanation: z.string().min(1),
    })
  ),
});
export type ContradictionOutput = z.infer<typeof contradictionOutputSchema>;

/** Skip step: options offered instead of silently inventing an answer. */
export const skipOptionsOutputSchema = z.object({
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .min(2),
});
export type SkipOptionsOutput = z.infer<typeof skipOptionsOutputSchema>;

/** Scope + category inference when storing an author answer. */
export const contextClassificationSchema = z.object({
  category: storyContextCategorySchema,
  scope: storyContextScopeSchema,
  characterNames: z.array(z.string()).default([]),
  /** A clean canonical restatement of the fact, e.g. "Elena wants Marcus to admit he lied." */
  canonicalStatement: z.string().min(1),
});
export type ContextClassification = z.infer<typeof contextClassificationSchema>;

// --------------------------------------------------------------------------
// API request schemas (what the client sends)
// --------------------------------------------------------------------------

export const startWritingRequestSchema = z.object({
  documentId: z.string().min(1),
  prompt: z.string().min(1),
  destination: z.enum(["assistant_tab", "document_editor"]),
  documentAction: z
    .enum([
      "insert_at_cursor",
      "replace_selection",
      "add_below",
      "continue",
      "expand_selection",
      "rewrite_selection",
    ])
    .optional(),
  selectedText: z.string().optional(),
  selectionStart: z.number().int().min(0).optional(),
  selectionEnd: z.number().int().min(0).optional(),
  documentVersion: z.string().optional(),
  writingControlMode: writingControlModeSchema,
  /** Plain-text manuscript, serialized client-side from the live editor. */
  manuscriptText: z.string().default(""),
  /** Recent conversation turns for already-established info. */
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});
export type StartWritingRequestInput = z.infer<typeof startWritingRequestSchema>;

export const answerQuestionRequestSchema = z.object({
  requestId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  source: z.enum(["author", "selected_option", "temporary_ai_assumption"]),
  manuscriptText: z.string().default(""),
});
export type AnswerQuestionInput = z.infer<typeof answerQuestionRequestSchema>;

export const skipQuestionRequestSchema = z.object({
  requestId: z.string().min(1),
  questionId: z.string().min(1),
  manuscriptText: z.string().default(""),
});
export type SkipQuestionInput = z.infer<typeof skipQuestionRequestSchema>;

export const resolveConflictRequestSchema = z.object({
  requestId: z.string().min(1),
  conflictId: z.string().min(1),
  action: z.enum([
    "keep_existing",
    "replace_with_new",
    "edit_new",
    "keep_both",
    "mark_intentional",
    "cancel",
  ]),
  /** Required when action is edit_new. */
  editedAnswer: z.string().optional(),
});
export type ResolveConflictInput = z.infer<typeof resolveConflictRequestSchema>;

export const generateRequestSchema = z.object({
  requestId: z.string().min(1),
  manuscriptText: z.string().default(""),
});
export type GenerateInput = z.infer<typeof generateRequestSchema>;

export const storyContextCreateSchema = z.object({
  documentId: z.string().min(1),
  category: storyContextCategorySchema,
  scope: storyContextScopeSchema.default("story"),
  content: z.string().min(1),
  characterNames: z.array(z.string()).default([]),
});

export const storyContextUpdateSchema = z.object({
  category: storyContextCategorySchema.optional(),
  scope: storyContextScopeSchema.optional(),
  content: z.string().min(1).optional(),
  characterNames: z.array(z.string()).optional(),
  status: z.enum(["active", "superseded"]).optional(),
});

/**
 * Extract the first JSON object or array from raw model text. Models
 * occasionally wrap JSON in code fences or add stray prose; this trims that
 * without attempting to "fix" malformed JSON.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    // Fall through to bracket matching.
  }
  const start = unfenced.search(/[{[]/);
  if (start === -1) throw new Error("Model returned no JSON");
  const open = unfenced[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < unfenced.length; i++) {
    const ch = unfenced[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) {
        return JSON.parse(unfenced.slice(start, i + 1));
      }
    }
  }
  throw new Error("Model returned malformed JSON");
}
