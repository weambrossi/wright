import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { createDocument, listDocuments } from "@/lib/documentStore";
import type { DocumentFilter, DocumentSort } from "@/lib/documentStore";

export const runtime = "nodejs";

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const filter = (searchParams.get("filter") ?? "recent") as DocumentFilter;
    const q = searchParams.get("q") ?? undefined;
    const sort = (searchParams.get("sort") ?? "updated_at") as DocumentSort;
    return NextResponse.json({ documents: await listDocuments({ filter, q, sort }) });
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
