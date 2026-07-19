import { NextRequest, NextResponse } from "next/server";
import { storyContextUpdateSchema } from "@/lib/writing/schemas";
import {
  deleteStoryContext,
  getStoryContextItem,
  updateStoryContext,
} from "@/lib/writing/storyContextStore";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

/** Ownership check: the caller must know which document the item belongs to.
 *  Prevents blind cross-document edits by id. */
async function requireOwnedItem(id: string, documentId: string | null) {
  const item = await getStoryContextItem(id);
  if (!item) return null;
  if (!documentId || item.documentId !== documentId) return null;
  return item;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const documentId = req.nextUrl.searchParams.get("documentId");
    const item = await requireOwnedItem(params.id, documentId);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = storyContextUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const updated = await updateStoryContext(params.id, parsed.data);
    return NextResponse.json({ item: updated });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const documentId = req.nextUrl.searchParams.get("documentId");
    const item = await requireOwnedItem(params.id, documentId);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await deleteStoryContext(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
