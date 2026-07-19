// Shared types for the context-grounded writing workflow.
//
// The author owns the story; Wright drafts from author-approved context.
// These types describe the structured contract between the client, the API
// routes, and the AI orchestration layer.

export type WritingControlMode =
  | "ask_me_first"
  | "suggest_options"
  | "draft_freely";

export const WRITING_CONTROL_MODES: {
  id: WritingControlMode;
  label: string;
  description: string;
}[] = [
  {
    id: "ask_me_first",
    label: "Ask Me First",
    description:
      "Wright asks for your input whenever missing details could meaningfully change the writing. Clarification over assumption.",
  },
  {
    id: "suggest_options",
    label: "Suggest Options",
    description:
      "Wright asks when important context is missing, and offers several possible directions for you to choose from.",
  },
  {
    id: "draft_freely",
    label: "Draft Freely",
    description:
      "Wright drafts more independently, but still respects your canon, avoids contradictions, and flags major assumptions.",
  },
];

export const DEFAULT_WRITING_MODE: WritingControlMode = "ask_me_first";

// ---------------------------------------------------------------------------
// Naturalness (natural-prose control)
// ---------------------------------------------------------------------------

/**
 * How aggressively Wright reduces AI-typical prose patterns (metaphor
 * stacking, explained emotions, "not X, but Y" constructions, over-polished
 * sentences) in generated fiction.
 */
export type NaturalnessLevel =
  | "preserve_current_style"
  | "balanced"
  | "natural_understated"
  | "raw_conversational";

export const NATURALNESS_LEVELS: {
  id: NaturalnessLevel;
  label: string;
  description: string;
}[] = [
  {
    id: "preserve_current_style",
    label: "Preserve current style",
    description:
      "No naturalness adjustments. Wright writes exactly as it would today, matching your manuscript.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description:
      "Reduces obvious AI patterns — stacked metaphors, explained emotions, mirrored phrasing — while keeping intentional literary language.",
  },
  {
    id: "natural_understated",
    label: "More natural and understated",
    description:
      "Prefers concrete observation over metaphor, lets actions go uninterpreted, and allows mundane detail and tonal variation.",
  },
  {
    id: "raw_conversational",
    label: "Raw and conversational",
    description:
      "Plain, unpolished prose. Interruptions, blunt answers, awkwardness, and ordinary detail over crafted sentences.",
  },
];

export const DEFAULT_NATURALNESS: NaturalnessLevel = "balanced";

/** Whether the author wants clarification questions before generation. */
export const DEFAULT_ASK_QUESTIONS = true;

// ---------------------------------------------------------------------------
// Context evaluation summary (structured internal decision shape)
// ---------------------------------------------------------------------------

/**
 * Flat summary of the pre-generation context check, derived from the model's
 * evaluation output. Used by callers that need a simple decision shape rather
 * than the full discriminated union.
 */
export interface ContextEvaluation {
  hasEnoughContext: boolean;
  shouldAskQuestion: boolean;
  reason?: string;
  missingInformation?: string;
  question?: string;
  suggestedAnswers?: string[];
  contextCategory?: string;
  permanence?: "permanent" | "scene" | "temporary";
}

// ---------------------------------------------------------------------------
// Story context
// ---------------------------------------------------------------------------

export type StoryContextCategory =
  | "character"
  | "character_motivation"
  | "character_emotion"
  | "character_action"
  | "relationship"
  | "dialogue_intent"
  | "plot"
  | "backstory"
  | "setting"
  | "worldbuilding"
  | "timeline"
  | "scene_outcome"
  | "theme"
  | "style"
  | "other";

export const STORY_CONTEXT_CATEGORIES: StoryContextCategory[] = [
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
];

/**
 * How widely a piece of context applies.
 * - "story": true for the whole book (character motivations, worldbuilding…)
 * - "scene": true for the current scene/passage (a character's mood right now)
 * - "request": only for the request that produced it (one-off style asks)
 */
export type StoryContextScope = "story" | "scene" | "request";

export type StoryContextSource =
  | "author_answer"
  | "manuscript"
  | "manual_entry"
  | "resolved_conflict";

