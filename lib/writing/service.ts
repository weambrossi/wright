import {
  checkAnswerContradictions,
  classifyAnswerForStorage,
  evaluateRequest,
  generateSkipOptions,
  loadRelevantContext,
  type EvaluationResult,
} from "./orchestrator";
import {
  createWritingRequest,
  getWritingRequest,
  updateWritingRequest,
  type CreateWritingRequestInput,
} from "./writingRequestStore";
import {
  getStoryContextItem,
  supersedeStoryContext,
  upsertAnswerContext,
  updateStoryContext,
} from "./storyContextStore";
import { trackWritingEvent } from "./analytics";
import type {
  ClarificationAnswer,
  ClarificationAnswerSource,
  ClarificationQuestion,
  ConflictResolutionAction,
  PendingWritingRequest,
  StoryContextItem,
  WritingAssistantResponse,
} from "./types";

// Service layer for the writing workflow: each function advances a pending
// request through its state machine and returns the structured response the
// client renders. Routes stay thin; UI never talks to the model directly.

export class WritingFlowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function requireRequest(id: string): Promise<PendingWritingRequest> {
  const request = await getWritingRequest(id);
  if (!request) throw new WritingFlowError("Writing request not found", 404);
  return request;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startWritingFlow(input: {
  create: Omit<CreateWritingRequestInput, "retrievedContextIds">;
  manuscriptText: string;
  conversation: { role: "user" | "assistant"; content: string }[];
  /**
   * When false, Wright never pauses to ask: clarification decisions are
   * converted into flagged assumptions and generation proceeds immediately.
   * Those assumptions are never saved as confirmed story context.
   */
  askQuestions?: boolean;
}): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  const askQuestions = input.askQuestions ?? true;
  const { items, manuscript, nearby } = await loadRelevantContext({
    documentId: input.create.documentId,
    prompt: input.create.originalPrompt,
    selectedText: input.create.selectedText,
    manuscriptText: input.manuscriptText,
  });

  let request = await createWritingRequest({
    ...input.create,
    retrievedContextIds: items.map((i) => i.id),
  });

  let { output, question } = await evaluateSafely({
    // With questions disabled, evaluate as draft_freely so the model prefers
    // reasonable choices over clarification in the first place.
    request: askQuestions
      ? request
      : { ...request, writingControlMode: "draft_freely" },
    contextItems: items,
    manuscript,
    nearby,
    conversation: input.conversation,
  });

  if (askQuestions === false && output.decision === "needs_clarification") {
    // Convert the would-be question into a flagged assumption; never block.
    output = {
      decision: "ready",
      assumptions: [
        {
          description: `Proceeded without asking: ${output.reason}. Wright made a reasonable choice for "${output.question.question}" — not saved as story canon.`,
          importance: "major",
        },
      ],
    };
    question = undefined;
    trackWritingEvent("questions_disabled_generation", {
      requestId: request.id,
    });
  }

  if (output.decision === "not_a_writing_request") {
    request = await updateWritingRequest(request.id, { status: "completed" });
    return {
      request,
      response: { type: "not_a_writing_request", requestId: request.id },
    };
  }

  if (output.decision === "needs_clarification" && question) {
    request = await updateWritingRequest(request.id, {
      status: "awaiting_answer",
      questions: [question],
      currentQuestionIndex: 0,
    });
    trackWritingEvent("clarification_requested", {
      requestId: request.id,
      category: question.category,
      mode: request.writingControlMode,
      destination: request.destination,
    });
    return {
      request,
      response: {
        type: "clarification_required",
        requestId: request.id,
        reason: output.reason,
        question,
        remainingQuestionCount: output.remainingQuestionCount,
      },
    };
  }

  // Ready right away.
  const assumptions = (output.decision === "ready" ? output.assumptions : []).map(
    (a, i) => ({ id: `assumption-${i}`, ...a })
  );
  request = await updateWritingRequest(request.id, {
    status: "ready_to_generate",
    assumptions,
  });
  return {
    request,
    response: {
      type: "generation_ready",
      requestId: request.id,
      contextUsed: request.retrievedContextIds,
      assumptions,
      questions: [],
      answers: {},
    },
  };
}

