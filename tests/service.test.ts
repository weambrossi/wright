import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PendingWritingRequest,
  StoryContextItem,
} from "@/lib/writing/types";

// In-memory doubles for the Supabase-backed stores, plus a scripted model.
const state = vi.hoisted(() => ({
  createMock: vi.fn(),
  contextItems: [] as StoryContextItem[],
  requests: new Map<string, PendingWritingRequest>(),
  idCounter: 0,
}));

vi.mock("@/lib/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: state.createMock } }),
  MODELS: { haiku: "haiku", sonnet: "sonnet", opus: "opus" },
  MODEL_BY_MODE: {},
  CLAUDE_MODEL: "sonnet",
  MAX_TOKENS: 2048,
}));

vi.mock("@/lib/writing/storyContextStore", () => {
  const nextId = () => `ctx-${++state.idCounter}`;
  return {
    listStoryContext: vi.fn(async (documentId: string) =>
      state.contextItems.filter(
        (i) => i.documentId === documentId && i.status === "active"
      )
    ),
    getStoryContextItem: vi.fn(
      async (id: string) => state.contextItems.find((i) => i.id === id) ?? null
    ),
    createStoryContext: vi.fn(async (input: Record<string, unknown>) => {
      const item = {
        id: nextId(),
        status: "active",
        characterNames: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      } as unknown as StoryContextItem;
      state.contextItems.push(item);
      return item;
    }),
    upsertAnswerContext: vi.fn(async (input: Record<string, unknown>) => {
      const existing = state.contextItems.find(
        (i) =>
          i.documentId === input.documentId &&
          i.sourceRequestId === input.sourceRequestId &&
          i.sourceQuestion === input.sourceQuestion
      );
      if (existing) {
        Object.assign(existing, {
          content: input.content,
          category: input.category,
          scope: input.scope,
          status: "active",
          updatedAt: new Date().toISOString(),
        });
        return existing;
      }
      const item = {
        id: nextId(),
        status: "active",
        characterNames: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      } as unknown as StoryContextItem;
      state.contextItems.push(item);
      return item;
    }),
    updateStoryContext: vi.fn(
      async (id: string, fields: Record<string, unknown>) => {
        const item = state.contextItems.find((i) => i.id === id)!;
        Object.assign(item, fields, { updatedAt: new Date().toISOString() });
        return item;
      }
    ),
    deleteStoryContext: vi.fn(async (id: string) => {
      state.contextItems = state.contextItems.filter((i) => i.id !== id);
    }),
    supersedeStoryContext: vi.fn(async (id: string) => {
      const item = state.contextItems.find((i) => i.id === id);
      if (item) item.status = "superseded";
    }),
  };
});

