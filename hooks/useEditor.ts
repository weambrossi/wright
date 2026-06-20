"use client";

import { useEditor as useTiptap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect, useRef, useState } from "react";
import { FontSize } from "@/lib/tiptap/fontSize";
import { BlockStyle } from "@/lib/tiptap/blockStyle";
import { PageBreak } from "@/lib/tiptap/pageBreak";
import {
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "@/lib/pageSettings";

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
  const [pageSettings, setPageSettings] =
    useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  // Bumped on every transaction so toolbar active-states stay in sync.
  const [, setSelectionTick] = useState(0);

  const editor = useTiptap({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      Typography,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      BlockStyle,
      PageBreak,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
      Placeholder.configure({
        placeholder: "Begin writing, or upload a document to get started...",
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
    if (appliedContentRef.current === initialContent) return;
    appliedContentRef.current = initialContent;
    editor.commands.setContent(initialContent, true);
  }, [editor, initialContent]);

  // Title persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialTitle !== undefined) return;
    const saved = localStorage.getItem(TITLE_KEY);
    if (saved) setTitle(saved);
  }, [initialTitle]);

  // Sync title when an initial title arrives asynchronously (useState's
  // initializer only runs on first render, so a later value is otherwise lost).
  useEffect(() => {
    if (initialTitle === undefined) return;
    setTitle(initialTitle);
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
    pageSettings,
    setPageSettings,
  };
}

export const STORAGE_KEYS = {
  CONTENT: STORAGE_KEY,
  TITLE: TITLE_KEY,
};
