"use client";

import type { JSONContent } from "@tiptap/core";
import { useEditor as useTiptap } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "@/lib/pageSettings";
import { getWrightExtensions } from "@/lib/tiptap/extensions";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseEditorOptions {
  initialContent?: string | JSONContent;
  initialTitle?: string;
  /** When set, manual save POSTs to /api/documents/[id]. */
  documentId?: string;
}

export function useWrightEditor(opts: UseEditorOptions = {}) {
  const { initialContent, initialTitle, documentId } = opts;
  const [selectedText, setSelectedText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [title, setTitle] = useState(initialTitle ?? "Untitled Document");
  const [pageSettings, setPageSettings] =
    useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Bumped on every transaction so toolbar active-states stay in sync.
  const [, setSelectionTick] = useState(0);

  const editor = useTiptap({
    extensions: getWrightExtensions({
      placeholder: "Begin writing, or upload a document to get started...",
    }),
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "wright-prose",
      },
    },
    immediatelyRender: false,
    onSelectionUpdate({ editor }) {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ").trim();
      setSelectedText(text);
      setSelectionTick((n) => n + 1);
    },
    onTransaction() {
      setSelectionTick((n) => n + 1);
    },
    onUpdate({ editor }) {
      const words = editor.storage.characterCount?.words?.() ?? 0;
      setWordCount(words);
      setSaveStatus((s) => (s === "saving" ? s : "dirty"));
    },
    onCreate({ editor }) {
      const words = editor.storage.characterCount?.words?.() ?? 0;
      setWordCount(words);
    },
  });

  // Tiptap's useEditor only reads `content` at creation time. When the editor
  // page bootstraps a document asynchronously, push the content in once it arrives.
  const appliedContentRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editor) return;
    if (!initialContent) return;
    const contentKey =
      typeof initialContent === "string"
        ? initialContent
        : JSON.stringify(initialContent);
    if (appliedContentRef.current === contentKey) return;
    appliedContentRef.current = contentKey;
    editor.commands.setContent(initialContent, true);
    // Programmatic load shouldn't mark dirty.
    setSaveStatus("idle");
  }, [editor, initialContent]);

  // Sync title when an initial title arrives asynchronously.
  useEffect(() => {
    if (initialTitle === undefined) return;
    setTitle(initialTitle);
  }, [initialTitle]);

  // Mark dirty when the user changes the title.
  const titleHydratedRef = useRef(false);
  useEffect(() => {
    if (!titleHydratedRef.current) {
      titleHydratedRef.current = true;
      return;
    }
    setSaveStatus((s) => (s === "saving" ? s : "dirty"));
  }, [title]);

  // Manual save. No keepalive (it has a 64KB body limit and silently drops
  // saves on documents larger than that — the original autosave bug).
  const saveInflightRef = useRef<Promise<void> | null>(null);
  const saveNow = useCallback(async (): Promise<void> => {
    if (!editor || !documentId) return;
    // De-dupe concurrent saves so Cmd+S spam doesn't race itself.
    if (saveInflightRef.current) return saveInflightRef.current;
    const run = (async () => {
      setSaveStatus("saving");
      try {
        const html = editor.getHTML();
        const contentJson = editor.getJSON();
        const res = await fetch(`/api/documents/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, contentJson, title }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || `Save failed (${res.status})`);
        }
        setSaveStatus("saved");
      } catch (err) {
        console.error("Save failed:", err);
        setSaveStatus("error");
      } finally {
        saveInflightRef.current = null;
      }
    })();
    saveInflightRef.current = run;
    return run;
  }, [editor, documentId, title]);

  return {
    editor,
    selectedText,
    wordCount,
    title,
    setTitle,
    pageSettings,
    setPageSettings,
    saveStatus,
    saveNow,
  };
}
