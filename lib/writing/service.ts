import {
  checkAnswerContradictions,
  classifyAnswerForStorage,
  evaluateRequest,
  generateSkipOptions,
  loadRelevantContext,
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
}): Promise<{ request: PendingWritingRequest; response: WritingAssistantResponse }> {
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

  const { output, question } = await evaluateRequest({
    request,
    contextItems: items,
    manuscript,
    nearby,
    conversation: input.conversation,
  });

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
    savedContextByQuestion[question.id] = item.id;
    trackWritingEvent("context_saved", {
      requestId: request.id,
      contextId: item.id,
      category: classification.category,
      scope: classification.scope,
    });
  }

  return updateWritingRequest(request.id, {
    answers,
    savedContextByQuestion,
    conflicts: [],
  });
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

  const { output, question } = await evaluateRequest({
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
