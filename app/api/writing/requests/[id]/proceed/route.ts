import { NextRequest, NextResponse } from "next/server";
import { proceedRequestSchema } from "@/lib/writing/schemas";
import { proceedWithoutAnswering, WritingFlowError } from "@/lib/writing/service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

/** "Generate without answering": skip all open questions and mark the
 *  request ready to generate. Unanswered questions become flagged
 *  assumptions, never confirmed story context. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const parsed = proceedRequestSchema.safeParse({
      ...(await req.json().catch(() => ({}))),
      requestId: params.id,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { request, response } = await proceedWithoutAnswering(
      parsed.data.requestId
    );
    return NextResponse.json({ response, request });
  } catch (err) {
    if (err instanceof WritingFlowError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
