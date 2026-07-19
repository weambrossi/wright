import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useWritingFlow, textToParagraphHtml } from "@/hooks/useWritingFlow";
import { fingerprintDocumentText } from "@/lib/writing/documentVersion";
import type { PendingWritingRequest } from "@/lib/writing/types";

// -----------------------------------------------------------------------
// Fakes
// -----------------------------------------------------------------------

function makeFakeEditor(initialText: string) {
  let text = initialText;
  const insertions: unknown[] = [];
  const chain: Record<string, unknown> = {};
  chain.focus = () => chain;
  chain.insertContent = (c: unknown) => {
    insertions.push(c);
    return chain;
  };
  chain.insertContentAt = (range: unknown, c: unknown) => {
    insertions.push([range, c]);
    return chain;
  };
  chain.run = () => {};
  const editor = {
    state: { selection: { from: 1, to: 5 }, doc: { content: { size: 500 } } },
    getText: () => text,
    getJSON: () => ({ type: "doc", content: [] }),
    chain: () => chain,
  } as unknown as Editor;
  return { editor, insertions, setText: (t: string) => (text = t) };
}

function makeRequest(
  overrides: Partial<PendingWritingRequest> = {}
): PendingWritingRequest {
  return {
    id: "req-1",
    documentId: "doc-1",
    originalPrompt: "Write the scene",
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
  id: "q1",
  question: "How does Naomi feel?",
  category: "character_emotion" as const,
  required: true,
  answerType: "short_text" as const,
  allowCustomAnswer: true,
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: true, body: stream } as Response;
}

const fetchMock = vi.fn();

