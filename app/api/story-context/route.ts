import { NextRequest, NextResponse } from "next/server";
import {
  storyContextCreateSchema,
  storyContextCategorySchema,
} from "@/lib/writing/schemas";
import {
  createStoryContext,
  listStoryContext,
} from "@/lib/writing/storyContextStore";
import { getDocument } from "@/lib/documentStore";
import { trackWritingEvent } from "@/lib/writing/analytics";

export const runtime = "nodejs";

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

/** List story context for a document. Always scoped by documentId so one
 *  book can never read another book's canon. */
export async function GET(req: NextRequest) {
  try {
    const documentId = req.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }
    const rawCategory = req.nextUrl.searchParams.get("category");
    const category = rawCategory
      ? storyContextCategorySchema.safeParse(rawCategory)
      : null;
    if (category && !category.success) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const items = await listStoryContext(documentId, {
      category: category?.success ? category.data : undefined,
      q: req.nextUrl.searchParams.get("q") ?? undefined,
      includeSuperseded:
        req.nextUrl.searchParams.get("includeSuperseded") === "true",
    });
    return NextResponse.json({ items });
  } catch (err) {
    return fail(err);
  }
}

/** Manual context entry from the context manager UI. */
export async function POST(req: NextRequest) {
  try {
    const parsed = storyContextCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const doc = await getDocument(parsed.data.documentId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const item = await createStoryContext({
      ...parsed.data,
      source: "manual_entry",
    });
    trackWritingEvent("context_saved", {
      contextId: item.id,
      category: item.category,
      scope: item.scope,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return fail(err);
  }
}
