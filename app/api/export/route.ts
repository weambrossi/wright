import { NextRequest } from "next/server";
// @ts-expect-error - html-to-docx has no types
import HTMLtoDOCX from "html-to-docx";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { html, title } = (await req.json()) as {
      html: string;
      title?: string;
    };

    if (typeof html !== "string") {
      return new Response("Missing html", { status: 400 });
    }

    const documentTitle = title || "My Document";
    const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
      documentTitle
    )}</title></head><body>${html}</body></html>`;

    const docxBuffer: Buffer = await HTMLtoDOCX(wrappedHtml, null, {
      title: documentTitle,
      orientation: "portrait",
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    });

    return new Response(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="document.docx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to export";
    return new Response(msg, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