/**
 * Context evaluation must never block the author: if the model call fails,
 * treat the request as ready and let generation continue normally.
 */
async function evaluateSafely(
  input: Parameters<typeof evaluateRequest>[0]
): Promise<EvaluationResult> {
  try {
    return await evaluateRequest(input);
  } catch {
    trackWritingEvent("evaluation_failed_fallback", {
      requestId: input.request.id,
    });
    return { output: { decision: "ready", assumptions: [] } };
  }
}

// ---------------------------------------------------------------------------
// Answer submission (new answers and edits alike)
// ---------------------------------------------------------------------------

export async function submitAnswer(input: {
  requestId: string;
  questionId: string;
  answer: string | string[];
  source: ClarificationAnswerSource;
  manuscriptText: string;
}): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  let request = await requireRequest(input.requestId);
  assertRequestOpen(request);

  const question = request.questions.find((q) => q.id === input.questionId);
  if (!question) throw new WritingFlowError("Unknown question for this request");

  const isEdit = Boolean(request.answers[input.questionId]);
  const answerText = Array.isArray(input.answer)
    ? input.answer.join("; ")
    : input.answer;

  const { items, nearby } = await loadRelevantContext({
    documentId: request.documentId,
    prompt: request.originalPrompt,
    selectedText: request.selectedText,
    manuscriptText: input.manuscriptText,
  });

  // Contradiction gate — never silently overwrite existing canon.
  const conflicts = await checkAnswerContradictions({
    question,
    answerText,
    contextItems: items,
    nearby,
  });

  const answer: ClarificationAnswer = {
    questionId: question.id,
    answer: input.answer,
    source: input.source,
  };

  if (conflicts.length > 0) {
    request = await updateWritingRequest(request.id, {
      status: "checking_conflict",
      answers: { ...request.answers, [question.id]: answer },
      conflicts,
      // Pin the question under conflict so resolution targets the right
      // answer even when the author was editing an earlier one.
      currentQuestionIndex: request.questions.findIndex(
        (q) => q.id === question.id
      ),
    });
    trackWritingEvent("contradiction_detected", {
      requestId: request.id,
      conflictCount: conflicts.length,
    });
    return {
      request,
      response: {
        type: "contradiction_detected",
        requestId: request.id,
        conflicts,
      },
    };
  }

  trackWritingEvent(
    isEdit
      ? "question_edited"
      : input.source === "selected_option"
      ? "suggested_answer_selected"
      : "custom_answer_submitted",
    { requestId: request.id, category: question.category }
  );

  request = await persistAnswer(request, question, answer, answerText);
  return advanceFlow(request, input.manuscriptText);
}

/**
 * Save the approved answer into persistent story context (idempotent per
 * request+question, so edits and duplicate submissions update in place) and
 * record it on the request.
 */
async function persistAnswer(
  request: PendingWritingRequest,
  question: ClarificationQuestion,
  answer: ClarificationAnswer,
  answerText: string
): Promise<PendingWritingRequest> {
  const answers = { ...request.answers, [question.id]: answer };
  const savedContextByQuestion = { ...request.savedContextByQuestion };

  // Temporary assumptions are labeled on the request but are NOT stored as
  // permanent canon unless the author later accepts them via the context UI.
  if (answer.source !== "temporary_ai_assumption") {
    const item = await saveContextAnswer({ request, question, answerText });
    savedContextByQuestion[question.id] = item.id;
  }

  return updateWritingRequest(request.id, {
    answers,
    savedContextByQuestion,
    conflicts: [],
  });
}

/**
 * Classify an approved author answer and save it into the existing story
 * context store (idempotent per request+question). Durable facts land with
 * scope "story"; scene moods stay scoped to the scene; one-off style asks
 * stay scoped to the request, so temporary details never silently become
 * permanent canon.
 */
