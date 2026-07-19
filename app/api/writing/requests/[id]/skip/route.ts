import { NextRequest, NextResponse } from "next/server";
import { skipQuestionRequestSchema } from "@/lib/writing/schemas";
import { skipQuestion, WritingFlowError } from "@/lib/writing/service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const parsed = skipQuestionRequestSchema.safeParse({
      ...(await req.json()),
      requestId: params.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { request, response } = await skipQuestion(parsed.data);
    return NextResponse.json({ response, request });
  } catch (err) {
    if (err instanceof WritingFlowError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
