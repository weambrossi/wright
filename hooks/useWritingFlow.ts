"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { editorJsonToAIText } from "@/lib/document/serializeForAI";
import {
  checkInsertionSafety,
  fingerprintDocumentText,
} from "@/lib/writing/documentVersion";
import { trackWritingEvent } from "@/lib/writing/analytics";
import type {
  ClarificationAnswerSource,
  ClarificationQuestion,
  DocumentGenerationAction,
  NaturalnessLevel,
  PendingWritingRequest,
  StoryContextConflict,
  SuggestedAnswer,
  WritingAssistantResponse,
  WritingAssumption,
  WritingControlMode,
  WritingDestination,
} from "@/lib/writing/types";

// Client state machine for the context-grounded writing workflow. Talks to
// /api/writing/*; renders nothing itself — ClarificationPanel consumes the
// exposed state. Clarification questions never enter the chat transcript or
// the document; only final generated prose reaches its destination.

export interface GenerationResultMeta {
  requestId: string;
  assumptions: WritingAssumption[];
  contextCount: number;
  answerCount: number;
  mode: WritingControlMode;
}

export type WritingPanelState =
  | { kind: "idle" }
  | { kind: "starting" }
  | {
      kind: "question";
      question: ClarificationQuestion;
      questionNumber: number;
      remainingEstimate?: number;
      reason?: string;
      isEdit: boolean;
      busy: boolean;
      error?: string;
    }
  | {
      kind: "options";
      question: ClarificationQuestion;
      options: SuggestedAnswer[];
      busy: boolean;
      error?: string;
    }
  | {
      kind: "conflict";
      conflicts: StoryContextConflict[];
      busy: boolean;
      error?: string;
    }
  | {
      kind: "review";
      questions: ClarificationQuestion[];
      answers: PendingWritingRequest["answers"];
      assumptions: WritingAssumption[];
      busy: boolean;
      error?: string;
    }
  | { kind: "generating"; destination: WritingDestination; preview: string }
  | {
      kind: "insert_review";
      content: string;
      reason: "document_changed" | "selection_invalid";
    };

export interface StartWritingOptions {
  prompt: string;
  destination: WritingDestination;
  documentAction?: DocumentGenerationAction;
  selectedText?: string;
  conversation: { role: "user" | "assistant"; content: string }[];
}

interface UseWritingFlowOptions {
  editor: Editor | null;
  documentId: string;
  mode: WritingControlMode;
  /** Naturalness preference, sent with every generation. */
  naturalness?: NaturalnessLevel;
  /** When false, Wright never asks clarification questions. */
  askQuestions?: boolean;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  /** Assistant-tab generation streams through these into the chat transcript. */
  onAssistantStart: () => void;
  onAssistantChunk: (accumulated: string) => void;
  onAssistantDone: (final: string, meta: GenerationResultMeta) => void;
  onAssistantError: () => void;
}

interface FlowApiResult {
  response: WritingAssistantResponse;
  request: PendingWritingRequest;
}

async function flowFetch(url: string, init?: RequestInit): Promise<FlowApiResult> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as FlowApiResult;
}