vi.mock("@/lib/writing/writingRequestStore", () => {
  return {
    createWritingRequest: vi.fn(async (input: Record<string, unknown>) => {
      const id = `req-${++state.idCounter}`;
      const request = {
        id,
        documentId: input.documentId,
        originalPrompt: input.originalPrompt,
        destination: input.destination,
        documentAction: input.documentAction,
        selectedText: input.selectedText,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        documentVersion: input.documentVersion,
        writingControlMode: input.writingControlMode,
        questions: [],
        answers: {},
        currentQuestionIndex: 0,
        status: "evaluating",
        retrievedContextIds: input.retrievedContextIds ?? [],
        assumptions: [],
        conflicts: [],
        savedContextByQuestion: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as PendingWritingRequest;
      state.requests.set(id, request);
      return request;
    }),
    getWritingRequest: vi.fn(
      async (id: string) => state.requests.get(id) ?? null
    ),
    getOpenWritingRequest: vi.fn(async (documentId: string) => {
      for (const r of state.requests.values()) {
        if (
          r.documentId === documentId &&
          ["awaiting_answer", "checking_conflict", "ready_to_generate"].includes(
            r.status
          )
        ) {
          return r;
        }
      }
      return null;
    }),
    updateWritingRequest: vi.fn(
      async (id: string, fields: Record<string, unknown>) => {
        const request = state.requests.get(id)!;
        Object.assign(request, fields, {
          updatedAt: new Date().toISOString(),
        });
        return request;
      }
    ),
  };
});

import {
  startWritingFlow,
  submitAnswer,
  skipQuestion,
  resolveConflict,
  cancelRequest,
} from "@/lib/writing/service";

function modelReply(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

const clarificationReply = modelReply({
  decision: "needs_clarification",
  reason: "Missing emotion",
  question: {
    question: "How does Naomi feel when she sees Daniel again?",
    whyItMatters: "It defines the tone of the reunion.",
    category: "character_emotion",
    answerType: "single_choice",
    suggestedAnswers: [
      { label: "Relieved, but trying not to show it" },
      { label: "Angry that he returned without warning" },
    ],
  },
  remainingQuestionCount: 0,
});

const readyReply = modelReply({ decision: "ready", assumptions: [] });
const noConflicts = modelReply({ conflicts: [] });
const classification = modelReply({
  category: "character_emotion",
  scope: "scene",
  characterNames: ["Naomi"],
  canonicalStatement:
    "In this scene, Naomi is relieved to see Daniel but tries not to show it.",
});

function startInput(overrides: Record<string, unknown> = {}) {
  return {
    create: {
      documentId: "doc-1",
      originalPrompt: "Write the scene where Naomi sees Daniel again.",
      destination: "assistant_tab" as const,
      writingControlMode: "ask_me_first" as const,
      ...overrides,
    },
    manuscriptText: "Naomi froze at the doorway.",
    conversation: [],
  };
}

beforeEach(() => {
  state.createMock.mockReset();
  state.contextItems = [];
  state.requests.clear();
  state.idCounter = 0;
});

describe("startWritingFlow", () => {
  it("asks a clarification question when required info is missing", async () => {
    state.createMock.mockResolvedValueOnce(clarificationReply);
    const { request, response } = await startWritingFlow(startInput());
    expect(response.type).toBe("clarification_required");
    expect(request.status).toBe("awaiting_answer");
    expect(request.questions).toHaveLength(1);
    // Question ids are server-assigned.
    expect(request.questions[0].id).toBeTruthy();
  });

  it("goes straight to generation_ready for a complete prompt (no unnecessary questions)", async () => {
    state.createMock.mockResolvedValueOnce(readyReply);
    const { request, response } = await startWritingFlow(startInput());
    expect(response.type).toBe("generation_ready");
    expect(request.status).toBe("ready_to_generate");
    expect(request.questions).toHaveLength(0);
  });

  it("returns not_a_writing_request for ordinary conversation", async () => {
    state.createMock.mockResolvedValueOnce(
      modelReply({ decision: "not_a_writing_request" })
    );
    const { response } = await startWritingFlow(startInput());
    expect(response.type).toBe("not_a_writing_request");
  });
});

describe("submitAnswer", () => {
  async function startWithQuestion() {
    state.createMock.mockResolvedValueOnce(clarificationReply);
    const { request } = await startWritingFlow(startInput());
    return request;
  }

  it("saves the answer as persistent story context and advances", async () => {
    const request = await startWithQuestion();
    // conflict check → none, classification, re-evaluation → ready
    state.createMock
      .mockResolvedValueOnce(noConflicts)
      .mockResolvedValueOnce(classification)
      .mockResolvedValueOnce(readyReply);

    const { response } = await submitAnswer({
      requestId: request.id,
      questionId: request.questions[0].id,
      answer: "Relieved, but trying not to show it",
      source: "selected_option",
      manuscriptText: "Naomi froze at the doorway.",
    });

    expect(response.type).toBe("generation_ready");
    expect(state.contextItems).toHaveLength(1);
    expect(state.contextItems[0].category).toBe("character_emotion");
    expect(state.contextItems[0].source).toBe("author_answer");
    expect(state.contextItems[0].sourceRequestId).toBe(request.id);
  });

  it("does not duplicate context records when the same answer is submitted twice", async () => {
    const request = await startWithQuestion();
    state.createMock
      .mockResolvedValueOnce(noConflicts)
      .mockResolvedValueOnce(classification)
      .mockResolvedValueOnce(readyReply)
      .mockResolvedValueOnce(noConflicts)
      .mockResolvedValueOnce(classification)
      .mockResolvedValueOnce(readyReply);

    const args = {
      requestId: request.id,
      questionId: request.questions[0].id,
      answer: "Relieved, but trying not to show it",
      source: "selected_option" as const,
      manuscriptText: "",
    };
    await submitAnswer(args);
    await submitAnswer(args); // duplicate / edit
    expect(state.contextItems).toHaveLength(1);
  });

  it("does NOT store temporary AI assumptions as permanent canon", async () => {
    const request = await startWithQuestion();
    state.createMock
      .mockResolvedValueOnce(noConflicts)
      .mockResolvedValueOnce(readyReply);

    await submitAnswer({
      requestId: request.id,
      questionId: request.questions[0].id,
      answer: "Numb (temporary assumption — not confirmed canon)",
      source: "temporary_ai_assumption",
      manuscriptText: "",
    });
    expect(state.contextItems).toHaveLength(0);
    const updated = state.requests.get(request.id)!;
    expect(updated.answers[request.questions[0].id].source).toBe(
      "temporary_ai_assumption"
    );
  });

  it("flags contradictions instead of overwriting existing context", async () => {
    // Seed established canon.
    state.contextItems.push({
      id: "ctx-existing",
      documentId: "doc-1",
      category: "relationship",
      scope: "story",
      content: "Naomi and Daniel were married for ten years.",
      characterNames: ["Naomi", "Daniel"],
      source: "author_answer",
      sourceQuestion: "How do Naomi and Daniel know each other?",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const request = await startWithQuestion();
    state.createMock.mockResolvedValueOnce(
      modelReply({
        conflicts: [
          {
            newStatement: "Naomi has never met Daniel.",
            existingStatement: "Naomi and Daniel were married for ten years.",
            existingContextId: "ctx-existing",
            explanation: "Strangers cannot have been married.",
          },
        ],
      })
    );

    const { request: updated, response } = await submitAnswer({
      requestId: request.id,
      questionId: request.questions[0].id,
      answer: "Naomi has never met Daniel.",
      source: "author",
      manuscriptText: "",
    });

    expect(response.type).toBe("contradiction_detected");
    expect(updated.status).toBe("checking_conflict");
    // Existing canon untouched, new answer not yet saved as context.
    expect(state.contextItems).toHaveLength(1);
    expect(state.contextItems[0].content).toBe(
      "Naomi and Daniel were married for ten years."
    );
  });

  it("rejects answers for cancelled requests", async () => {
    const request = await startWithQuestion();
    await cancelRequest(request.id);
    await expect(
      submitAnswer({
        requestId: request.id,
        questionId: request.questions[0].id,
        answer: "anything",
        source: "author",
        manuscriptText: "",
      })
    ).rejects.toThrow(/no longer active/);
  });
});

describe("skipQuestion", () => {
  it("offers options instead of silently inventing an answer", async () => {
    state.createMock.mockResolvedValueOnce(clarificationReply);
    const { request } = await startWritingFlow(startInput());

    state.createMock.mockResolvedValueOnce(
      modelReply({
        options: [
          { label: "Relieved, but trying not to show it" },
          { label: "Emotionally numb" },
          { label: "Hopeful and suspicious at the same time" },
        ],
      })
    );
    const { response } = await skipQuestion({
      requestId: request.id,
      questionId: request.questions[0].id,
      manuscriptText: "",
    });
    expect(response.type).toBe("writing_options");
    if (response.type === "writing_options") {
      expect(response.options.length).toBeGreaterThanOrEqual(2);
    }
    // No context was invented or stored.
    expect(state.contextItems).toHaveLength(0);
  });
});

describe("resolveConflict", () => {
  async function reachConflict() {
    state.contextItems.push({
      id: "ctx-existing",
      documentId: "doc-1",
      category: "relationship",
      scope: "story",
      content: "Naomi and Daniel were married for ten years.",
      characterNames: ["Naomi", "Daniel"],
      source: "author_answer",
      sourceQuestion: "How do Naomi and Daniel know each other?",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    state.createMock.mockResolvedValueOnce(clarificationReply);
    const { request } = await startWritingFlow(startInput());
    state.createMock.mockResolvedValueOnce(
      modelReply({
        conflicts: [
          {
            newStatement: "Naomi has never met Daniel.",
            existingStatement: "Naomi and Daniel were married for ten years.",
            existingContextId: "ctx-existing",
            explanation: "Strangers cannot have been married.",
          },
        ],
      })
    );
    const { request: updated } = await submitAnswer({
      requestId: request.id,
      questionId: request.questions[0].id,
      answer: "Naomi has never met Daniel.",
      source: "author",
      manuscriptText: "",
    });
    return updated;
  }

  it("replace_with_new supersedes the old context and saves the answer", async () => {
    const request = await reachConflict();
    state.createMock
      .mockResolvedValueOnce(classification) // classify new answer
      .mockResolvedValueOnce(readyReply); // re-evaluate

    const { response } = await resolveConflict({
      requestId: request.id,
      conflictId: request.conflicts[0].id,
      action: "replace_with_new",
      manuscriptText: "",
    });
    expect(response.type).toBe("generation_ready");
    const old = state.contextItems.find((i) => i.id === "ctx-existing")!;
    expect(old.status).toBe("superseded");
    // The new answer is now stored.
    expect(
      state.contextItems.some((i) => i.sourceRequestId === request.id)
    ).toBe(true);
  });

  it("keep_existing discards the new answer and re-asks the question", async () => {
    const request = await reachConflict();
    const { request: updated, response } = await resolveConflict({
      requestId: request.id,
      conflictId: request.conflicts[0].id,
      action: "keep_existing",
      manuscriptText: "",
    });
    expect(response.type).toBe("clarification_required");
    expect(updated.answers[request.questions[0].id]).toBeUndefined();
    const old = state.contextItems.find((i) => i.id === "ctx-existing")!;
    expect(old.status).toBe("active");
  });

  it("keep_both stores the new answer while keeping the old context active", async () => {
    const request = await reachConflict();
    state.createMock
      .mockResolvedValueOnce(classification)
      .mockResolvedValueOnce(readyReply);
    const { response } = await resolveConflict({
      requestId: request.id,
      conflictId: request.conflicts[0].id,
      action: "keep_both",
      manuscriptText: "",
    });
    expect(response.type).toBe("generation_ready");
    const old = state.contextItems.find((i) => i.id === "ctx-existing")!;
    expect(old.status).toBe("active");
    expect(state.contextItems.length).toBe(2);
  });

  it("cancel abandons the request without touching context", async () => {
    const request = await reachConflict();
    const { request: updated } = await resolveConflict({
      requestId: request.id,
      conflictId: request.conflicts[0].id,
      action: "cancel",
      manuscriptText: "",
    });
    expect(updated.status).toBe("cancelled");
    expect(state.contextItems).toHaveLength(1);
  });
});

describe("context isolation", () => {
  it("only retrieves context belonging to the current document", async () => {
    state.contextItems.push(
      {
        id: "ctx-mine",
        documentId: "doc-1",
        category: "plot",
        scope: "story",
        content: "The heist happens at midnight.",
        characterNames: [],
        source: "author_answer",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "ctx-other-book",
        documentId: "doc-OTHER",
        category: "plot",
        scope: "story",
        content: "The dragon dies in chapter three.",
        characterNames: [],
        source: "author_answer",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }
    );
    state.createMock.mockResolvedValueOnce(readyReply);
    const { request } = await startWritingFlow(startInput());
    expect(request.retrievedContextIds).toContain("ctx-mine");
    expect(request.retrievedContextIds).not.toContain("ctx-other-book");
  });
});
