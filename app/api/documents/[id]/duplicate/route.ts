import { NextRequest, NextResponse } from "next/server";
import { duplicateDocument } from "@/lib/documentStore";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const doc = await duplicateDocument(params.id);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Duplicate failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
