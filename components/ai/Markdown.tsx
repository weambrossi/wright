"use client";

import { useMemo } from "react";
import MarkdownIt from "markdown-it";

// HTML in model output is escaped (html: false), so rendering is injection-safe.
// linkify turns bare URLs into links; breaks keeps single newlines as <br>.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => md.render(text), [text]);
  return (
    <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
