import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { FontSize } from "@/lib/tiptap/fontSize";
import { BlockStyle } from "@/lib/tiptap/blockStyle";
import { PageBreak } from "@/lib/tiptap/pageBreak";

interface WrightExtensionOptions {
  placeholder?: string;
}

export function getWrightExtensions(options: WrightExtensionOptions = {}) {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5] },
    }),
    Typography,
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    BlockStyle,
    PageBreak,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image.configure({ inline: false, allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    CharacterCount,
  ];

  if (options.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      })
    );
  }

  return extensions;
}
