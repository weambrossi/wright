"use client";

import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
  hasSelection: boolean;
  onOpenAI: () => void;
}

export function Toolbar({ editor, hasSelection, onOpenAI }: ToolbarProps) {
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
    <div className="sticky top-0 z-10 bg-cream-200 border-b border-cream-300">
      <div className="max-w-[920px] mx-auto px-4 py-2 flex items-center gap-1 flex-wrap">
        <select
          value={currentBlock}
          onChange={(e) => setBlock(e.target.value)}
          className="bg-cream-100 text-ink-700 text-sm rounded border border-cream-300 px-2 py-1 focus:outline-none focus:border-amber-accent"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <Divider />

        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeftIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenterIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRightIcon />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedIcon />
        </ToolbarButton>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenAI}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-accent text-white text-sm font-medium hover:opacity-90",
            hasSelection ? "animate-pulseGlow" : "",
          ].join(" ")}
        >
          <SparkleIcon />
          AI
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-cream-300 mx-1.5" />;
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={[
        "p-1.5 rounded hover:bg-cream-100",
        active ? "bg-cream-100 text-amber-accent" : "text-ink-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// --- icons (inline so we don't need an icon dep) ---
const sw = 1.6;
function svg(children: React.ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const BoldIcon = () => svg(<><path d="M6 4h8a4 4 0 0 1 0 8H6z" /><path d="M6 12h9a4 4 0 0 1 0 8H6z" /></>);
const ItalicIcon = () => svg(<><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>);
const UnderlineIcon = () => svg(<><path d="M6 4v8a6 6 0 0 0 12 0V4" /><line x1="4" y1="20" x2="20" y2="20" /></>);
const AlignLeftIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></>);
const AlignCenterIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></>);
const AlignRightIcon = () => svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></>);
const BulletIcon = () => svg(<><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>);
const OrderedIcon = () => svg(<><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h2v-2" /><path d="M4 10h2l-2 2h2" /><path d="M4 16h2v1H4v1h2v1H4" /></>);
const SparkleIcon = () => svg(<><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m5.6 18.4 2.1-2.1" /><path d="m16.3 7.7 2.1-2.1" /></>);
