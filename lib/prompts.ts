export type AIMode = "grammar" | "brainstorm" | "rewrite" | "continue";

export type ContinueTone =
  | "Match my style"
  | "More descriptive"
  | "More concise"
  | "More dialogue";

export const SYSTEM_PROMPT = `You are PageMind, a warm and precise writing assistant embedded in a book-writing editor. The user is an author working on a personal book. Be encouraging, specific, and treat their writing with respect. Never be dismissive of their voice or style. Respond only with the content requested — no preamble, no meta-commentary.`;

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
}

export function buildUserPrompt(req: AIRequest): string {
  switch (req.mode) {
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
