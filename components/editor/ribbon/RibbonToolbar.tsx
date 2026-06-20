"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import type { PageSettings } from "@/lib/pageSettings";
import type { AIAction } from "@/components/ai/AISidebar";
import { HomeTab } from "./HomeTab";
import { InsertTab } from "./InsertTab";
import { LayoutTab } from "./LayoutTab";
import { AITab } from "./AITab";

type TabId = "home" | "insert" | "layout" | "ai";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "ai", label: "AI Assistant" },
];

interface RibbonToolbarProps {
  editor: Editor | null;
  pageSettings: PageSettings;
  setPageSettings: (next: PageSettings) => void;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onOpenAI: (action?: AIAction) => void;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function RibbonToolbar({
  editor,
  pageSettings,
  setPageSettings,
  onOpenFind,
  onOpenReplace,
  onOpenAI,
  onToast,
}: RibbonToolbarProps) {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <div className="z-20 border-b border-neutral-300 bg-neutral-100">
      {/* Tab row */}
      <div className="flex items-center gap-1 px-3 pt-1.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-t px-3 py-1.5 text-[13px] font-medium",
                active
                  ? "border-b-2 border-blue-600 bg-white text-blue-700"
                  : "border-b-2 border-transparent text-neutral-600 hover:bg-neutral-200/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Ribbon body */}
      <div className="overflow-x-auto border-t border-neutral-200 bg-white">
        <div className="flex min-h-[88px] min-w-max items-stretch px-3 py-2">
          {editor && tab === "home" && (
            <HomeTab
              editor={editor}
              onOpenFind={onOpenFind}
              onOpenReplace={onOpenReplace}
              onToast={onToast}
            />
          )}
          {editor && tab === "insert" && (
            <InsertTab editor={editor} onToast={onToast} />
          )}
          {editor && tab === "layout" && (
            <LayoutTab
              editor={editor}
              pageSettings={pageSettings}
              setPageSettings={setPageSettings}
            />
          )}
          {tab === "ai" && <AITab onOpenAI={onOpenAI} />}
        </div>
      </div>
    </div>
  );
}
