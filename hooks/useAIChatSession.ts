"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import { useChatFileAttachments } from "@/hooks/useChatFileAttachments";
import type { ChatMessage } from "@/lib/prompts";
import {
  buildChatUserContent,
  chatUserPreview,
  type ChatFileAttachment,
} from "@/lib/ai/chatFileContext";
import { editorJsonToAIText } from "@/lib/document/serializeForAI";

export type AIAction = "grammar" | "brainstorm" | "rewrite" | "continue";
export type { ChatFileAttachment };

export interface DisplayChatMessage extends ChatMessage {
  userPreview?: string;
  attachedFiles?: Pick<ChatFileAttachment, "name" | "truncated">[];
}

interface ActionDef {
  id: AIAction;
  label: string;
  description: string;
  placeholder: string;
  needsSelection?: boolean;
  attachSelection?: boolean;
  starter: (hasSelection: boolean) => string;
}

export const CHAT_ACTIONS: ActionDef[] = [
  {
    id: "grammar",
    label: "Grammar & style",
    description:
      "Spot grammar, spelling, and style issues. Highlight a passage or check your whole draft.",
    placeholder: "Describe what you'd like checked, or edit the prompt above…",
    attachSelection: true,
    starter: (has) =>
      has
        ? "Check the grammar and style of this passage and suggest fixes. "
        : "Check my whole draft for grammar, style, clarity, and flow, and show me your suggested fixes. ",
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    description:
      "Explore ideas, angles, and outlines. Wright builds on whatever you're thinking about.",
    placeholder: "What topic or problem do you want to explore?",
    starter: () => "I'd like to brainstorm. I'm thinking about ",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    description:
      "Rephrase selected text for a different tone, length, or clarity. Highlight a passage first.",
    placeholder: "How should this passage be rewritten?",
    needsSelection: true,
    attachSelection: true,
    starter: () => "Rewrite this passage — ",
  },
  {
    id: "continue",
    label: "Continue writing",
    description:
      "Pick up where you left off. Wright reads your draft and continues in your voice.",
    placeholder: "Add any direction for how to continue, or send as-is…",
    starter: () =>
      "Continue writing from where I left off, matching my voice and pacing. ",
  },
];

export const DEFAULT_CHAT_PLACEHOLDER =
  "Ask Wright anything about your writing — grammar, ideas, rewrites, or where to go next…";

interface UseAIChatSessionOptions {
  editor: Editor | null;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function useAIChatSession({
  editor,
  onToast,
}: UseAIChatSessionOptions) {
  const { run, cancel, isStreaming } = useAI();
  const [messages, setMessages] = useState<DisplayChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [dismissedSelection, setDismissedSelection] = useState<string | null>(
    null
  );
  const {
    files: fileAttachments,
    parsing: parsingFiles,
    accept: fileAccept,
    removeFile,
    clearFiles,
    addFiles,
  } = useChatFileAttachments(onToast);

  const applyAction = useCallback(
    (action: AIAction, selectedText: string) => {
      const def = CHAT_ACTIONS.find((a) => a.id === action);
      if (!def) return false;

      const selection = selectedText.trim();
      if (def.needsSelection && !selection) {
        onToast("Select some text in your document first.", "info");
        return false;
      }

      const attach = def.attachSelection && selection ? selection : null;
      setAttachment(attach);
      setDismissedSelection(null);
      setActiveAction(action);
      setInput(def.starter(Boolean(attach)));
      return true;
    },
    [onToast]
  );

  const getSelectionContext = useCallback(
    (selectedText: string) => {
      if (attachment?.trim()) return attachment.trim();

      const selection = selectedText.trim();
      if (!selection || selection === dismissedSelection) return null;

      return selection;
    },
    [attachment, dismissedSelection]
  );

  const dismissSelectionContext = useCallback((selectedText: string) => {
    setAttachment(null);
    const selection = selectedText.trim();
    if (selection) setDismissedSelection(selection);
  }, []);

  const send = useCallback(async (selectedText = "") => {
    const typed = input.trim();
    const selectionContext = getSelectionContext(selectedText);
    if (
      (!typed && !selectionContext && fileAttachments.length === 0) ||
      isStreaming
    ) {
      return;
    }

    const content = buildChatUserContent(
      typed,
      selectionContext,
      fileAttachments
    );
    const userPreview = chatUserPreview(
      typed,
      fileAttachments,
      selectionContext
    );
    const attachedFiles = fileAttachments.map(({ name, truncated }) => ({
      name,
      truncated,
    }));

    const history: ChatMessage[] = [
      ...messages.map(({ role, content: messageContent }) => ({
        role,
        content: messageContent,
      })),
      { role: "user" as const, content },
    ];

    setMessages([
      ...messages,
      { role: "user", content, userPreview, attachedFiles },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setAttachment(null);
    setActiveAction(null);
    clearFiles();

    const documentContent = editor ? editorJsonToAIText(editor.getJSON()) : "";

    await run(
      {
        mode: "chat",
        messages: history,
        documentContent,
      },
      {
        onChunk: (_chunk, accumulated) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: accumulated };
            return next;
          });
        },
        onError: () => {
          onToast("Wright couldn't respond — please try again.", "error");
          setMessages((prev) => {
            const next = [...prev];
            if (next[next.length - 1]?.content === "") next.pop();
            return next;
          });
        },
      }
    );
  }, [
    clearFiles,
    editor,
    fileAttachments,
    getSelectionContext,
    input,
    isStreaming,
    messages,
    onToast,
    run,
  ]);

  const clearChat = useCallback(() => {
    cancel();
    setMessages([]);
    setInput("");
    setAttachment(null);
    setDismissedSelection(null);
    setActiveAction(null);
    clearFiles();
  }, [cancel, clearFiles]);

  return {
    messages,
    input,
    setInput,
    activeAction,
    setActiveAction,
    attachment,
    setAttachment,
    getSelectionContext,
    dismissSelectionContext,
    fileAttachments,
    parsingFiles,
    fileAccept,
    removeFile,
    addFiles,
    isStreaming,
    applyAction,
    send,
    clearChat,
  };
}

export type AIChatSession = ReturnType<typeof useAIChatSession>;
