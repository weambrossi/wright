import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import {
  deleteDocument,
  getDocument,
  touchLastOpenedAt,
  updateDocument,
} from "@/lib/documentStore";

export const runtime = "nodejs";

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const doc = await getDocument(params.id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Update last_opened_at without blocking the response
    void touchLastOpenedAt(params.id).catch(() => {});
    return NextResponse.json(doc);
  } catch (err) {
    return fail(err);
  }
}

// Full content save (manual save from editor)
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const body = (await req.json()) as {
      html?: string;
      title?: string;
      contentJson?: JSONContent;
    };
    await updateDocument(params.id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

// Lightweight field patches (title rename, etc.)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = (await req.json()) as {
      title?: string;
    };
    await updateDocument(params.id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await deleteDocument(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
