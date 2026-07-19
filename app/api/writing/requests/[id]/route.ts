import { NextRequest, NextResponse } from "next/server";
import { getWritingRequest } from "@/lib/writing/writingRequestStore";
import { cancelRequest, WritingFlowError } from "@/lib/writing/service";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function fail(err: unknown) {
  if (err instanceof WritingFlowError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const request = await getWritingRequest(params.id);
    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ request });
  } catch (err) {
    return fail(err);
  }
}

/** Cancel a pending request. Never touches the document. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const request = await cancelRequest(params.id);
    return NextResponse.json({ request });
  } catch (err) {
    return fail(err);
  }
}
