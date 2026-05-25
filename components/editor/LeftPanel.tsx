"use client";

import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";

interface LeftPanelProps {
  editor: Editor | null;
  wordCount: number;
  title: string;
  onExport: () => void;
  onImportClick: () => void;
}

export function LeftPanel({
  editor,
  wordCount,
  title,
  onExport,
  onImportClick,
}: LeftPanelProps) {
  const router = useRouter();

  return (
    <aside className="w-[52px] shrink-0 bg-cream-200 border-r border-cream-300 flex flex-col items-center py-4 gap-2">
      <IconButton label="Document" onClick={() => router.push("/")}>
        <DocIcon />
      </IconButton>
      <IconButton label="Import .docx" onClick={onImportClick}>
        <ImportIcon />
      </IconButton>
      <IconButton label="Export .docx" onClick={onExport}>
        <ExportIcon />
      </IconButton>
      <IconButton
        label={`${wordCount.toLocaleString()} words · ${title}`}
      >
        <CountIcon />
      </IconButton>
      <div className="my-1 w-6 h-px bg-cream-300" />
      <IconButton
        label="Undo"
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <UndoIcon />
      </IconButton>
      <IconButton
        label="Redo"
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <RedoIcon />
      </IconButton>
    </aside>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="w-9 h-9 rounded grid place-items-center text-ink-500 hover:text-amber-accent hover:bg-cream-100"
    >
      {children}
    </button>
  );
}

const sw = 1.5;
function svg(children: React.ReactNode) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const DocIcon = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /></>);
const ImportIcon = () => svg(<><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>);
const ExportIcon = () => svg(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>);
const CountIcon = () => svg(<><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h16" /></>);
const UndoIcon = () => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></>);
const RedoIcon = () => svg(<><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h4" /></>);
