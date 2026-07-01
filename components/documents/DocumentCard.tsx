"use client";

import type { DocumentSummary } from "@/lib/documentStore";
import { DocumentActionsMenu } from "./DocumentActionsMenu";

interface DocumentCardProps {
  doc: DocumentSummary;
  inTrash?: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onStar: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}

export function DocumentCard({
  doc,
  inTrash = false,
  onOpen,
  onRename,
  onDuplicate,
  onStar,
  onTrash,
  onRestore,
  onDeleteForever,
}: DocumentCardProps) {
  const typeLabel = getTypeLabel(doc);

  return (
    <div className="group flex flex-col rounded-lg border border-neutral-300 bg-white transition hover:border-blue-400 hover:shadow-paper">
      {/* Preview — click to open */}
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-36 w-full items-center justify-center overflow-hidden rounded-t-lg bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
        >
          <DocumentPageIcon type={doc.documentType} />
        </button>

        {!inTrash && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStar();
            }}
            title={doc.isStarred ? "Remove star" : "Star"}
            aria-label={doc.isStarred ? "Remove star" : "Star document"}
            aria-pressed={doc.isStarred}
            className={[
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-sm transition",
              doc.isStarred
                ? "border-blue-200 text-blue-600"
                : "border-neutral-200/80 text-neutral-400 hover:border-blue-200 hover:text-blue-600",
            ].join(" ")}
          >
            <StarIcon filled={doc.isStarred} />
          </button>
        )}
      </div>

      {/* Footer — title + actions inside the card */}
      <div className="flex items-start gap-1 border-t border-neutral-200 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <p className="truncate text-sm font-medium text-neutral-900">
            {doc.title || "Untitled Document"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {formatWhen(doc.updatedAt)}
          </p>
          {typeLabel && (
            <p className="mt-0.5 truncate text-xs text-neutral-400">{typeLabel}</p>
          )}
        </button>

        <DocumentActionsMenu
          doc={doc}
          inTrash={inTrash}
          menuPlacement="up"
          onOpen={onOpen}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onStar={onStar}
          onTrash={onTrash}
          onRestore={onRestore}
          onDeleteForever={onDeleteForever}
        />
      </div>
    </div>
  );
}

function DocumentPageIcon({ type }: { type: string }) {
  const isPdf = type === "imported_pdf";
  return (
    <div className="relative h-[84px] w-[64px] rounded-sm bg-white shadow-paper">
      <div className="absolute right-0 top-0 h-4 w-4 border-b border-l border-neutral-200 bg-neutral-100" />
      <div className="absolute inset-x-3 top-6 space-y-1.5">
        <div className="h-[3px] rounded-full bg-neutral-200" />
        <div className="h-[3px] w-4/5 rounded-full bg-neutral-200" />
        <div className="h-[3px] rounded-full bg-neutral-200" />
        <div className="h-[3px] w-3/5 rounded-full bg-neutral-200" />
        {!isPdf && <div className="h-[3px] rounded-full bg-neutral-200" />}
        {!isPdf && (
          <div className="h-[3px] w-4/5 rounded-full bg-neutral-200" />
        )}
      </div>
      {isPdf && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-red-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700">
          PDF
        </div>
      )}
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function getTypeLabel(doc: DocumentSummary): string | null {
  if (doc.sourceFileName) {
    if (doc.sourceFileType === "pdf") return "PDF reference";
    return `From ${doc.sourceFileName}`;
  }
  switch (doc.documentType) {
    case "imported_docx":
      return "Imported Word doc";
    case "imported_pdf":
      return "PDF reference";
    case "imported_txt":
      return "Imported text";
    case "imported_md":
      return "Imported Markdown";
    default:
      return null;
  }
}

export function formatWhen(iso: string): string {
  if (!iso) return "just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
