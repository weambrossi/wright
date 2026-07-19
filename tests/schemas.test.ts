import { describe, expect, it } from "vitest";
import {
  evaluationOutputSchema,
  contradictionOutputSchema,
  skipOptionsOutputSchema,
  contextClassificationSchema,
  startWritingRequestSchema,
  extractJson,
} from "@/lib/writing/schemas";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON with surrounding prose", () => {
    expect(
      extractJson('Here is my answer:\n{"decision":"ready"} hope that helps')
    ).toEqual({ decision: "ready" });
  });

  it("handles nested braces and strings containing braces", () => {
    expect(extractJson('x {"a":{"b":"c } d"}} y')).toEqual({
      a: { b: "c } d" },
    });
  });

  it("throws on non-JSON output", () => {
    expect(() => extractJson("I cannot answer that.")).toThrow();
  });
});

describe("evaluationOutputSchema", () => {
  it("accepts a ready decision", () => {
    const parsed = evaluationOutputSchema.safeParse({
      decision: "ready",
      assumptions: [{ description: "morning light", importance: "minor" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a clarification decision with a question", () => {
    const parsed = evaluationOutputSchema.safeParse({
      decision: "needs_clarification",
      reason: "Missing emotion",
      question: {
        question: "How does Naomi feel when she sees Daniel again?",
        category: "character_emotion",
        answerType: "single_choice",
        suggestedAnswers: [{ label: "Relieved, but trying not to show it" }],
      },
      remainingQuestionCount: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid structured output safely", () => {
    expect(
      evaluationOutputSchema.safeParse({ decision: "write_it_all" }).success
    ).toBe(false);
    expect(
      evaluationOutputSchema.safeParse({
        decision: "needs_clarification",
        question: { question: "" },
      }).success
    ).toBe(false);
    expect(evaluationOutputSchema.safeParse("garbage").success).toBe(false);
  });
});

describe("contradictionOutputSchema", () => {
  it("accepts an empty conflict list", () => {
    expect(
      contradictionOutputSchema.safeParse({ conflicts: [] }).success
    ).toBe(true);
  });

  it("rejects conflicts missing fields", () => {
    expect(
      contradictionOutputSchema.safeParse({
        conflicts: [{ newStatement: "x" }],
      }).success
    ).toBe(false);
  });
});

describe("skipOptionsOutputSchema", () => {
  it("requires at least two options", () => {
    expect(
      skipOptionsOutputSchema.safeParse({ options: [{ label: "one" }] })
        .success
    ).toBe(false);
    expect(
      skipOptionsOutputSchema.safeParse({
        options: [{ label: "one" }, { label: "two" }],
      }).success
    ).toBe(true);
  });
});

describe("contextClassificationSchema", () => {
  it("accepts a full classification", () => {
    const parsed = contextClassificationSchema.safeParse({
      category: "character_motivation",
      scope: "story",
      characterNames: ["Elena"],
      canonicalStatement: "Elena wants Marcus to admit he lied.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown scopes", () => {
    expect(
      contextClassificationSchema.safeParse({
        category: "plot",
        scope: "universe",
        canonicalStatement: "x",
      }).success
    ).toBe(false);
  });
});

describe("startWritingRequestSchema", () => {
  it("validates a document-editor request", () => {
    const parsed = startWritingRequestSchema.safeParse({
      documentId: "doc-1",
      prompt: "Continue the scene",
      destination: "document_editor",
      documentAction: "continue",
      writingControlMode: "ask_me_first",
      manuscriptText: "Once upon a time…",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown writing mode", () => {
    expect(
      startWritingRequestSchema.safeParse({
        documentId: "doc-1",
        prompt: "Continue",
        destination: "assistant_tab",
        writingControlMode: "yolo",
      }).success
    ).toBe(false);
  });
});
