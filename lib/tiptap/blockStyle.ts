import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockStyle: {
      /** Set the line height (e.g. "1.5") on the current block(s). */
      setLineHeight: (value: string) => ReturnType;
      /** Set space before & after the current block(s) (e.g. "12px"). */
      setParagraphSpacing: (value: string) => ReturnType;
      /** Increase left indent of the current block by one step. */
      indentBlock: () => ReturnType;
      /** Decrease left indent of the current block by one step. */
      outdentBlock: () => ReturnType;
    };
  }
}

const INDENT_STEP = 40; // px per indent level
const MAX_INDENT = 400;

/**
 * Adds block-level layout attributes (line height, paragraph spacing, indent)
 * to paragraphs and headings so the Paragraph group can control spacing and
 * indentation the way a word processor does.
 */
export const BlockStyle = Extension.create({
  name: "blockStyle",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
          },
          marginTop: {
            default: null,
            parseHTML: (el) => el.style.marginTop || null,
            renderHTML: (attrs) =>
              attrs.marginTop ? { style: `margin-top: ${attrs.marginTop}` } : {},
          },
          marginBottom: {
            default: null,
            parseHTML: (el) => el.style.marginBottom || null,
            renderHTML: (attrs) =>
              attrs.marginBottom
                ? { style: `margin-bottom: ${attrs.marginBottom}` }
                : {},
          },
          marginLeft: {
            default: null,
            parseHTML: (el) => el.style.marginLeft || null,
            renderHTML: (attrs) =>
              attrs.marginLeft ? { style: `margin-left: ${attrs.marginLeft}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const applyToActiveBlock = (
      update: (currentMarginLeft: number) => Record<string, unknown>
    ) => {
      return ({ editor, commands }: { editor: any; commands: any }) => {
        for (const type of this.options.types as string[]) {
          if (editor.isActive(type)) {
            const cur = parseInt(editor.getAttributes(type).marginLeft) || 0;
            return commands.updateAttributes(type, update(cur));
          }
        }
        return false;
      };
    };

    return {
      setLineHeight: (value: string) =>
        applyToActiveBlock(() => ({ lineHeight: value })),
      setParagraphSpacing: (value: string) =>
        applyToActiveBlock(() => ({ marginTop: value, marginBottom: value })),
      indentBlock: () =>
        applyToActiveBlock((cur) => ({
          marginLeft: `${Math.min(cur + INDENT_STEP, MAX_INDENT)}px`,
        })),
      outdentBlock: () =>
        applyToActiveBlock((cur) => {
          const next = Math.max(cur - INDENT_STEP, 0);
          return { marginLeft: next === 0 ? null : `${next}px` };
        }),
    };
  },
});
