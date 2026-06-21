export type AIMode = "chat" | "grammar" | "brainstorm" | "rewrite" | "continue";

export type ContinueTone =
  | "Match my style"
  | "More descriptive"
  | "More concise"
  | "More dialogue";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT = `You are Wright, a warm and precise writing assistant embedded in a book-writing editor. The user is an author working on a personal book. Be encouraging, specific, and treat their writing with respect. Never be dismissive of their voice or style. Respond only with the content requested — no preamble, no meta-commentary.`;

// Chat is conversational, so it gets a slightly different posture than the
// single-shot tools: have a real back-and-forth instead of returning bare content.
export const CHAT_SYSTEM_PROMPT = `You are Wright, a warm, plainspoken writing partner embedded in a book-writing editor. The user is an author working on a personal book, and they want to talk things through with you — not just press buttons.

Have a genuine conversation. You can help with anything a great writing coach and line editor would: checking grammar and style, brainstorming ideas and directions, rewriting passages, continuing a draft, and talking through plot, structure, characters, and voice. If they ask for something else writing-related, help with that too.

Be encouraging and specific. Ask a clarifying question when the request is ambiguous; otherwise just help. When you hand back edited or new prose, set it clearly apart from your conversational reply so it is easy to read and copy. Keep your voice warm and human — like a thoughtful editor friend, never a lecture.`;

const toneInstructionMap: Record<ContinueTone, string> = {
  "Match my style": "",
  "More descriptive": "Add more sensory detail and description.",
  "More concise": "Be direct and economical with words.",
  "More dialogue": "Introduce or continue a dialogue if natural.",
};

export interface AIRequest {
  mode: AIMode;
  documentContent?: string;
  selectedText?: string;
  instruction?: string;
  cursorContext?: string;
  userPrompt?: string;
  contextIncluded?: boolean;
  continueFrom?: "cursor" | "end";
  tone?: ContinueTone;
  // Chat mode carries a running conversation instead of a single prompt.
  messages?: ChatMessage[];
}

export function buildUserPrompt(req: AIRequest): string {
  switch (req.mode) {
    case "chat":
      // Chat is multi-turn and handled directly in the API route, not here.
      return req.messages?.[req.messages.length - 1]?.content ?? "";

    case "grammar":
      return `Review the following document for grammar, style, clarity, and flow. Return a JSON array of issue objects. Each object must have:
{ "originalPhrase": string, "suggestedFix": string, "issueType": string, "reason": string }
issueType must be one of: Grammar, Clarity, Wordiness, Tone, Flow.
Return ONLY the JSON array. No explanation. Here is the document:

${req.documentContent ?? ""}`;

    case "brainstorm": {
      const contextLine =
        req.contextIncluded && req.cursorContext
          ? `\nHere is the surrounding paragraph for context:\n${req.cursorContext}\n`
          : "";
      return `The author is working on the following: ${req.userPrompt ?? ""}
${contextLine}
Brainstorm ideas, directions, and possibilities. Be expansive and creative. Format your response as flowing prose, not bullet points.`;
    }

    case "rewrite":
      return `Rewrite the following passage according to this instruction: ${req.instruction ?? ""}
Preserve the author's voice. Return ONLY the rewritten passage, nothing else.
Original passage:
${req.selectedText ?? ""}`;

    case "continue": {
      const tone = req.tone ?? "Match my style";
      const toneInstruction = toneInstructionMap[tone];
      return `Continue writing from where the author left off. Match their voice, pacing, and style precisely. ${toneInstruction}
Here is the document so far (continue from the end):
${req.documentContent ?? ""}`;
    }
  }
}
