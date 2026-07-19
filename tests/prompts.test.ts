import { describe, expect, it } from "vitest";
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  modeInstructions,
} from "@/lib/writing/prompts";
import type { PendingWritingRequest } from "@/lib/writing/types";

function makeRequest(
  overrides: Partial<PendingWritingRequest> = {}
): PendingWritingRequest {
  return {
    id: "req-1",
    documentId: "doc-1",
    originalPrompt: "Write the scene where Naomi sees Daniel again.",
    destination: "assistant_tab",
    writingControlMode: "ask_me_first",
    questions: [],
    answers: {},
    currentQuestionIndex: 0,
    status: "ready_to_generate",
    retrievedContextIds: [],
    assumptions: [],
    conflicts: [],
    savedContextByQuestion: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mode instructions", () => {
  it("differ per writing control mode", () => {
    const ask = modeInstructions("ask_me_first");
    const suggest = modeInstructions("suggest_options");
    const free = modeInstructions("draft_freely");
    expect(ask).toContain("clarification over creative assumptions");
    expect(suggest).toContain("Do not choose an important direction");
    expect(free).toContain("reasonable creative decisions");
    expect(new Set([ask, suggest, free]).size).toBe(3);
  });
});

describe("evaluation prompts", () => {
  it("embed previously asked questions so the model never repeats them", () => {
    const prompt = buildEvaluationUserPrompt({
      prompt: "Continue the scene",
      manuscript: "Naomi opened the door.",
      nearby: "Naomi opened the door.",
      contextItems: [],
      conversation: [],
      answeredSoFar: [
        { question: "How does Naomi feel?", answer: "Angry but hiding it" },
      ],
      previouslyAskedQuestions: ["How does Naomi feel?"],
    });
    expect(prompt).toContain("How does Naomi feel?");
    expect(prompt).toContain("Angry but hiding it");
    expect(prompt).toContain("never re-ask");
  });

  it("system prompt tells the model not to write yet", () => {
    const system = buildEvaluationSystemPrompt("ask_me_first");
    expect(system).toContain("Your task right now is NOT to write");
    expect(system).toContain("not_a_writing_request");
  });
});

describe("generation prompts", () => {
  it("include author answers and label temporary assumptions", () => {
    const request = makeRequest({
      questions: [
        {
          id: "q1",
          question: "What should Marcus do after reading the letter?",
          category: "character_action",
          required: true,
          answerType: "short_text",
          allowCustomAnswer: true,
        },
        {
          id: "q2",
          question: "Where does the scene take place?",
          category: "setting",
          required: true,
          answerType: "short_text",
          allowCustomAnswer: true,
        },
      ],
      answers: {
        q1: {
          questionId: "q1",
          answer: "Hide that he found it",
          source: "selected_option",
        },
        q2: {
          questionId: "q2",
          answer: "An abandoned train station (temporary assumption — not confirmed canon)",
          source: "temporary_ai_assumption",
        },
      },
    });
    const prompt = buildGenerationUserPrompt({
      request,
      contextItems: [],
      manuscript: "The letter sat on the table.",
      nearby: "The letter sat on the table.",
    });
    expect(prompt).toContain("Hide that he found it");
    expect(prompt).toContain("temporary AI assumption");
    expect(prompt).toContain("The letter sat on the table.");
  });

  it("never contain clarification UI copy", () => {
    const system = buildGenerationSystemPrompt("suggest_options");
    const prompt = buildGenerationUserPrompt({
      request: makeRequest(),
      contextItems: [],
      manuscript: "",
      nearby: "",
    });
    for (const text of [system, prompt]) {
      expect(text).not.toContain("Help me understand before I write");
      expect(text).not.toContain("clarification-panel");
    }
    expect(system).toContain("Return ONLY the requested prose");
  });

  it("describes the document action for editor destinations", () => {
    const prompt = buildGenerationUserPrompt({
      request: makeRequest({
        destination: "document_editor",
        documentAction: "replace_selection",
        selectedText: "Old sentence.",
      }),
      contextItems: [],
      manuscript: "Old sentence.",
      nearby: "Old sentence.",
    });
    expect(prompt).toContain("REPLACE the selected text");
    expect(prompt).toContain("Old sentence.");
  });
});
