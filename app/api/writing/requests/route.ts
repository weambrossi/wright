import { NextRequest, NextResponse } from "next/server";
import { startWritingRequestSchema } from "@/lib/writing/schemas";
import { startWritingFlow, WritingFlowError } from "@/lib/writing/service";
import { getOpenWritingRequest } from "@/lib/writing/writingRequestStore";
import { getDocument } from "@/lib/documentStore";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(err: unknown) {
  if (err instanceof WritingFlowError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const msg = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: msg }, { status: 500 });
}

/** Start a new writing request: evaluates context and either asks the first
 *  clarification question or reports the request is ready to generate. */
export async function POST(req: NextRequest) {
  try {
    const parsed = startWritingRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Validate document access before creating anything against it.
    const doc = await getDocument(body.documentId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { request, response } = await startWritingFlow({
      create: {
        documentId: body.documentId,
        originalPrompt: body.prompt,
        destination: body.destination,
        documentAction: body.documentAction,
        selectedText: body.selectedText,
        selectionStart: body.selectionStart,
        selectionEnd: body.selectionEnd,
        documentVersion: body.documentVersion,
        writingControlMode: body.writingControlMode,
      },
      manuscriptText: body.manuscriptText,
      conversation: body.conversation,
      askQuestions: body.askQuestions,
    });

    return NextResponse.json({ response, request });
  } catch (err) {
    return fail(err);
  }
}

/** Reopen: the most recent unfinished request for a document, if any. */
export async function GET(req: NextRequest) {
  try {
    const documentId = req.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }
    const request = await getOpenWritingRequest(documentId);
    return NextResponse.json({ request });
  } catch (err) {
    return fail(err);
  }
}
