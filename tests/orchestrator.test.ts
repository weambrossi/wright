import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingWritingRequest } from "@/lib/writing/types";

const createMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: createMock } }),
  MODELS: { haiku: "haiku", sonnet: "sonnet", opus: "opus" },
  MODEL_BY_MODE: {},
  CLAUDE_MODEL: "sonnet",
  MAX_TOKENS: 2048,
}));

import {
  evaluateRequest,
  checkAnswerContradictions,
  classifyAnswerForStorage,
  generateSkipOptions,
  fallbackScope,
  MAX_QUESTIONS_PER_REQUEST,
} from "@/lib/writing/orchestrator";

function modelReply(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

function makeRequest(
  overrides: Partial<PendingWritingRequest> = {}
): PendingWritingRequest {
  return {
    id: "req-1",
    documentId: "doc-1",
    originalPrompt: "Write the confrontation scene.",
    destination: "assistant_tab",
    writingControlMode: "ask_me_first",
    questions: [],
    answers: {},
    currentQuestionIndex: 0,
    status: "evaluating",
    retrievedContextIds: [],
    assumptions: [],
    conflicts: [],
    savedContextByQuestion: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const question = {
  id: "q-known",
  question: "What does Elena want Marcus to admit?",
  category: "character_motivation" as const,
  required: true,
  answerType: "short_text" as const,
  allowCustomAnswer: true,
};

beforeEach(() => {
  createMock.mockReset();
});

describe("evaluateRequest", () => {
  it("returns a server-id'd question when clarification is needed", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        decision: "needs_clarification",
        reason: "Missing motivation",
        question: {
          question: "What does Elena want Marcus to admit?",
          whyItMatters: "It shapes the whole conversation.",
          category: "character_motivation",
          answerType: "single_choice",
          suggestedAnswers: [{ label: "That he lied about the letter" }],
        },
        remainingQuestionCount: 1,
      })
    );
    const result = await evaluateRequest({
      request: makeRequest(),
      contextItems: [],
      manuscript: "",
      nearby: "",
      conversation: [],
    });
    expect(result.output.decision).toBe("needs_clarification");
    expect(result.question?.id).toBeTruthy();
    expect(result.question?.suggestedAnswers?.[0].id).toBeTruthy();
    expect(result.question?.allowCustomAnswer).toBe(true);
  });

  it("returns ready with assumptions when context suffices", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        decision: "ready",
        assumptions: [{ description: "It is evening", importance: "minor" }],
      })
    );
    const result = await evaluateRequest({
      request: makeRequest(),
      contextItems: [],
      manuscript: "",
      nearby: "",
      conversation: [],
    });
    expect(result.output.decision).toBe("ready");
  });

  it("guards against the model repeating an equivalent question", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        decision: "needs_clarification",
        reason: "Missing motivation",
        question: {
          question: "What does Elena want Marcus to admit?",
          category: "character_motivation",
          answerType: "short_text",
        },
      })
    );
    const result = await evaluateRequest({
      request: makeRequest({ questions: [question] }),
      contextItems: [],
      manuscript: "",
      nearby: "",
      conversation: [],
    });
    expect(result.output.decision).toBe("ready");
  });

  it("caps the number of questions per request", async () => {
    const many = Array.from({ length: MAX_QUESTIONS_PER_REQUEST }, (_, i) => ({
      ...question,
      id: `q-${i}`,
      question: `Question number ${i}?`,
    }));
    createMock.mockResolvedValueOnce(
      modelReply({
        decision: "needs_clarification",
        reason: "One more",
        question: {
          question: "A brand new question?",
          category: "plot",
          answerType: "short_text",
        },
      })
    );
    const result = await evaluateRequest({
      request: makeRequest({ questions: many }),
      contextItems: [],
      manuscript: "",
      nearby: "",
      conversation: [],
    });
    expect(result.output.decision).toBe("ready");
  });

  it("retries once on invalid structured output, then fails safely", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "I think you should just write it." }],
    });
    await expect(
      evaluateRequest({
        request: makeRequest(),
        contextItems: [],
        manuscript: "",
        nearby: "",
        conversation: [],
      })
    ).rejects.toThrow(/invalid structured response/);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe("checkAnswerContradictions", () => {
  it("returns no conflicts without calling the model when nothing is established", async () => {
    const conflicts = await checkAnswerContradictions({
      question,
      answerText: "Elena has never met Marcus.",
      contextItems: [],
      nearby: "",
    });
    expect(conflicts).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("maps model conflicts onto known context items with readable sources", async () => {
    const item = {
      id: "ctx-1",
      documentId: "doc-1",
      category: "relationship" as const,
      scope: "story" as const,
      content: "Elena and Marcus attended school together for five years.",
      characterNames: ["Elena", "Marcus"],
      source: "author_answer" as const,
      sourceQuestion: "How do Elena and Marcus know each other?",
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    createMock.mockResolvedValueOnce(
      modelReply({
        conflicts: [
          {
            newStatement: "Elena has never met Marcus before this scene.",
            existingStatement:
              "Elena and Marcus attended school together for five years.",
            existingContextId: "ctx-1",
            explanation:
              "They can't both be strangers and old schoolmates — unless Elena is pretending.",
          },
        ],
      })
    );
    const conflicts = await checkAnswerContradictions({
      question,
      answerText: "Elena has never met Marcus before this scene.",
      contextItems: [item],
      nearby: "",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existingContextId).toBe("ctx-1");
    expect(conflicts[0].existingSource).toContain(
      "How do Elena and Marcus know each other?"
    );
    expect(conflicts[0].id).toBeTruthy();
  });
});

describe("generateSkipOptions", () => {
  it("returns id'd options", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        options: [
          { label: "Confront Elena immediately" },
          { label: "Hide that he found it" },
          { label: "Leave without saying anything" },
        ],
      })
    );
    const options = await generateSkipOptions({
      question,
      prompt: "Write what Marcus does next",
      contextItems: [],
      nearby: "",
    });
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.id)).toBe(true);
  });
});

describe("classifyAnswerForStorage", () => {
  it("uses the model classification when valid", async () => {
    createMock.mockResolvedValueOnce(
      modelReply({
        category: "character_motivation",
        scope: "story",
        characterNames: ["Elena"],
        canonicalStatement: "Elena wants Marcus to admit he lied.",
      })
    );
    const result = await classifyAnswerForStorage({
      question,
      answerText: "She wants him to admit he lied",
      prompt: "Write the scene",
    });
    expect(result.category).toBe("character_motivation");
    expect(result.characterNames).toEqual(["Elena"]);
  });

  it("falls back deterministically when the model fails, so the answer is never lost", async () => {
    createMock.mockRejectedValue(new Error("model down"));
    const result = await classifyAnswerForStorage({
      question: { ...question, category: "character_emotion" },
      answerText: "Angry but hiding it",
      prompt: "Write the scene",
    });
    expect(result.category).toBe("character_emotion");
    expect(result.scope).toBe("scene");
    expect(result.canonicalStatement).toContain("Angry but hiding it");
  });
});

describe("fallbackScope", () => {
  it("maps scene-ish categories to scene and style to request", () => {
    expect(fallbackScope("character_emotion")).toBe("scene");
    expect(fallbackScope("scene_outcome")).toBe("scene");
    expect(fallbackScope("style")).toBe("request");
    expect(fallbackScope("worldbuilding")).toBe("story");
    expect(fallbackScope("character_motivation")).toBe("story");
  });
});