export interface StoryContextItem {
  id: string;
  /** In Wright, a document is a book — it plays the role of the project. */
  documentId: string;
  category: StoryContextCategory;
  scope: StoryContextScope;
  content: string;
  /** Names of characters this item relates to, when known. */
  characterNames: string[];
  source: StoryContextSource;
  sourceQuestion?: string;
  sourceRequestId?: string;
  /** "active" items are retrieved; "superseded" are kept for history. */
  status: "active" | "superseded";
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Clarification questions
// ---------------------------------------------------------------------------

export type ClarificationCategory =
  | "character_action"
  | "character_emotion"
  | "character_motivation"
  | "relationship"
  | "dialogue_intent"
  | "plot"
  | "backstory"
  | "setting"
  | "worldbuilding"
  | "timeline"
  | "scene_outcome"
  | "theme"
  | "style"
  | "other";

export interface SuggestedAnswer {
  id: string;
  label: string;
  description?: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  whyItMatters?: string;
  category: ClarificationCategory;
  required: boolean;
  answerType: "short_text" | "long_text" | "single_choice" | "multi_choice";
  suggestedAnswers?: SuggestedAnswer[];
  allowCustomAnswer: boolean;
}

export type ClarificationAnswerSource =
  | "author"
  | "selected_option"
  | "temporary_ai_assumption";

export interface ClarificationAnswer {
  questionId: string;
  answer: string | string[];
  source: ClarificationAnswerSource;
}

// ---------------------------------------------------------------------------
// Structured AI responses
// ---------------------------------------------------------------------------

export interface WritingAssumption {
  id: string;
  description: string;
  /** Whether the assumption meaningfully affects the story. */
  importance: "minor" | "major";
}

export interface StoryContextConflict {
  id: string;
  newStatement: string;
  existingStatement: string;
  /** Id of the stored context item (or "manuscript" for manuscript facts). */
  existingContextId: string;
  existingSource: string;
  explanation: string;
}

export interface ClarificationRequiredResponse {
  type: "clarification_required";
  requestId: string;
  reason: string;
  question: ClarificationQuestion;
  remainingQuestionCount?: number;
}

export interface GenerationReadyResponse {
  type: "generation_ready";
  requestId: string;
  /** Ids of context items that will ground the generation. */
  contextUsed: string[];
  assumptions: WritingAssumption[];
  /** Questions answered so far, for the review step. */
  questions: ClarificationQuestion[];
  answers: Record<string, ClarificationAnswer>;
}

export interface ContradictionDetectedResponse {
  type: "contradiction_detected";
  requestId: string;
  conflicts: StoryContextConflict[];
}

export interface WritingOptionsResponse {
  type: "writing_options";
  requestId: string;
  questionId: string;
  options: SuggestedAnswer[];
}

/** The request turned out to be conversation, not a writing task. */
export interface NotAWritingRequestResponse {
  type: "not_a_writing_request";
  requestId: string;
}

export type WritingAssistantResponse =
  | ClarificationRequiredResponse
  | GenerationReadyResponse
  | ContradictionDetectedResponse
  | WritingOptionsResponse
  | NotAWritingRequestResponse;

// ---------------------------------------------------------------------------
// Pending writing request
// ---------------------------------------------------------------------------

export type WritingDestination = "assistant_tab" | "document_editor";

export type DocumentGenerationAction =
  | "insert_at_cursor"
  | "replace_selection"
  | "add_below"
  | "continue"
  | "expand_selection"
  | "rewrite_selection";

export type PendingRequestStatus =
  | "evaluating"
  | "awaiting_answer"
  | "checking_conflict"
  | "ready_to_generate"
  | "generating"
  | "completed"
  | "cancelled"
  | "stale";

export interface PendingWritingRequest {
  id: string;
  documentId: string;
  originalPrompt: string;
  destination: WritingDestination;
  documentAction?: DocumentGenerationAction;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
  /** Fingerprint of the document at request time (see insertionSafety). */
  documentVersion?: string;
  writingControlMode: WritingControlMode;
  questions: ClarificationQuestion[];
  answers: Record<string, ClarificationAnswer>;
  currentQuestionIndex: number;
  status: PendingRequestStatus;
  retrievedContextIds: string[];
  assumptions: WritingAssumption[];
  conflicts: StoryContextConflict[];
  /** Map of questionId -> saved story context item id. */
  savedContextByQuestion: Record<string, string>;
  generationMeta?: GenerationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationMetadata {
  contextIds: string[];
  answerQuestionIds: string[];
  writingControlMode: WritingControlMode;
  assumptions: WritingAssumption[];
  conflictsResolved: number;
  sourceDocumentId: string;
  sourceSelection?: { start: number; end: number };
  destination: WritingDestination;
  model: string;
  promptVersion: string;
  timestamp: string;
  /** Naturalness level used for this generation, when provided. */
  naturalness?: NaturalnessLevel;
  /** Whether the post-generation AI-pattern review revised the draft. */
  draftReviewed?: boolean;
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

export type ConflictResolutionAction =
  | "keep_existing"
  | "replace_with_new"
  | "edit_new"
  | "keep_both"
  | "mark_intentional"
  | "cancel";
