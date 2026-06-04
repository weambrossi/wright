// Page layout model for the document canvas. Dimensions are in CSS pixels at
// 96dpi, which matches how browsers map inches (1in = 96px).

export type PageSize = "letter" | "a4";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "normal" | "narrow" | "wide";
export type ColumnCount = 1 | 2 | 3;

export interface PageSettings {
  size: PageSize;
  orientation: Orientation;
  margins: MarginPreset;
  columns: ColumnCount;
  showHeader: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;
  headerText: string;
  footerText: string;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: "letter",
  orientation: "portrait",
  margins: "normal",
  columns: 1,
  showHeader: false,
  showFooter: false,
  showPageNumbers: false,
  headerText: "",
  footerText: "",
};

// Width x height in px (portrait).
const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 }, // 8.5in x 11in
  a4: { width: 794, height: 1123 }, // 210mm x 297mm
};

// Margin presets in px (1in = 96px).
export const MARGIN_PRESETS: Record<MarginPreset, number> = {
  normal: 96, // 1in
  narrow: 48, // 0.5in
  wide: 144, // 1.5in
};

export function getPageDimensions(settings: PageSettings) {
  const base = PAGE_DIMENSIONS[settings.size];
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width };
  }
  return base;
}

export function getMarginPx(settings: PageSettings) {
  return MARGIN_PRESETS[settings.margins];
}
