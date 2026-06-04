import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a page break at the current cursor position. */
      insertPageBreak: () => ReturnType;
    };
  }
}

/**
 * A simple atomic page-break node. It renders a visible divider in the editor
 * and a CSS page-break when printing/exporting.
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "page-break",
      }),
      ["span", { class: "page-break-label" }, "Page Break"],
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            .createParagraphNear()
            .focus()
            .run(),
    };
  },
});
