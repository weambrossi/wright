"use client";

import type { Editor } from "@tiptap/react";
import type { PageSettings } from "@/lib/pageSettings";
import { HomeTab } from "./HomeTab";
import { InsertTab } from "./InsertTab";
import { LayoutTab } from "./LayoutTab";

export type TabId = "home" | "insert" | "layout" | "ai";

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
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function RibbonToolbar({
  editor,
  pageSettings,
  setPageSettings,
  activeTab,
  onTabChange,
  onOpenFind,
  onOpenReplace,
  onToast,
}: RibbonToolbarProps) {

  return (
    <div className="z-20 border-b border-neutral-300 bg-neutral-100">
      {/* Tab row */}
      <div className="flex items-center gap-1 px-3 pt-1.5">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
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

      {/* Ribbon body — hidden on AI tab (full chat replaces it) */}
      {activeTab !== "ai" && (
        <div className="overflow-x-auto border-t border-neutral-200 bg-white">
          <div className="flex min-h-[88px] min-w-max items-stretch px-3 py-2">
            {editor && activeTab === "home" && (
              <HomeTab
                editor={editor}
                onOpenFind={onOpenFind}
                onOpenReplace={onOpenReplace}
                onToast={onToast}
              />
            )}
            {editor && activeTab === "insert" && (
              <InsertTab editor={editor} onToast={onToast} />
            )}
            {editor && activeTab === "layout" && (
              <LayoutTab
                editor={editor}
                pageSettings={pageSettings}
                setPageSettings={setPageSettings}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
