"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/documentStore";

interface DocumentActionsMenuProps {
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

export function DocumentActionsMenu({
  doc,
  inTrash = false,
  onOpen,
  onRename,
  onDuplicate,
  onStar,
  onTrash,
  onRestore,
  onDeleteForever,
}: DocumentActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const act = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="More options"
        className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-toast">
          {inTrash ? (
            <>
              <MenuItem onClick={() => act(onRestore)}>Restore</MenuItem>
              <div className="my-1 border-t border-neutral-200" />
              <MenuItem onClick={() => act(onDeleteForever)} danger>
                Delete forever
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => act(onOpen)}>Open</MenuItem>
              <MenuItem onClick={() => act(onRename)}>Rename</MenuItem>
              <MenuItem onClick={() => act(onDuplicate)}>
                Make a copy
              </MenuItem>
              <div className="my-1 border-t border-neutral-200" />
              <MenuItem onClick={() => act(onStar)}>
                {doc.isStarred ? "Remove star" : "Star"}
              </MenuItem>
              <div className="my-1 border-t border-neutral-200" />
              <MenuItem onClick={() => act(onTrash)} danger>
                Move to trash
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100",
        danger ? "text-red-700" : "text-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
