import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL_BY_MODE, CLAUDE_MODEL, MAX_TOKENS } from "@/lib/anthropic";
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  AIRequest,
} from "@/lib/prompts";
import { getWritingGuide } from "@/lib/writingGuide";

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

  let anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return new Response("Server is missing ANTHROPIC_API_KEY", { status: 500 });
  }

  // The craft guide rides along with every request so suggestions stay sharp.
  const guide = getWritingGuide();

  // Build the system prompt and message list per mode. Chat is multi-turn and
  // optionally grounds the model in the current document; everything else is a
  // single built prompt.
  let system: string;
  let messages: Anthropic.MessageParam[];

  if (body.mode === "chat") {
    const turns = (body.messages ?? []).filter((m) => m.content?.trim());
    if (turns.length === 0) {
      return new Response("Missing messages", { status: 400 });
    }
    const docContext = body.documentContent?.trim()
      ? `\n\nThe author's current document (for reference — do not repeat it back unless asked):\n"""\n${body.documentContent.trim()}\n"""`
      : "";
    system = `${CHAT_SYSTEM_PROMPT}\n\n${guide}${docContext}`;
    messages = turns.map((m) => ({ role: m.role, content: m.content }));
  } else {
    system = `${SYSTEM_PROMPT}\n\n${guide}`;
    messages = [{ role: "user", content: buildUserPrompt(body) }];
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL_BY_MODE[body.mode] ?? CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
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
