import { NextRequest, NextResponse } from "next/server";
import { toggleStarDocument } from "@/lib/documentStore";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const isStarred = await toggleStarDocument(params.id);
    return NextResponse.json({ isStarred });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Star failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