export async function saveContextAnswer(input: {
  request: PendingWritingRequest;
  question: ClarificationQuestion;
  answerText: string;
}): Promise<StoryContextItem> {
  const { request, question, answerText } = input;
  const classification = await classifyAnswerForStorage({
    question,
    answerText,
    prompt: request.originalPrompt,
  });
  const item = await upsertAnswerContext({
    documentId: request.documentId,
    category: classification.category,
    scope: classification.scope,
    content: classification.canonicalStatement,
    characterNames: classification.characterNames,
    source: "author_answer",
    sourceQuestion: question.question,
    sourceRequestId: request.id,
  });
  trackWritingEvent("context_saved", {
    requestId: request.id,
    contextId: item.id,
    category: classification.category,
    scope: classification.scope,
  });
  return item;
}

/** Re-evaluate: does the model need another question, or can it write? */
async function advanceFlow(
  request: PendingWritingRequest,
  manuscriptText: string
): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  const { items, manuscript, nearby } = await loadRelevantContext({
    documentId: request.documentId,
    prompt: request.originalPrompt,
    selectedText: request.selectedText,
    manuscriptText,
  });

  const { output, question } = await evaluateSafely({
    request,
    contextItems: items,
    manuscript,
    nearby,
    conversation: [],
  });

  if (output.decision === "needs_clarification" && question) {
    const questions = [...request.questions, question];
    const updated = await updateWritingRequest(request.id, {
      status: "awaiting_answer",
      questions,
      currentQuestionIndex: questions.length - 1,
    });
    trackWritingEvent("clarification_requested", {
      requestId: request.id,
      category: question.category,
      mode: request.writingControlMode,
    });
    return {
      request: updated,
      response: {
        type: "clarification_required",
        requestId: request.id,
        reason: output.reason,
        question,
        remainingQuestionCount: output.remainingQuestionCount,
      },
    };
  }

  const assumptions = (output.decision === "ready" ? output.assumptions : []).map(
    (a, i) => ({ id: `assumption-${i}`, ...a })
  );
  const updated = await updateWritingRequest(request.id, {
    status: "ready_to_generate",
    assumptions,
  });
  return {
    request: updated,
    response: {
      type: "generation_ready",
      requestId: request.id,
      contextUsed: updated.retrievedContextIds,
      assumptions,
      questions: updated.questions,
      answers: updated.answers,
    },
  };
}

// ---------------------------------------------------------------------------
// Skip: offer options instead of silently inventing an answer
// ---------------------------------------------------------------------------

export async function skipQuestion(input: {
  requestId: string;
  questionId: string;
  manuscriptText: string;
}): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  const request = await requireRequest(input.requestId);
  assertRequestOpen(request);
  const question = request.questions.find((q) => q.id === input.questionId);
  if (!question) throw new WritingFlowError("Unknown question for this request");

  const { items, nearby } = await loadRelevantContext({
    documentId: request.documentId,
    prompt: request.originalPrompt,
    selectedText: request.selectedText,
    manuscriptText: input.manuscriptText,
  });

  const options = await generateSkipOptions({
    question,
    prompt: request.originalPrompt,
    contextItems: items,
    nearby,
  });

  trackWritingEvent("question_skipped", {
    requestId: request.id,
    category: question.category,
  });

  return {
    request,
    response: {
      type: "writing_options",
      requestId: request.id,
      questionId: question.id,
      options,
    },
  };
}

// ---------------------------------------------------------------------------
// Proceed: "Generate without answering"
// ---------------------------------------------------------------------------

/**
 * The author chose to generate without answering the open question(s).
 * Unanswered questions become flagged major assumptions — Wright makes a
 * reasonable choice for each, but nothing is saved as confirmed story
 * context. The request goes straight to ready_to_generate.
 */
export async function proceedWithoutAnswering(
  requestId: string
): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  let request = await requireRequest(requestId);
  assertRequestOpen(request);

  const unanswered = request.questions.filter((q) => !request.answers[q.id]);
  const newAssumptions = unanswered.map((q, i) => ({
    id: `skip-assumption-${request.questions.indexOf(q)}-${i}`,
    description: `The author generated without answering "${q.question}". Wright will make a reasonable choice — not saved as story canon.`,
    importance: "major" as const,
  }));

  request = await updateWritingRequest(request.id, {
    status: "ready_to_generate",
    assumptions: [...request.assumptions, ...newAssumptions],
    conflicts: [],
  });
  trackWritingEvent("generated_without_answering", {
    requestId: request.id,
    unansweredCount: unanswered.length,
  });

  return {
    request,
    response: {
      type: "generation_ready",
      requestId: request.id,
      contextUsed: request.retrievedContextIds,
      assumptions: request.assumptions,
      // Empty question list signals the client to generate immediately.
      questions: [],
      answers: {},
    },
  };
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

