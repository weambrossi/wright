import { NextRequest, NextResponse } from "next/server";
import { trashDocument } from "@/lib/documentStore";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    await trashDocument(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Trash failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
