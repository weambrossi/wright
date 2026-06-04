"use client";

import type { Editor } from "@tiptap/react";
import {
  Group,
  Row,
  RibbonButton,
  RibbonSelect,
  RibbonTile,
} from "./RibbonPrimitives";
import { PageBreakIcon } from "./icons";
import type { PageSettings, ColumnCount } from "@/lib/pageSettings";

export function LayoutTab({
  editor,
  pageSettings,
  setPageSettings,
}: {
  editor: Editor;
  pageSettings: PageSettings;
  setPageSettings: (next: PageSettings) => void;
}) {
  const patch = (p: Partial<PageSettings>) =>
    setPageSettings({ ...pageSettings, ...p });

  return (
    <>
      <Group label="Page Setup">
        <div className="flex flex-col gap-1">
          <Row>
            <label className="text-[11px] text-neutral-500">Size</label>
            <RibbonSelect
              title="Page size"
              width={84}
              value={pageSettings.size}
              onChange={(v) => patch({ size: v as PageSettings["size"] })}
            >
              <option value="letter">Letter</option>
              <option value="a4">A4</option>
            </RibbonSelect>
            <label className="ml-1 text-[11px] text-neutral-500">Margins</label>
            <RibbonSelect
              title="Margins"
              width={88}
              value={pageSettings.margins}
              onChange={(v) =>
                patch({ margins: v as PageSettings["margins"] })
              }
            >
              <option value="normal">Normal</option>
              <option value="narrow">Narrow</option>
              <option value="wide">Wide</option>
            </RibbonSelect>
          </Row>
          <Row>
            <label className="text-[11px] text-neutral-500">Orientation</label>
            <RibbonSelect
              title="Orientation"
              width={96}
              value={pageSettings.orientation}
              onChange={(v) =>
                patch({ orientation: v as PageSettings["orientation"] })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </RibbonSelect>
            <label className="ml-1 text-[11px] text-neutral-500">Columns</label>
            <RibbonSelect
              title="Columns"
              width={64}
              value={String(pageSettings.columns)}
              onChange={(v) =>
                patch({ columns: Number(v) as ColumnCount })
              }
            >
              <option value="1">One</option>
              <option value="2">Two</option>
              <option value="3">Three</option>
            </RibbonSelect>
          </Row>
        </div>
      </Group>
      <div className="mx-1 h-12 w-px shrink-0 self-center bg-neutral-200" />
      <Group label="Breaks">
        <RibbonTile
          title="Insert a page break"
          label="Page Break"
          icon={<PageBreakIcon />}
          onClick={() => editor.chain().focus().insertPageBreak().run()}
        />
      </Group>
      <div className="mx-1 h-12 w-px shrink-0 self-center bg-neutral-200" />
      <Group label="Header & Footer">
        <div className="flex flex-col gap-1">
          <Row>
            <ToggleChip
              label="Header"
              active={pageSettings.showHeader}
              onClick={() => patch({ showHeader: !pageSettings.showHeader })}
            />
            <ToggleChip
              label="Footer"
              active={pageSettings.showFooter}
              onClick={() => patch({ showFooter: !pageSettings.showFooter })}
            />
          </Row>
          <Row>
            <ToggleChip
              label="Page numbers"
              active={pageSettings.showPageNumbers}
              onClick={() =>
                patch({
                  showPageNumbers: !pageSettings.showPageNumbers,
                  showFooter: !pageSettings.showPageNumbers
                    ? true
                    : pageSettings.showFooter,
                })
              }
            />
          </Row>
        </div>
      </Group>
    </>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <RibbonButton
      title={label}
      active={active}
      onClick={onClick}
      className="min-w-0 px-2 text-xs"
    >
      <span className="whitespace-nowrap">{label}</span>
    </RibbonButton>
  );
}