export async function resolveConflict(input: {
  requestId: string;
  conflictId: string;
  action: ConflictResolutionAction;
  editedAnswer?: string;
  manuscriptText: string;
}): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
  let request = await requireRequest(input.requestId);
  if (request.status !== "checking_conflict") {
    throw new WritingFlowError("This request has no pending contradiction");
  }
  const conflict = request.conflicts.find((c) => c.id === input.conflictId);
  if (!conflict) throw new WritingFlowError("Unknown conflict");

  // The answer awaiting resolution is the current question's answer.
  const question = request.questions[request.currentQuestionIndex];
  const answer = question ? request.answers[question.id] : undefined;
  if (!question || !answer) {
    throw new WritingFlowError("No pending answer to resolve");
  }

  trackWritingEvent("contradiction_resolved", {
    requestId: request.id,
    action: input.action,
  });

  if (input.action === "cancel") {
    request = await updateWritingRequest(request.id, {
      status: "cancelled",
      conflicts: [],
    });
    return {
      request,
      response: { type: "not_a_writing_request", requestId: request.id },
    };
  }

  if (input.action === "keep_existing") {
    // Discard the new answer; re-ask by returning the same question.
    const answers = { ...request.answers };
    delete answers[question.id];
    request = await updateWritingRequest(request.id, {
      status: "awaiting_answer",
      answers,
      conflicts: [],
    });
    return {
      request,
      response: {
        type: "clarification_required",
        requestId: request.id,
        reason:
          "You kept the existing story context. Answer again with something consistent, or skip.",
        question,
      },
    };
  }

  if (input.action === "edit_new") {
    if (!input.editedAnswer?.trim()) {
      throw new WritingFlowError("An edited answer is required");
    }
    // Re-run the full answer pipeline (including a fresh contradiction check).
    request = await updateWritingRequest(request.id, {
      status: "awaiting_answer",
      conflicts: [],
    });
    return submitAnswer({
      requestId: request.id,
      questionId: question.id,
      answer: input.editedAnswer,
      source: "author",
      manuscriptText: input.manuscriptText,
    });
  }

  // replace_with_new | keep_both | mark_intentional → the new answer stands.
  if (
    input.action === "replace_with_new" &&
    conflict.existingContextId !== "manuscript"
  ) {
    await supersedeStoryContext(conflict.existingContextId);
  }
  if (
    input.action === "mark_intentional" &&
    conflict.existingContextId !== "manuscript"
  ) {
    const existing = await getStoryContextItem(conflict.existingContextId);
    if (existing && existing.documentId === request.documentId) {
      await updateStoryContext(existing.id, {
        content: `${existing.content} (The author confirmed this coexists intentionally with: "${conflict.newStatement}")`,
      });
    }
  }

  const answerText = Array.isArray(answer.answer)
    ? answer.answer.join("; ")
    : answer.answer;
  const remaining = request.conflicts.filter((c) => c.id !== conflict.id);
  if (remaining.length > 0) {
    request = await updateWritingRequest(request.id, { conflicts: remaining });
    return {
      request,
      response: {
        type: "contradiction_detected",
        requestId: request.id,
        conflicts: remaining,
      },
    };
  }

  request = await persistAnswer(request, question, answer, answerText);
  return advanceFlow(request, input.manuscriptText);
}

// ---------------------------------------------------------------------------
// Cancel / reopen helpers
// ---------------------------------------------------------------------------

export async function cancelRequest(
  requestId: string
): Promise<PendingWritingRequest> {
  const request = await requireRequest(requestId);
  trackWritingEvent("pending_request_cancelled", { requestId });
  return updateWritingRequest(requestId, { status: "cancelled" });
}

function assertRequestOpen(request: PendingWritingRequest): void {
  if (
    request.status === "cancelled" ||
    request.status === "completed" ||
    request.status === "stale"
  ) {
    throw new WritingFlowError(
      "This writing request is no longer active",
      409
    );
  }
}
