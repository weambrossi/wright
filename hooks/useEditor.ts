"use client";

import { useEditor as useTiptap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";

const STORAGE_KEY = "wright:document-html";
const TITLE_KEY = "wright:document-title";

export interface UseEditorOptions {
  initialContent?: string;
  initialTitle?: string;
  autosaveMs?: number;
}

export function useWrightEditor(opts: UseEditorOptions = {}) {
  const { initialContent = "", initialTitle, autosaveMs = 30_000 } = opts;
  const [selectedText, setSelectedText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [title, setTitle] = useState(initialTitle ?? "Untitled Document");

  const editor = useTiptap({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Typography,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
      Placeholder.configure({
        placeholder:
          "Begin writing, or upload a document to get started...",
      }),
    ],
    content: initialContent,
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

  // Title persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialTitle !== undefined) return;
    const saved = localStorage.getItem(TITLE_KEY);
    if (saved) setTitle(saved);
  }, [initialTitle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TITLE_KEY, title);
  }, [title]);

  // Autosave
  useEffect(() => {
    if (!editor) return;
    const id = window.setInterval(() => {
      try {
        const html = editor.getHTML();
        localStorage.setItem(STORAGE_KEY, html);
      } catch {
        // ignore
      }
    }, autosaveMs);
    return () => window.clearInterval(id);
  }, [editor, autosaveMs]);

  return {
    editor,
    selectedText,
    wordCount,
    title,
    setTitle,
  };
}

export const STORAGE_KEYS = {
  CONTENT: STORAGE_KEY,
  TITLE: TITLE_KEY,
};
