"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DocumentSummary } from "@/lib/documentStore";

const MENU_WIDTH = 192; // w-48

interface DocumentActionsMenuProps {
  doc: DocumentSummary;
  inTrash?: boolean;
  menuPlacement?: "up" | "down";
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
  menuPlacement = "down",
  onOpen,
  onRename,
  onDuplicate,
  onStar,
  onTrash,
  onRestore,
  onDeleteForever,
}: DocumentActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 220;
    const gap = 4;

    let top =
      menuPlacement === "up"
        ? rect.top - menuHeight - gap
        : rect.bottom + gap;

    // If opening upward would clip off-screen, flip down (and vice versa).
    if (menuPlacement === "up" && top < gap) {
      top = rect.bottom + gap;
    } else if (
      menuPlacement === "down" &&
      top + menuHeight > window.innerHeight - gap
    ) {
      top = rect.top - menuHeight - gap;
    }

    const left = Math.min(
      Math.max(gap, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - gap
    );

    setMenuPos({ top, left });
  }, [menuPlacement]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    const id = requestAnimationFrame(() => updateMenuPosition());
    return () => cancelAnimationFrame(id);
  }, [open, inTrash, doc.isStarred, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onScrollOrResize = () => updateMenuPosition();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  const act = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const menu = open && menuPos && (
    <div
      ref={menuRef}
      role="menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
      className="fixed z-[100] overflow-hidden rounded-lg border border-neutral-300 bg-white py-1 shadow-toast"
    >
      {inTrash ? (
        <>
          <MenuItem onClick={() => act(onRestore)}>Restore</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => act(onDeleteForever)} danger>
            Delete forever
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem onClick={() => act(onOpen)}>Open</MenuItem>
          <MenuItem onClick={() => act(onRename)}>Rename</MenuItem>
          <MenuItem onClick={() => act(onDuplicate)}>Make a copy</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => act(onStar)}>
            {doc.isStarred ? "Remove star" : "Add star"}
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => act(onTrash)} danger>
            Move to trash
          </MenuItem>
        </>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Actions for ${doc.title || "Untitled Document"}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title="More options"
        className={[
          "flex h-7 w-7 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900",
          open ? "bg-neutral-100 text-neutral-900" : "",
        ].join(" ")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-neutral-200" />;
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
      role="menuitem"
      onClick={onClick}
      className={[
        "block w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-100",
        danger ? "text-red-700 hover:bg-red-50" : "text-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
