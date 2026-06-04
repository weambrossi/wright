"use client";

import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";

interface ToolbarProps {
  editor: Editor | null;
  hasSelection: boolean;
  wordCount: number;
  onExport: () => void;
  onImportClick: () => void;
  onOpenAI: () => void;
}

export function Toolbar({
  editor,
  hasSelection,
  wordCount,
  onExport,
  onImportClick,
  onOpenAI,
}: ToolbarProps) {
  if (!editor) return null;

  const currentBlock = (() => {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "p";
  })();

  const setBlock = (value: string) => {
    if (value === "p") editor.chain().focus().setParagraph().run();
    else if (value === "h1")
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (value === "h2")
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (value === "h3")
      editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  return (
    <div className="sticky top-0 z-20 border-b border-cream-300 bg-cream-100 shadow-sm">
      <div className="flex h-9 items-end gap-6 border-b border-cream-300 px-4">
        <div className="flex h-full items-center border-b-2 border-amber-accent px-1 text-sm font-bold text-ink-900">
          Home
        </div>
        <div className="flex h-full items-center px-1 text-sm font-semibold text-ink-500">
          Insert
        </div>
        <div className="flex h-full items-center px-1 text-sm font-semibold text-ink-500">
          Review
        </div>
        <div className="ml-auto flex h-full items-center text-xs font-semibold text-ink-500">
          {wordCount.toLocaleString()} words
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-h-[62px] min-w-max items-center gap-1 px-3 py-2">
          <ToolbarButton
            label="Import"
            description="Open a Word document from your computer"
            showLabel={false}
            onClick={onImportClick}
          >
            <ImportIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Export"
            description="Download this document as a Word file"
            showLabel={false}
            onClick={onExport}
          >
            <ExportIcon />
          </ToolbarButton>

          <SectionDivider />

          <ToolbarButton
            label="Undo"
            description="Go back one editing step"
            showLabel={false}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <UndoIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            description="Restore the last undone edit"
            showLabel={false}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <RedoIcon />
          </ToolbarButton>

          <SectionDivider />

          <label className="group relative mr-1 flex flex-col gap-1 text-[11px] font-bold text-ink-500">
            Text style
            <select
              value={currentBlock}
              onChange={(e) => setBlock(e.target.value)}
              title="Text style: choose paragraph or heading"
              className="h-9 w-[130px] rounded border border-cream-300 bg-white px-2 text-sm font-semibold text-ink-900 shadow-sm focus:border-amber-accent focus:outline-none focus:ring-2 focus:ring-amber-light"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>
            <Tooltip
              label="Text style"
              description="Choose paragraph text or a heading style"
            />
          </label>

          <SectionDivider />

          <ToolbarButton
            label="Bold"
            description="Make selected text thicker"
            showLabel={false}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            description="Slant selected text"
            showLabel={false}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            description="Draw a line under selected text"
            showLabel={false}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarButton>

          <SectionDivider />

          <ToolbarButton
            label="Left"
            description="Line text up with the left margin"
            showLabel={false}
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Center"
            description="Center text on the page"
            showLabel={false}
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Right"
            description="Line text up with the right margin"
            showLabel={false}
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRightIcon />
          </ToolbarButton>

          <SectionDivider />

          <ToolbarButton
            label="Bullets"
            description="Make a bullet list"
            showLabel={false}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <BulletIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Numbers"
            description="Make a numbered list"
            showLabel={false}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <OrderedIcon />
          </ToolbarButton>

          <SectionDivider />

          <button
            type="button"
            title="Writing Helper: open AI tools for rewriting, grammar, brainstorming, and continuing"
            aria-label="Writing Helper: open AI tools"
            onClick={onOpenAI}
            className={[
              "group relative inline-flex h-10 items-center gap-1.5 rounded border border-[#8d5f24] bg-amber-accent px-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#a66a24] focus:outline-none focus:ring-2 focus:ring-amber-light focus:ring-offset-2",
              hasSelection ? "animate-pulseGlow" : "",
            ].join(" ")}
          >
            <SparkleIcon />
            Helper
            <Tooltip
              label="Writing Helper"
              description="Open AI tools for rewriting, grammar, brainstorming, and continuing"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionDivider() {
  return <div className="mx-0.5 h-10 w-px shrink-0 bg-cream-300" />;
}

function ToolbarButton({
  label,
  description,
  showLabel = true,
  active,
  onClick,
  children,
}: {
  label: string;
  description: string;
  showLabel?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        title={`${label}: ${description}`}
        aria-label={`${label}: ${description}`}
        aria-pressed={active}
        onClick={onClick}
        className={[
          "flex h-10 items-center rounded border text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-light focus:ring-offset-2",
          showLabel ? "gap-1.5 px-2" : "w-9 justify-center px-1",
          active
            ? "border-amber-accent bg-amber-light text-ink-900"
            : "border-transparent bg-transparent text-ink-900 hover:border-cream-300 hover:bg-white",
        ].join(" ")}
      >
        <span className="grid h-7 w-7 place-items-center text-ink-900">
          {children}
        </span>
        {showLabel && (
          <span className="whitespace-nowrap leading-tight">{label}</span>
        )}
      </button>
      <Tooltip label={label} description={description} />
    </div>
  );
}

function Tooltip({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-[240px] -translate-x-1/2 rounded bg-[#111827] px-3 py-2 text-left text-xs font-medium text-white shadow-lg group-hover:block group-focus-within:block"
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-[#dbe4f0]">{description}</span>
    </span>
  );
}

// --- icons (inline so we don't need an icon dep) ---
const sw = 2.4;
function svg(children: ReactNode) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const BoldIcon = () => <span className="text-xl font-black leading-none">B</span>;
const ItalicIcon = () => <span className="font-serif text-2xl font-black italic leading-none">I</span>;
const UnderlineIcon = () => <span className="text-xl font-black leading-none underline underline-offset-4">U</span>;
const AlignLeftIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></>);
const AlignCenterIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></>);
const AlignRightIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></>);
const BulletIcon = () => svg(<><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>);
const OrderedIcon = () => svg(<><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h2v-2" /><path d="M4 10h2l-2 2h2" /><path d="M4 16h2v1H4v1h2v1H4" /></>);
const SparkleIcon = () => svg(<><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m5.6 18.4 2.1-2.1" /><path d="m16.3 7.7 2.1-2.1" /></>);
const ImportIcon = () => svg(<><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>);
const ExportIcon = () => svg(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>);
const UndoIcon = () => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></>);
const RedoIcon = () => svg(<><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h4" /></>);
