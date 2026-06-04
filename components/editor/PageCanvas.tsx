"use client";

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import {
  getPageDimensions,
  getMarginPx,
  type PageSettings,
} from "@/lib/pageSettings";

interface PageCanvasProps {
  editor: Editor | null;
  pageSettings: PageSettings;
  setPageSettings: (next: PageSettings) => void;
  /** Overlay (e.g. find/replace panel) rendered above the canvas. */
  overlay?: ReactNode;
}

export function PageCanvas({
  editor,
  pageSettings,
  setPageSettings,
  overlay,
}: PageCanvasProps) {
  const { width, height } = getPageDimensions(pageSettings);
  const margin = getMarginPx(pageSettings);

  return (
    <div className="relative flex-1 overflow-auto bg-neutral-200">
      {overlay}
      <div className="flex justify-center px-6 py-8">
        <div
          className="page-sheet flex flex-col bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.12)]"
          style={{ width, minHeight: height, padding: margin }}
        >
          {pageSettings.showHeader && (
            <input
              value={pageSettings.headerText}
              onChange={(e) =>
                setPageSettings({ ...pageSettings, headerText: e.target.value })
              }
              placeholder="Header"
              className="mb-4 w-full border-b border-dashed border-neutral-200 bg-transparent pb-2 text-xs text-neutral-500 outline-none"
            />
          )}

          <div
            className="flex-1"
            style={
              pageSettings.columns > 1
                ? {
                    columnCount: pageSettings.columns,
                    columnGap: 32,
                  }
                : undefined
            }
          >
            <EditorContent editor={editor} />
          </div>

          {(pageSettings.showFooter || pageSettings.showPageNumbers) && (
            <div className="mt-4 flex items-center justify-between border-t border-dashed border-neutral-200 pt-2 text-xs text-neutral-500">
              {pageSettings.showFooter ? (
                <input
                  value={pageSettings.footerText}
                  onChange={(e) =>
                    setPageSettings({
                      ...pageSettings,
                      footerText: e.target.value,
                    })
                  }
                  placeholder="Footer"
                  className="flex-1 bg-transparent outline-none"
                />
              ) : (
                <span />
              )}
              {pageSettings.showPageNumbers && <span>1</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