function makeCallbacks() {
  return {
    onToast: vi.fn(),
    onAssistantStart: vi.fn(),
    onAssistantChunk: vi.fn(),
    onAssistantDone: vi.fn(),
    onAssistantError: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // Reopen probe on mount — default to "no pending request".
  fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
    if (String(url).includes("/api/writing/requests?documentId=")) {
      return jsonResponse({ request: null });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setupHook(
  editor: Editor | null,
  extra: Partial<Parameters<typeof useWritingFlow>[0]> = {}
) {
  const callbacks = makeCallbacks();
  const hook = renderHook(() =>
    useWritingFlow({
      editor,
      documentId: "doc-1",
      mode: "ask_me_first",
      ...callbacks,
      ...extra,
    })
  );
  return { hook, callbacks };
}

describe("useWritingFlow", () => {
  it("renders a clarification question in the panel — never in the chat transcript", async () => {
    const { editor } = makeFakeEditor("Naomi froze at the doorway.");
    const { hook, callbacks } = setupHook(editor);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        return jsonResponse({
          response: {
            type: "clarification_required",
            requestId: "req-1",
            reason: "Missing emotion",
            question,
          },
          request: makeRequest({
            status: "awaiting_answer",
            questions: [question],
          }),
        });
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    let outcome = "";
    await act(async () => {
      outcome = await hook.result.current.start({
        prompt: "Write the scene",
        destination: "assistant_tab",
        conversation: [],
      });
    });

    expect(outcome).toBe("handled");
    expect(hook.result.current.panel.kind).toBe("question");
    // The question must not become an assistant chat message.
    expect(callbacks.onAssistantStart).not.toHaveBeenCalled();
    expect(callbacks.onAssistantChunk).not.toHaveBeenCalled();
  });

  it("falls back to plain chat for non-writing requests", async () => {
    const { editor } = makeFakeEditor("Some draft");
    const { hook } = setupHook(editor);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      return jsonResponse({
        response: { type: "not_a_writing_request", requestId: "req-1" },
        request: makeRequest({ status: "completed" }),
      });
    });

    let outcome = "";
    await act(async () => {
      outcome = await hook.result.current.start({
        prompt: "What's a good name for a bakery?",
        destination: "assistant_tab",
        conversation: [],
      });
    });
    expect(outcome).toBe("fallback");
    expect(hook.result.current.panel.kind).toBe("idle");
  });

  it("streams assistant-tab generations into the chat via callbacks", async () => {
    const { editor } = makeFakeEditor("Draft text");
    const { hook, callbacks } = setupHook(editor);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        return jsonResponse({
          response: {
            type: "generation_ready",
            requestId: "req-1",
            contextUsed: [],
            assumptions: [],
            questions: [],
            answers: {},
          },
          request: makeRequest({ status: "ready_to_generate" }),
        });
      }
      if (u.endsWith("/generate")) {
        return streamResponse(["Naomi ", "stepped ", "inside."]);
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    await act(async () => {
      await hook.result.current.start({
        prompt: "Write the scene",
        destination: "assistant_tab",
        conversation: [],
      });
    });

    await waitFor(() => {
      expect(callbacks.onAssistantDone).toHaveBeenCalled();
    });
    expect(callbacks.onAssistantStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onAssistantDone.mock.calls[0][0]).toBe(
      "Naomi stepped inside."
    );
    expect(hook.result.current.panel.kind).toBe("idle");
  });

  it("inserts document-tab generations at the preserved location", async () => {
    const { editor, insertions } = makeFakeEditor("Original manuscript text.");
    const { hook } = setupHook(editor);
    const version = fingerprintDocumentText("Original manuscript text.");

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        return jsonResponse({
          response: {
            type: "generation_ready",
            requestId: "req-1",
            contextUsed: [],
            assumptions: [],
            questions: [],
            answers: {},
          },
          request: makeRequest({
            status: "ready_to_generate",
            destination: "document_editor",
            documentAction: "replace_selection",
            selectionStart: 1,
            selectionEnd: 5,
            documentVersion: version,
          }),
        });
      }
      if (u.endsWith("/generate")) {
        return streamResponse(["New sentence."]);
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    await act(async () => {
      await hook.result.current.start({
        prompt: "Rewrite this",
        destination: "document_editor",
        documentAction: "replace_selection",
        selectedText: "abcd",
        conversation: [],
      });
    });

    await waitFor(() => expect(insertions.length).toBeGreaterThan(0));
    const [range, content] = insertions[0] as [unknown, string];
    expect(range).toEqual({ from: 1, to: 5 });
    expect(content).toContain("New sentence.");
    expect(hook.result.current.panel.kind).toBe("idle");
  });

  it("shows a review step instead of inserting when the document changed", async () => {
    const fake = makeFakeEditor("Original manuscript text.");
    const { hook } = setupHook(fake.editor);
    const version = fingerprintDocumentText("Original manuscript text.");

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        // The author edits the document while the request is in flight.
        fake.setText("Original manuscript text. Plus edits!");
        return jsonResponse({
          response: {
            type: "generation_ready",
            requestId: "req-1",
            contextUsed: [],
            assumptions: [],
            questions: [],
            answers: {},
          },
          request: makeRequest({
            status: "ready_to_generate",
            destination: "document_editor",
            documentAction: "replace_selection",
            selectionStart: 1,
            selectionEnd: 5,
            documentVersion: version,
          }),
        });
      }
      if (u.endsWith("/generate")) {
        return streamResponse(["New sentence."]);
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    await act(async () => {
      await hook.result.current.start({
        prompt: "Rewrite this",
        destination: "document_editor",
        documentAction: "replace_selection",
        conversation: [],
      });
    });

    await waitFor(() =>
      expect(hook.result.current.panel.kind).toBe("insert_review")
    );
    // Nothing was inserted automatically.
    expect(fake.insertions).toHaveLength(0);
  });

  it("cancelling clears the panel and never alters the document", async () => {
    const fake = makeFakeEditor("Untouched.");
    const { hook } = setupHook(fake.editor);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        return jsonResponse({
          response: {
            type: "clarification_required",
            requestId: "req-1",
            reason: "Missing emotion",
            question,
          },
          request: makeRequest({
            status: "awaiting_answer",
            questions: [question],
          }),
        });
      }
      return jsonResponse({ request: makeRequest({ status: "cancelled" }) });
    });

    await act(async () => {
      await hook.result.current.start({
        prompt: "Write the scene",
        destination: "assistant_tab",
        conversation: [],
      });
    });
    expect(hook.result.current.panel.kind).toBe("question");

    await act(async () => {
      await hook.result.current.cancel();
    });
    expect(hook.result.current.panel.kind).toBe("idle");
    expect(fake.insertions).toHaveLength(0);
  });

  it("sends the ask-questions preference with start and naturalness with generate", async () => {
    const { editor } = makeFakeEditor("Draft text");
    const { hook } = setupHook(editor, {
      naturalness: "natural_understated",
      askQuestions: false,
    });

    const bodies: Record<string, unknown> = {};
    fetchMock.mockImplementation(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("?documentId=")) return jsonResponse({ request: null });
        if (u.endsWith("/api/writing/requests")) {
          bodies.start = JSON.parse(String(init?.body));
          return jsonResponse({
            response: {
              type: "generation_ready",
              requestId: "req-1",
              contextUsed: [],
              assumptions: [],
              questions: [],
              answers: {},
            },
            request: makeRequest({ status: "ready_to_generate" }),
          });
        }
        if (u.endsWith("/generate")) {
          bodies.generate = JSON.parse(String(init?.body));
          return streamResponse(["Done."]);
        }
        throw new Error(`Unexpected fetch: ${u}`);
      }
    );

    await act(async () => {
      await hook.result.current.start({
        prompt: "Write the scene",
        destination: "assistant_tab",
        conversation: [],
      });
    });

    await waitFor(() => expect(bodies.generate).toBeTruthy());
    expect((bodies.start as { askQuestions: boolean }).askQuestions).toBe(false);
    expect((bodies.generate as { naturalness: string }).naturalness).toBe(
      "natural_understated"
    );
  });

  it("generates without answering: proceeds past the question and streams", async () => {
    const { editor } = makeFakeEditor("Draft text");
    const { hook, callbacks } = setupHook(editor);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) return jsonResponse({ request: null });
      if (u.endsWith("/api/writing/requests")) {
        return jsonResponse({
          response: {
            type: "clarification_required",
            requestId: "req-1",
            reason: "Missing emotion",
            question,
          },
          request: makeRequest({
            status: "awaiting_answer",
            questions: [question],
          }),
        });
      }
      if (u.endsWith("/proceed")) {
        return jsonResponse({
          response: {
            type: "generation_ready",
            requestId: "req-1",
            contextUsed: [],
            assumptions: [
              {
                id: "skip-assumption-0-0",
                description: "The author generated without answering.",
                importance: "major",
              },
            ],
            questions: [],
            answers: {},
          },
          request: makeRequest({
            status: "ready_to_generate",
            questions: [question],
          }),
        });
      }
      if (u.endsWith("/generate")) {
        return streamResponse(["Naomi ", "shrugged."]);
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    await act(async () => {
      await hook.result.current.start({
        prompt: "Write the scene",
        destination: "assistant_tab",
        conversation: [],
      });
    });
    expect(hook.result.current.panel.kind).toBe("question");

    await act(async () => {
      await hook.result.current.generateWithoutAnswering();
    });

    await waitFor(() => expect(callbacks.onAssistantDone).toHaveBeenCalled());
    expect(callbacks.onAssistantDone.mock.calls[0][0]).toBe("Naomi shrugged.");
    expect(hook.result.current.panel.kind).toBe("idle");
  });

  it("reopens a pending question flow on mount", async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("?documentId=")) {
        return jsonResponse({
          request: makeRequest({
            status: "awaiting_answer",
            questions: [question],
            currentQuestionIndex: 0,
          }),
        });
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });

    const { hook } = setupHook(null);
    await waitFor(() =>
      expect(hook.result.current.panel.kind).toBe("question")
    );
  });
});

describe("textToParagraphHtml", () => {
  it("splits on blank lines and escapes HTML", () => {
    const html = textToParagraphHtml("One <b>bold</b>\n\nTwo\nlines");
    expect(html).toBe(
      "<p>One &lt;b&gt;bold&lt;/b&gt;</p><p>Two<br />lines</p>"
    );
  });
});
