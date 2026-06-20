import { NextRequest } from "next/server";
import { getAnthropic, MODEL_BY_MODE, CLAUDE_MODEL, MAX_TOKENS } from "@/lib/anthropic";
import { buildUserPrompt, SYSTEM_PROMPT, AIRequest } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: AIRequest;
  try {
    body = (await req.json()) as AIRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.mode) {
    return new Response("Missing mode", { status: 400 });
  }

  const userPrompt = buildUserPrompt(body);

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return new Response("Server is missing ANTHROPIC_API_KEY", { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL_BY_MODE[body.mode] ?? CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        messageStream.on("text", (text: string) => {
          controller.enqueue(encoder.encode(text));
        });

        await messageStream.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error from Claude";
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