export function useWritingFlow(options: UseWritingFlowOptions) {
  const {
    editor,
    documentId,
    mode,
    naturalness = "balanced",
    askQuestions = true,
    onToast,
    onAssistantStart,
    onAssistantChunk,
    onAssistantDone,
    onAssistantError,
  } = options;

  const [panel, setPanel] = useState<WritingPanelState>({ kind: "idle" });
  const requestRef = useRef<PendingWritingRequest | null>(null);
  const [request, setRequest] = useState<PendingWritingRequest | null>(null);
  const submittingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const setActiveRequest = useCallback(
    (next: PendingWritingRequest | null) => {
      requestRef.current = next;
      setRequest(next);
    },
    []
  );

  const manuscriptText = useCallback(
    () => (editor ? editorJsonToAIText(editor.getJSON()) : ""),
    [editor]
  );

  // -------------------------------------------------------------------------
  // Response → panel state
  // -------------------------------------------------------------------------

  const applyResponse = useCallback(
    (result: FlowApiResult): WritingAssistantResponse => {
      setActiveRequest(result.request);
      const { response } = result;
      if (response.type === "clarification_required") {
        const questionNumber =
          result.request.questions.findIndex(
            (q) => q.id === response.question.id
          ) + 1 || result.request.questions.length;
        setPanel({
          kind: "question",
          question: response.question,
          questionNumber,
          remainingEstimate: response.remainingQuestionCount,
          reason: response.reason,
          isEdit: Boolean(result.request.answers[response.question.id]),
          busy: false,
        });
      } else if (response.type === "contradiction_detected") {
        setPanel({
          kind: "conflict",
          conflicts: response.conflicts,
          busy: false,
        });
      } else if (response.type === "writing_options") {
        const question = result.request.questions.find(
          (q) => q.id === response.questionId
        );
        setPanel({
          kind: "options",
          question: question ?? result.request.questions[0],
          options: response.options,
          busy: false,
        });
      } else if (response.type === "generation_ready") {
        if (response.questions.length > 0) {
          // Author answered questions → review them before generating.
          setPanel({
            kind: "review",
            questions: response.questions,
            answers: response.answers,
            assumptions: response.assumptions,
            busy: false,
          });
        }
        // Zero questions → caller generates immediately.
      }
      return response;
    },
    [setActiveRequest]
  );

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  const insertIntoDocument = useCallback(
    (content: string, req: PendingWritingRequest): boolean => {
      if (!editor) return false;
      const check = checkInsertionSafety({
        originalVersion: req.documentVersion,
        currentText: editor.getText(),
        selectionStart: req.selectionStart,
        selectionEnd: req.selectionEnd,
        currentDocSize: editor.state.doc.content.size,
      });
      const replacing =
        req.documentAction === "replace_selection" ||
        req.documentAction === "rewrite_selection" ||
        req.documentAction === "expand_selection";

      if (!check.ok) {
        setPanel({
          kind: "insert_review",
          content,
          reason: check.reason ?? "document_changed",
        });
        return false;
      }

      const html = textToParagraphHtml(content);
      if (replacing && req.selectionStart != null && req.selectionEnd != null) {
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from: req.selectionStart, to: req.selectionEnd },
            html
          )
          .run();
      } else if (req.documentAction === "continue") {
        editor.chain().focus("end").insertContent(html).run();
      } else if (req.selectionStart != null) {
        editor.chain().focus().insertContentAt(req.selectionStart, html).run();
      } else {
        editor.chain().focus().insertContent(html).run();
      }
      onToast("Wright wrote into your document.", "success");
      trackWritingEvent("generation_inserted", {
        requestId: req.id,
        destination: "document_editor",
      });
      return true;
    },
    [editor, onToast]
  );

  const generate = useCallback(async (): Promise<void> => {
    const req = requestRef.current;
    if (!req) return;

    const destination = req.destination;
    setPanel({ kind: "generating", destination, preview: "" });
    if (destination === "assistant_tab") onAssistantStart();

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    let accumulated = "";
    try {
      const res = await fetch(`/api/writing/requests/${req.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscriptText: manuscriptText(), naturalness }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Generation failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (destination === "assistant_tab") {
          onAssistantChunk(accumulated);
        } else {
          setPanel((prev) =>
            prev.kind === "generating"
              ? { ...prev, preview: accumulated }
              : prev
          );
        }
      }

      if (accumulated.includes("[error]")) {
        throw new Error("Generation failed");
      }

      const meta: GenerationResultMeta = {
        requestId: req.id,
        assumptions: req.assumptions,
        contextCount: req.retrievedContextIds.length,
        answerCount: Object.keys(req.answers).length,
        mode: req.writingControlMode,
      };

      if (destination === "assistant_tab") {
        onAssistantDone(accumulated, meta);
        setPanel({ kind: "idle" });
      } else {
        const inserted = insertIntoDocument(accumulated, req);
        if (inserted) setPanel({ kind: "idle" });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setPanel({ kind: "idle" });
        return;
      }
      // Answers are preserved server-side; the author can retry generation.
      if (destination === "assistant_tab") onAssistantError();
      onToast(
        "Generation failed — your answers are saved, try again.",
        "error"
      );
      const current = requestRef.current;
      if (current) {
        setPanel({
          kind: "review",
          questions: current.questions,
          answers: current.answers,
          assumptions: current.assumptions,
          busy: false,
        });
      } else {
        setPanel({ kind: "idle" });
      }
    }
  }, [
    insertIntoDocument,
    manuscriptText,
    naturalness,
    onAssistantChunk,
    onAssistantDone,
    onAssistantError,
    onAssistantStart,
    onToast,
  ]);

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  /**
   * Begin a writing request. Returns "fallback" when the server decides the
   * message is ordinary conversation (caller should run the normal chat).
   */
  const start = useCallback(
    async (opts: StartWritingOptions): Promise<"handled" | "fallback"> => {
      if (submittingRef.current) return "handled";
      submittingRef.current = true;
      setPanel({ kind: "starting" });
      try {
        const selection = editor?.state.selection;
        const result = await flowFetch("/api/writing/requests", {
          method: "POST",
          body: JSON.stringify({
            documentId,
            prompt: opts.prompt,
            destination: opts.destination,
            documentAction: opts.documentAction,
            selectedText: opts.selectedText,
            selectionStart:
              opts.destination === "document_editor" && selection
                ? selection.from
                : undefined,
            selectionEnd:
              opts.destination === "document_editor" && selection
                ? selection.to
                : undefined,
            documentVersion: editor
              ? fingerprintDocumentText(editor.getText())
              : undefined,
            writingControlMode: mode,
            manuscriptText: manuscriptText(),
            conversation: opts.conversation.slice(-12),
            askQuestions,
          }),
        });

        if (result.response.type === "not_a_writing_request") {
          setActiveRequest(null);
          setPanel({ kind: "idle" });
          return "fallback";
        }

        const response = applyResponse(result);
        if (
          response.type === "generation_ready" &&
          response.questions.length === 0
        ) {
          await generate();
        }
        return "handled";
      } catch (err) {
        setPanel({ kind: "idle" });
        onToast(
          err instanceof Error ? err.message : "Wright couldn't start.",
          "error"
        );
        // Treat orchestration failure as fallback so the author still gets
        // the plain chat experience rather than a dead end.
        return "fallback";
      } finally {
        submittingRef.current = false;
      }
    },
    [
      applyResponse,
      askQuestions,
      documentId,
      editor,
      generate,
      manuscriptText,
      mode,
      onToast,
      setActiveRequest,
    ]
  );

  // -------------------------------------------------------------------------
  // Answering
  // -------------------------------------------------------------------------

  const submitAnswer = useCallback(
    async (
      questionId: string,
      answer: string | string[],
      source: ClarificationAnswerSource
    ): Promise<void> => {
      const req = requestRef.current;
      if (!req || submittingRef.current) return;
      submittingRef.current = true;
      setPanel((prev) =>
        prev.kind === "question" || prev.kind === "options"
          ? { ...prev, busy: true, error: undefined }
          : prev
      );
      try {
        const result = await flowFetch(
          `/api/writing/requests/${req.id}/answer`,
          {
            method: "POST",
            body: JSON.stringify({
              questionId,
              answer,
              source,
              manuscriptText: manuscriptText(),
            }),
          }
        );
        const response = applyResponse(result);
        if (
          response.type === "generation_ready" &&
          response.questions.length === 0
        ) {
          await generate();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't submit that answer.";
        setPanel((prev) =>
          prev.kind === "question" || prev.kind === "options"
            ? { ...prev, busy: false, error: message }
            : prev
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [applyResponse, generate, manuscriptText]
  );

  const skip = useCallback(async (): Promise<void> => {
    const req = requestRef.current;
    if (!req || submittingRef.current) return;
    const current = panel.kind === "question" ? panel.question : null;
    if (!current) return;
    submittingRef.current = true;
    setPanel((prev) =>
      prev.kind === "question" ? { ...prev, busy: true, error: undefined } : prev
    );
    try {
      const result = await flowFetch(`/api/writing/requests/${req.id}/skip`, {
        method: "POST",
        body: JSON.stringify({
          questionId: current.id,
          manuscriptText: manuscriptText(),
        }),
      });
      applyResponse(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't fetch options.";
      setPanel((prev) =>
        prev.kind === "question" ? { ...prev, busy: false, error: message } : prev
      );
    } finally {
      submittingRef.current = false;
    }
  }, [applyResponse, manuscriptText, panel]);

  /**
   * "Generate without answering": abandon the open question(s) and generate
   * immediately. Unanswered questions become flagged assumptions server-side;
   * nothing is saved as confirmed story context.
   */
  const generateWithoutAnswering = useCallback(async (): Promise<void> => {
    const req = requestRef.current;
    if (!req || submittingRef.current) return;
    submittingRef.current = true;
    setPanel((prev) =>
      prev.kind === "question" || prev.kind === "options"
        ? { ...prev, busy: true, error: undefined }
        : prev
    );
    try {
      const result = await flowFetch(
        `/api/writing/requests/${req.id}/proceed`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setActiveRequest(result.request);
      // Bypass the review panel — the author explicitly asked to generate.
      submittingRef.current = false;
      await generate();
      return;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't start generating.";
      setPanel((prev) =>
        prev.kind === "question" || prev.kind === "options"
          ? { ...prev, busy: false, error: message }
          : prev
      );
    } finally {
      submittingRef.current = false;
    }
  }, [generate, setActiveRequest]);

  /** From the skip-options state: ask for a fresh set of options. */
  const moreOptions = useCallback(async (): Promise<void> => {
    const req = requestRef.current;
    if (!req || submittingRef.current) return;
    const current = panel.kind === "options" ? panel.question : null;
    if (!current) return;
    submittingRef.current = true;
    setPanel((prev) =>
      prev.kind === "options" ? { ...prev, busy: true, error: undefined } : prev
    );
    try {
      const result = await flowFetch(`/api/writing/requests/${req.id}/skip`, {
        method: "POST",
        body: JSON.stringify({
          questionId: current.id,
          manuscriptText: manuscriptText(),
        }),
      });
      applyResponse(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't fetch options.";
      setPanel((prev) =>
        prev.kind === "options" ? { ...prev, busy: false, error: message } : prev
      );
    } finally {
      submittingRef.current = false;
    }
  }, [applyResponse, manuscriptText, panel]);

  /** Ask Wright to avoid specifying the skipped detail at all. */
  const leaveUnspecified = useCallback(async (): Promise<void> => {
    const current =
      panel.kind === "options" || panel.kind === "question"
        ? panel.question
        : null;
    if (!current) return;
    await submitAnswer(
      current.id,
      "Do not specify this detail — write around it and leave it open.",
      "author"
    );
  }, [panel, submitAnswer]);

  const resolveConflict = useCallback(
    async (
      conflictId: string,
      action:
        | "keep_existing"
        | "replace_with_new"
        | "edit_new"
        | "keep_both"
        | "mark_intentional"
        | "cancel",
      editedAnswer?: string
    ): Promise<void> => {
      const req = requestRef.current;
      if (!req || submittingRef.current) return;
      submittingRef.current = true;
      setPanel((prev) =>
        prev.kind === "conflict" ? { ...prev, busy: true, error: undefined } : prev
      );
      try {
        const result = await flowFetch(
          `/api/writing/requests/${req.id}/resolve-conflict`,
          {
            method: "POST",
            body: JSON.stringify({
              conflictId,
              action,
              editedAnswer,
              manuscriptText: manuscriptText(),
            }),
          }
        );
        if (action === "cancel") {
          setActiveRequest(null);
          setPanel({ kind: "idle" });
          return;
        }
        const response = applyResponse(result);
        if (
          response.type === "generation_ready" &&
          response.questions.length === 0
        ) {
          await generate();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't resolve the conflict.";
        setPanel((prev) =>
          prev.kind === "conflict" ? { ...prev, busy: false, error: message } : prev
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [applyResponse, generate, manuscriptText, setActiveRequest]
  );

  /** Reopen a previously answered question for editing (from review state). */
  const editAnswer = useCallback(
    (questionId: string) => {
      const req = requestRef.current;
      if (!req) return;
      const idx = req.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return;
      setPanel({
        kind: "question",
        question: req.questions[idx],
        questionNumber: idx + 1,
        isEdit: true,
        busy: false,
      });
    },
    []
  );

  /** Back from an edit to the review state without changing anything. */
  const backToReview = useCallback(() => {
    const req = requestRef.current;
    if (!req || req.status !== "ready_to_generate") return;
    setPanel({
      kind: "review",
      questions: req.questions,
      answers: req.answers,
      assumptions: req.assumptions,
      busy: false,
    });
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    const req = requestRef.current;
    abortRef.current?.abort();
    setActiveRequest(null);
    setPanel({ kind: "idle" });
    if (req) {
      await fetch(`/api/writing/requests/${req.id}`, { method: "DELETE" }).catch(
        () => {}
      );
    }
  }, [setActiveRequest]);

  /** From insert_review: the author accepts inserting at the cursor anyway. */
  const insertAnyway = useCallback(
    (content: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(textToParagraphHtml(content)).run();
      onToast("Inserted at the cursor.", "success");
      setPanel({ kind: "idle" });
      setActiveRequest(null);
    },
    [editor, onToast, setActiveRequest]
  );

  const discardResult = useCallback(() => {
    const req = requestRef.current;
    if (req) trackWritingEvent("generation_rejected", { requestId: req.id });
    setPanel({ kind: "idle" });
    setActiveRequest(null);
  }, [setActiveRequest]);

  // -------------------------------------------------------------------------
  // Reopen a pending flow after reload/navigation
  // -------------------------------------------------------------------------

  const reopenedRef = useRef(false);
  useEffect(() => {
    if (reopenedRef.current || !documentId) return;
    reopenedRef.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/writing/requests?documentId=${encodeURIComponent(documentId)}`
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          request: PendingWritingRequest | null;
        };
        const req = body.request;
        if (!req) return;
        setActiveRequest(req);
        if (req.status === "awaiting_answer") {
          const question = req.questions[req.currentQuestionIndex];
          if (question) {
            setPanel({
              kind: "question",
              question,
              questionNumber: req.currentQuestionIndex + 1,
              isEdit: Boolean(req.answers[question.id]),
              busy: false,
            });
          }
        } else if (req.status === "checking_conflict") {
          setPanel({ kind: "conflict", conflicts: req.conflicts, busy: false });
        } else if (req.status === "ready_to_generate") {
          setPanel({
            kind: "review",
            questions: req.questions,
            answers: req.answers,
            assumptions: req.assumptions,
            busy: false,
          });
        }
      } catch {
        // Reopen is best-effort.
      }
    })();
  }, [documentId, setActiveRequest]);

  /** Regenerate a completed request (assistant-tab action). */
  const regenerate = useCallback(
    async (requestId: string): Promise<void> => {
      if (requestRef.current?.id !== requestId) {
        try {
          const res = await fetch(`/api/writing/requests/${requestId}`);
          if (!res.ok) throw new Error("Request no longer exists");
          const body = (await res.json()) as { request: PendingWritingRequest };
          setActiveRequest(body.request);
        } catch (err) {
          onToast(
            err instanceof Error ? err.message : "Couldn't regenerate.",
            "error"
          );
          return;
        }
      }
      await generate();
    },
    [generate, onToast, setActiveRequest]
  );

  return {
    panel,
    request,
    start,
    submitAnswer,
    skip,
    generateWithoutAnswering,
    moreOptions,
    leaveUnspecified,
    resolveConflict,
    editAnswer,
    backToReview,
    generate,
    regenerate,
    cancel,
    insertAnyway,
    discardResult,
  };
}

export type WritingFlow = ReturnType<typeof useWritingFlow>;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convert plain generated text into paragraph HTML for editor insertion. */
export function textToParagraphHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}
