import sanitizeHtml from "sanitize-html";

export function sanitizeImportedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "span",
      "div",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      h5: ["style"],
      h6: ["style"],
      span: ["style"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/],
      },
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https", "data"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
      div: "p",
    },
  });
}
