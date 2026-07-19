import { NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";
import { generateRequestSchema } from "@/lib/writing/schemas";
import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  WRITING_PROMPT_VERSION,
} from "@/lib/writing/prompts";
import { GENERATION_MODEL, loadRelevantContext } from "@/lib/writing/orchestrator";
import {
  reviewDraftForAIPatterns,
  shouldReviewDraft,
} from "@/lib/writing/draftReview";
import {
  getWritingRequest,
  updateWritingRequest,
} from "@/lib/writing/writingRequestStore";
import { trackWritingEvent } from "@/lib/writing/analytics";
import { getWritingGuide } from "@/lib/writingGuide";
import { MAX_TOKENS } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

// Streams the final prose. The structured decision (clarification vs. ready)
// was made by the non-streaming endpoints first, so nothing but prose ever
// streams toward the document or the assistant transcript.
//
// When the author's naturalness setting is anything other than "preserve
// current style", the draft is buffered server-side, run through an internal
// AI-pattern review pass, and only the final (possibly revised) prose is
// streamed to the client. Review failures fall back to the original draft —
// the review can never block a generation.
export async function POST(req: NextRequest, { params }: Ctx) {
  const parsed = generateRequestSchema.safeParse({
    ...(await req.json().catch(() => ({}))),
    requestId: params.id,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const naturalness = parsed.data.naturalness;

  const request = await getWritingRequest(params.id);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // "completed" is allowed so the author can regenerate.
  if (request.status !== "ready_to_generate" && request.status !== "completed") {
    return NextResponse.json(
      { error: "This request is not ready to generate" },
      { status: 409 }
    );
  }
  const isRegenerate = request.status === "completed";

  const { items, manuscript, nearby } = await loadRelevantContext({
    documentId: request.documentId,
    prompt: request.originalPrompt,
    selectedText: request.selectedText,
    manuscriptText: parsed.data.manuscriptText,
  });

  await updateWritingRequest(request.id, { status: "generating" });
  trackWritingEvent(isRegenerate ? "generation_regenerated" : "generation_started", {
    requestId: request.id,
    mode: request.writingControlMode,
    destination: request.destination,
    contextCount: items.length,
    answerCount: Object.keys(request.answers).length,
    naturalness,
  });

  const system = `${buildGenerationSystemPrompt(
    request.writingControlMode,
    naturalness
  )}\n\n${getWritingGuide()}`;
  const user = buildGenerationUserPrompt({
    request,
    contextItems: items,
    manuscript,
    nearby,
  });

  const anthropic = getAnthropic();
  const encoder = new TextEncoder();
  const reviewEnabled = shouldReviewDraft(naturalness);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let draft = "";
        const messageStream = anthropic.messages.stream({
          model: GENERATION_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: "user", content: user }],
        });
        messageStream.on("text", (text: string) => {
          draft += text;
          // Without a review pass, stream live exactly as before.
          if (!reviewEnabled) controller.enqueue(encoder.encode(text));
        });
        await messageStream.finalMessage();

        let draftReviewed = false;
        if (reviewEnabled) {
          // Internal revision pass — the author only ever sees the result.
          const review = await reviewDraftForAIPatterns({
            draft,
            naturalness,
            model: GENERATION_MODEL,
            nearby,
            contextItems: items,
          });
          draftReviewed = review.revised;
          trackWritingEvent(
            review.revised ? "draft_review_applied" : "draft_review_skipped",
            {
              requestId: request.id,
              naturalness,
              patternCount: review.patternsFound.length,
            }
          );
          enqueueChunked(controller, encoder, review.text);
        }

        // Persist "context used" metadata so the author can inspect what
        // grounded this generation — never appended to the prose itself.
        await updateWritingRequest(request.id, {
          status: "completed",
          generationMeta: {
            contextIds: items.map((i) => i.id),
            answerQuestionIds: Object.keys(request.answers),
            writingControlMode: request.writingControlMode,
            assumptions: request.assumptions,
            conflictsResolved: Object.keys(request.savedContextByQuestion).length,
            sourceDocumentId: request.documentId,
            sourceSelection:
              request.selectionStart != null && request.selectionEnd != null
                ? { start: request.selectionStart, end: request.selectionEnd }
                : undefined,
            destination: request.destination,
            model: GENERATION_MODEL,
            promptVersion: WRITING_PROMPT_VERSION,
            timestamp: new Date().toISOString(),
            naturalness,
            draftReviewed,
          },
        });
        trackWritingEvent("generation_completed", { requestId: request.id });
        controller.close();
      } catch (err) {
        // Failure must preserve the author's answers: back to ready state so
        // they can retry generation without re-answering anything.
        await updateWritingRequest(request.id, {
          status: "ready_to_generate",
        }).catch(() => {});
        const msg = err instanceof Error ? err.message : "Generation failed";
        controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Emit reviewed prose in chunks so the client's streaming reader (and its
 *  progressive rendering) keeps working unchanged. */
function enqueueChunked(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  text: string,
  chunkSize = 160
) {
  for (let i = 0; i < text.length; i += chunkSize) {
    controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)));
  }
}
