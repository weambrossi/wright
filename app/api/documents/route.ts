import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { createDocument, listDocuments } from "@/lib/documentStore";

export const runtime = "nodejs";

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ documents: await listDocuments() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      html?: string;
      contentJson?: JSONContent;
    };
    const doc = await createDocument(body.title, body.html ?? "", body.contentJson);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
