import { NextRequest, NextResponse } from "next/server";
import { resolveConflictRequestSchema } from "@/lib/writing/schemas";
import { resolveConflict, WritingFlowError } from "@/lib/writing/service";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

const bodySchema = resolveConflictRequestSchema.extend({
  manuscriptText: z.string().default(""),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const parsed = bodySchema.safeParse({
      ...(await req.json()),
      requestId: params.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { request, response } = await resolveConflict(parsed.data);
    return NextResponse.json({ response, request });
  } catch (err) {
    if (err instanceof WritingFlowError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
