"use client";

import type { JSONContent } from "@tiptap/core";
import { useEditor as useTiptap } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "@/lib/pageSettings";
import { getWrightExtensions } from "@/lib/tiptap/extensions";

export interface UseEditorOptions {
  initialContent?: string | JSONContent;
  initialTitle?: string;
  /** When set, edits autosave to /api/documents/[id] (the database). */
  documentId?: string;
  autosaveMs?: number;
}

export function useWrightEditor(opts: UseEditorOptions = {}) {
  const { initialContent, initialTitle, documentId, autosaveMs = 30_000 } =
    opts;
  const [selectedText, setSelectedText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [title, setTitle] = useState(initialTitle ?? "Untitled Document");
  const [pageSettings, setPageSettings] =
    useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
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
      // Keep toolbar dropdowns/active states reflecting the cursor position.
      setSelectionTick((n) => n + 1);
    },
    onUpdate({ editor }) {
      const words = editor.storage.characterCount?.words?.() ?? 0;
      setWordCount(words);
    },
    onCreate({ editor }) {
      const words = editor.storage.characterCount?.words?.() ?? 0;
      setWordCount(words);
    },
  });

  // Tiptap's useEditor only reads `content` at creation time. When the editor
  // page bootstraps an uploaded document asynchronously (sessionStorage), the
  // editor already exists and is empty, so push the content in once it arrives.
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
  }, [editor, initialContent]);

  // Sync title when an initial title arrives asynchronously (useState's
  // initializer only runs on first render, so a later value is otherwise lost).
  useEffect(() => {
    if (initialTitle === undefined) return;
    setTitle(initialTitle);
  }, [initialTitle]);

  // Autosave to the database (PUT /api/documents/[id]). We debounce on edits,
  // flush on a steady interval, and flush when the tab is hidden/closed so
  // nothing is lost. `saveRef` lets the title effect reuse the same writer.
  const titleRef = useRef(title);
  titleRef.current = title;
  const saveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!editor || !documentId) return;

    const save = async () => {
      try {
        const html = editor.getHTML();
        const contentJson = editor.getJSON();
        // keepalive lets the request finish even as the tab is closing.
        await fetch(`/api/documents/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, contentJson, title: titleRef.current }),
          keepalive: true,
        });
      } catch {
        // ignore
      }
    };
    saveRef.current = save;

    let debounce: number | undefined;
    const onUpdate = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void save(), 1500);
    };
    editor.on("update", onUpdate);

    const interval = window.setInterval(() => void save(), autosaveMs);

    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    const onBeforeUnload = () => void save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(interval);
      editor.off("update", onUpdate);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void save(); // flush on unmount (e.g. navigating back to the document list)
    };
  }, [editor, autosaveMs, documentId]);

  // Renaming the document should persist too — debounce a save on title change.
  useEffect(() => {
    if (!editor || !documentId) return;
    const id = window.setTimeout(() => void saveRef.current(), 1500);
    return () => window.clearTimeout(id);
  }, [title, editor, documentId]);

  return {
    editor,
    selectedText,
    wordCount,
    title,
    setTitle,
    pageSettings,
    setPageSettings,
    saveNow: () => saveRef.current(),
  };
}
