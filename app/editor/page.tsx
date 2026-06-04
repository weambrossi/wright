"use client";

import { useEffect, useRef, useState } from "react";
import { useWrightEditor, STORAGE_KEYS } from "@/hooks/useEditor";
import { useDocumentImport } from "@/hooks/useDocumentImport";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { Toolbar } from "@/components/editor/Toolbar";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { AISidebar } from "@/components/ai/AISidebar";
import { ToastHost, useToasts } from "@/components/ui/Toast";

const PENDING_HTML_KEY = "wright:pending-html";
const PENDING_FILENAME_KEY = "wright:pending-filename";

export default function EditorPage() {
  const [initialContent, setInitialContent] = useState<string | undefined>(
    undefined
  );
  const [initialTitle, setInitialTitle] = useState<string | undefined>(undefined);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, push, dismiss } = useToasts();
  const { importFile } = useDocumentImport();

  // Bootstrap from sessionStorage (uploaded on landing) or localStorage (resume).
  useEffect(() => {
    if (bootstrapped) return;
    const pendingHtml = sessionStorage.getItem(PENDING_HTML_KEY);
    const pendingName = sessionStorage.getItem(PENDING_FILENAME_KEY);
    if (pendingHtml) {
      sessionStorage.removeItem(PENDING_HTML_KEY);
      sessionStorage.removeItem(PENDING_FILENAME_KEY);
      setInitialContent(pendingHtml);
      if (pendingName) setInitialTitle(pendingName);
      setBootstrapped(true);
      const words = stripWords(pendingHtml);
      push({
        text: `Document loaded — ${words.toLocaleString()} words`,
        kind: "success",
      });
      return;
    }
    setBootstrapped(true);
  }, [bootstrapped, push]);

  const { editor, selectedText, wordCount, title, setTitle } =
    useWrightEditor({
      initialContent,
      initialTitle,
    });

  // Offer resume from autosave if no pending upload.
  useEffect(() => {
    if (!editor || !bootstrapped) return;
    if (initialContent) return; // just loaded a fresh doc
    const saved = localStorage.getItem(STORAGE_KEYS.CONTENT);
    if (!saved || !saved.trim()) return;
    const currentEmpty = editor.isEmpty;
    if (!currentEmpty) return;
    push({
      text: "Resume your last session?",
      kind: "info",
      action: {
        label: "Resume",
        onClick: () => {
          editor.commands.setContent(saved, false);
        },
      },
    });
  }, [editor, bootstrapped, initialContent, push]);

  // Cmd+S export shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, title]);

  const handleExport = async () => {
    if (!editor) return;
    try {
      const html = editor.getHTML();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilename(title)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ text: `Exported to ${safeFilename(title)}.docx`, kind: "success" });
    } catch {
      push({ text: "Export failed — please try again.", kind: "error" });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const html = await importFile(file);
    e.target.value = ""; // reset
    if (!html) {
      push({ text: "Couldn't read that document.", kind: "error" });
      return;
    }
    editor.commands.setContent(html, false);
    const name = file.name.replace(/\.docx$/i, "");
    setTitle(name);
    push({
      text: `Document loaded — ${stripWords(html).toLocaleString()} words`,
      kind: "success",
    });
  };

  return (
    <div className="h-screen w-screen flex bg-cream-50 overflow-hidden">
      <LeftPanel
        wordCount={wordCount}
        title={title}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleImportChange}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Toolbar
          editor={editor}
          hasSelection={selectedText.length > 0}
          wordCount={wordCount}
          onExport={handleExport}
          onImportClick={handleImportClick}
          onOpenAI={() => setSidebarOpenMobile(true)}
        />
        <EditorCanvas
          editor={editor}
          title={title}
          onTitleChange={setTitle}
        />
      </main>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[340px] shrink-0 h-full">
        <div className="w-full">
          <AISidebar
            editor={editor}
            selectedText={selectedText}
            thinking={false}
            onToast={(t, k) => push({ text: t, kind: k })}
          />
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpenMobile && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-ink-900/30"
          onClick={() => setSidebarOpenMobile(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] h-[85vh] bg-cream-200 rounded-t-modal shadow-toast animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-cream-400" />
            </div>
            <div className="h-[calc(100%-1.5rem)]">
              <AISidebar
                editor={editor}
                selectedText={selectedText}
                thinking={false}
                onToast={(t, k) => push({ text: t, kind: k })}
              />
            </div>
          </div>
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function stripWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(" ").length;
}

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";
}
