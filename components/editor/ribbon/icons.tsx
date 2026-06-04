import { Icon } from "./RibbonPrimitives";

// Lettered marks (Bold / Italic / Underline / Strikethrough) read better as
// glyphs than as line icons, matching how Word draws them.
export const BoldGlyph = () => <span className="text-sm font-bold leading-none">B</span>;
export const ItalicGlyph = () => <span className="font-serif text-sm font-bold italic leading-none">I</span>;
export const UnderlineGlyph = () => <span className="text-sm font-bold leading-none underline underline-offset-2">U</span>;
export const StrikeGlyph = () => <span className="text-sm font-bold leading-none line-through">S</span>;

export const AlignLeft = () => <Icon><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></Icon>;
export const AlignCenter = () => <Icon><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></Icon>;
export const AlignRight = () => <Icon><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></Icon>;
export const AlignJustify = () => <Icon><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></Icon>;

export const BulletList = () => <Icon><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Icon>;
export const OrderedList = () => <Icon><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h2v-2" /><path d="M4 10h2l-2 2h2" /><path d="M4 16h2v1H4v1h2v1H4" /></Icon>;
export const Indent = () => <Icon><line x1="11" y1="6" x2="20" y2="6" /><line x1="11" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><polyline points="4 8 7 11 4 14" /></Icon>;
export const Outdent = () => <Icon><line x1="11" y1="6" x2="20" y2="6" /><line x1="11" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><polyline points="7 8 4 11 7 14" /></Icon>;
export const LineSpacing = () => <Icon><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><polyline points="4 8 4 16" /><polyline points="2 9 4 6 6 9" /><polyline points="2 15 4 18 6 15" /></Icon>;

export const TextColor = () => (
  <span className="flex flex-col items-center leading-none">
    <span className="text-[11px] font-bold">A</span>
    <span className="mt-px h-1 w-4 rounded-sm bg-current" />
  </span>
);
export const Highlighter = () => (
  <span className="flex flex-col items-center leading-none">
    <Icon><path d="M9 11l-4 4v3h3l4-4" /><path d="M13 7l4 4" /><path d="M14 4l6 6-5 5-6-6z" /></Icon>
  </span>
);

export const ClearFormat = () => <Icon><path d="M4 7V4h16v3" /><path d="M5 20h6" /><path d="M13 4 8 20" /><line x1="15" y1="13" x2="21" y2="19" /><line x1="21" y1="13" x2="15" y2="19" /></Icon>;

export const Undo = () => <Icon><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></Icon>;
export const Redo = () => <Icon><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h4" /></Icon>;
export const Cut = () => <Icon><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></Icon>;
export const Copy = () => <Icon><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>;
export const Paste = () => <Icon><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></Icon>;
export const SelectAll = () => <Icon><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" /><polyline points="8 12 11 15 16 9" /></Icon>;
export const Search = () => <Icon><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
export const Replace = () => <Icon><path d="M14 4h5v5" /><path d="M19 4l-7 7" /><path d="M10 20H5v-5" /><path d="M5 20l7-7" /></Icon>;

export const ImageIcon = () => <Icon><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Icon>;
export const TableIcon = () => <Icon><rect x="3" y="3" width="18" height="18" rx="1" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></Icon>;
export const LinkIcon = () => <Icon><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></Icon>;
export const HrIcon = () => <Icon><line x1="3" y1="12" x2="21" y2="12" /><line x1="5" y1="6" x2="19" y2="6" opacity="0.35" /><line x1="5" y1="18" x2="19" y2="18" opacity="0.35" /></Icon>;
export const PageBreakIcon = () => <Icon><path d="M6 3h7l5 5v3" /><path d="M6 21h12" /><line x1="3" y1="15" x2="21" y2="15" strokeDasharray="3 3" /></Icon>;
export const ClockIcon = () => <Icon><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></Icon>;

export const PageSize = () => <Icon><rect x="5" y="3" width="14" height="18" rx="1" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /></Icon>;
export const Margins = () => <Icon><rect x="3" y="3" width="18" height="18" rx="1" /><rect x="7" y="7" width="10" height="10" strokeDasharray="2 2" /></Icon>;
export const Orientation = () => <Icon><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M20 8a8 8 0 0 0-3-3" /></Icon>;
export const Columns = () => <Icon><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /></Icon>;

export const Sparkle = () => <Icon><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></Icon>;
