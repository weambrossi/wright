import type {
  ClarificationAnswer,
  ClarificationQuestion,
  PendingWritingRequest,
  StoryContextItem,
  WritingAssumption,
  WritingControlMode,
} from "./types";
import { formatContextForModel } from "./contextRetrieval";

export const WRITING_PROMPT_VERSION = "writing-workflow-v1";

// ---------------------------------------------------------------------------
// Shared collaborative-writing principles (server-side only; never sent to
// the client). Included in every step of the workflow.
// ---------------------------------------------------------------------------

export const COLLABORATION_PRINCIPLES = `You are Wright, a collaborative writing assistant. The author owns the story, characters, world, plot, themes, relationships, emotional meaning, and creative direction. Your job is to help the author express their intent, not replace it.

Before generating writing, determine whether you have enough author-provided context to produce the requested passage faithfully.

Search the provided manuscript context, stored story context, previous author answers, and current conversation before asking a question. Never ask for information that has already been provided.

Important story information that should come from the author includes: character actions, character emotions, character motivations, character decisions, character relationships, dialogue intentions, plot events, backstory, worldbuilding rules, important setting details, scene outcomes, secrets, revelations, timeline changes, themes, and narrative meaning.

You may create minor incidental details that do not alter story meaning — small environmental details, minor decorations, neutral weather, basic physical transitions, nonessential sensory detail, minor body language, small connective phrases — provided they do not contradict established context.`;

export function modeInstructions(mode: WritingControlMode): string {
  switch (mode) {
    case "ask_me_first":
      return `The current writing control mode is ask_me_first:
- Ask whenever missing information or additional author context could meaningfully improve the result.
- Prefer clarification over creative assumptions.
- Do not invent important story facts.`;
    case "suggest_options":
      return `The current writing control mode is suggest_options:
- Ask when important context is missing.
- Always provide several strong possible answers for the author to choose from.
- Do not choose an important direction for the author.`;
    case "draft_freely":
      return `The current writing control mode is draft_freely:
- Make reasonable creative decisions when necessary instead of asking.
- Only ask when the missing information is truly central to the request.
- Respect all established context; never contradict canon silently.
- Record every meaningful assumption you make so the author can review it.`;
  }
}

const QUESTION_RULES = `Ask one question at a time. You may combine tightly related questions into a single focused question when they naturally belong together (e.g. "What does Elena want Marcus to admit, and why does it matter to her?"). Never bundle unrelated topics into one question.

Do not ask broad questions such as "Can you provide more context?" — identify the exact missing decision.

Questions must be focused, specific, easy to answer, relevant to the current passage, neutral, grounded in existing context, and written in plain language.

When useful, provide 3–5 suggested answers. Suggested answers are options, not decisions — do not treat one as story context unless the author selects it. Ground suggestions in the existing story context, the characters involved, the current scene, and the tone of the manuscript.`;

// ---------------------------------------------------------------------------
// Step 1: evaluation — enough context to write, or ask a question?
// ---------------------------------------------------------------------------

export function buildEvaluationSystemPrompt(mode: WritingControlMode): string {
  return `${COLLABORATION_PRINCIPLES}

${modeInstructions(mode)}

${QUESTION_RULES}

Your task right now is NOT to write. Decide whether you have enough author-provided context to fulfil the writing request faithfully.

If the message is conversation, a question about the craft, or anything that is not a request to produce or edit story prose, respond with decision "not_a_writing_request".

If information is missing that the author should decide, respond with decision "needs_clarification" and exactly ONE question (the single most important one). Estimate how many more questions you expect after this one in remainingQuestionCount.

If you have enough context, respond with decision "ready" and list any assumptions you would need to make, each marked "minor" (does not change the story) or "major" (changes the story). In ask_me_first and suggest_options modes, a major assumption means you should have asked instead — only return "ready" with major assumptions in draft_freely mode.

Respond with ONLY a JSON object, no prose, in one of these shapes:
{"decision":"ready","assumptions":[{"description":"...","importance":"minor"|"major"}]}
{"decision":"needs_clarification","reason":"...","question":{"question":"...","whyItMatters":"...","category":"character_action"|"character_emotion"|"character_motivation"|"relationship"|"dialogue_intent"|"plot"|"backstory"|"setting"|"worldbuilding"|"timeline"|"scene_outcome"|"theme"|"style"|"other","answerType":"short_text"|"long_text"|"single_choice"|"multi_choice","suggestedAnswers":[{"label":"...","description":"..."}]},"remainingQuestionCount":0}
{"decision":"not_a_writing_request"}`;
}

export interface EvaluationContextInput {
  prompt: string;
  selectedText?: string;
  manuscript: string;
  nearby: string;
  contextItems: StoryContextItem[];
  conversation: { role: "user" | "assistant"; content: string }[];
  answeredSoFar: { question: string; answer: string }[];
  previouslyAskedQuestions: string[];
}

export function buildEvaluationUserPrompt(input: EvaluationContextInput): string {
  const conversationBlock =
    input.conversation.length > 0
      ? input.conversation
          .slice(-12)
          .map((m) => `${m.role === "user" ? "Author" : "Wright"}: ${m.content}`)
          .join("\n")
      : "(none)";
  const answersBlock =
    input.answeredSoFar.length > 0
      ? input.answeredSoFar
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n\n")
      : "(none)";
  const askedBlock =
    input.previouslyAskedQuestions.length > 0
      ? input.previouslyAskedQuestions.map((q) => `- ${q}`).join("\n")
      : "(none)";

  return `WRITING REQUEST FROM THE AUTHOR:
"""
${input.prompt}
"""
${input.selectedText?.trim() ? `\nSELECTED TEXT (the passage this request applies to):\n"""\n${input.selectedText.trim()}\n"""\n` : ""}
STORED STORY CONTEXT (author-approved canon — treat as established fact):
${formatContextForModel(input.contextItems)}

CLARIFICATION ANSWERS THE AUTHOR ALREADY GAVE FOR THIS REQUEST (established — never re-ask):
${answersBlock}

QUESTIONS ALREADY ASKED IN THIS REQUEST (never repeat or rephrase these):
${askedBlock}

RECENT CONVERSATION:
${conversationBlock}

MANUSCRIPT (current document; search it before asking anything):
"""
${input.manuscript || "(the document is empty)"}
"""

TEXT NEAREST THE CURSOR/SELECTION:
"""
${input.nearby || "(none)"}
"""

Decide: ready, needs_clarification, or not_a_writing_request. JSON only.`;
}

// ---------------------------------------------------------------------------
// Step 2: contradiction check for a new answer
// ---------------------------------------------------------------------------

export const CONTRADICTION_SYSTEM_PROMPT = `You check whether a new statement from an author contradicts their established story canon. Be precise: only report real contradictions (mutually exclusive facts), not vagueness, elaboration, or new compatible detail. A statement that merely adds information is NOT a contradiction.

Respond with ONLY a JSON object:
{"conflicts":[{"newStatement":"...","existingStatement":"...","existingContextId":"<id of the conflicting stored item, or 'manuscript' when the conflict is with manuscript text>","explanation":"why these two may conflict, phrased for the author, including a possible innocent reading if one exists"}]}

Return {"conflicts":[]} when there is no genuine contradiction.`;

export function buildContradictionUserPrompt(input: {
  question: string;
  answer: string;
  contextItems: StoryContextItem[];
  nearby: string;
}): string {
  return `THE AUTHOR WAS ASKED:
"${input.question}"

THE AUTHOR ANSWERED:
"""
${input.answer}
"""

ESTABLISHED STORY CONTEXT:
${formatContextForModel(input.contextItems)}

NEARBY MANUSCRIPT TEXT:
"""
${input.nearby || "(none)"}
"""

Does the answer genuinely contradict any established fact? JSON only.`;
}

// ---------------------------------------------------------------------------
// Step 3: skip — offer options instead of silently inventing
// ---------------------------------------------------------------------------

export const SKIP_OPTIONS_SYSTEM_PROMPT = `The author skipped a clarification question. Do NOT invent the answer. Offer 3–5 distinct, plausible options grounded in the story context, so the author can pick one, adapt one, or tell you to leave the detail unspecified. Make the options meaningfully different from each other, not variations of one idea.

Respond with ONLY a JSON object:
{"options":[{"label":"short answer the author could pick","description":"optional one-line implication"}]}`;

export function buildSkipOptionsUserPrompt(input: {
  question: ClarificationQuestion;
  prompt: string;
  contextItems: StoryContextItem[];
  nearby: string;
}): string {
  return `THE SKIPPED QUESTION:
"${input.question.question}"
${input.question.whyItMatters ? `(Why it was asked: ${input.question.whyItMatters})` : ""}

THE ORIGINAL WRITING REQUEST:
"""
${input.prompt}
"""

STORY CONTEXT:
${formatContextForModel(input.contextItems)}

NEARBY MANUSCRIPT TEXT:
"""
${input.nearby || "(none)"}
"""

Offer options. JSON only.`;
}

// ---------------------------------------------------------------------------
// Step 4: classify an approved answer for storage (category, scope, names)
// ---------------------------------------------------------------------------

export const CLASSIFY_SYSTEM_PROMPT = `You file an author's clarification answer into their story context database. Infer:
- category: one of character, character_motivation, character_emotion, character_action, relationship, dialogue_intent, plot, backstory, setting, worldbuilding, timeline, scene_outcome, theme, style, other
- scope: "story" for facts true across the whole book (motivations, worldbuilding, backstory, relationships), "scene" for facts about the current scene only (a character's mood right now, this scene's outcome), "request" for one-off preferences about this specific passage (e.g. "make this paragraph lyrical" with no broader intent)
- characterNames: names of characters the fact is about
- canonicalStatement: restate the fact as one clean standalone sentence that will make sense months later without the question (e.g. question "How does Elena feel here?" + answer "angry but hiding it" becomes "In this scene, Elena is angry at Marcus but hiding it.")

Respond with ONLY a JSON object:
{"category":"...","scope":"...","characterNames":["..."],"canonicalStatement":"..."}`;

export function buildClassifyUserPrompt(input: {
  question: string;
  answer: string;
  prompt: string;
}): string {
  return `QUESTION ASKED: "${input.question}"
AUTHOR'S ANSWER: "${input.answer}"
ORIGINAL WRITING REQUEST (for scene context): "${input.prompt}"

Classify for storage. JSON only.`;
}

// ---------------------------------------------------------------------------
// Step 5: final generation
// ---------------------------------------------------------------------------

const WRITING_QUALITY_RULES = `WRITING QUALITY RULES

Originality: avoid generic ideas, familiar story beats presented without variation, safe predictable choices, clichés disguised as poetic language, randomness presented as originality, genre imitation without character specificity, and automatically choosing the most obvious direction.

Voice: preserve the author's established voice. Do not smooth out all imperfections, make every sentence equally polished, make every character sound alike or highly articulate, replace unusual wording merely because conventional wording is cleaner, confuse vocabulary with voice, or add slang that does not match the speaker.

Character: characters act according to established motivations, have distinct speech patterns, possess incomplete self-knowledge, are capable of contradiction, do not explain every emotion, react in ways specific to their history and personality, and retain intentional flaws.

Dialogue: reflect what each character wants; use subtext; avoid information characters already know, overly complete explanations, and perfect arguments; allow interruption, evasion, misunderstanding, and incomplete thoughts; match age, background, knowledge, and relationship dynamics.

Emotion: let emotion emerge through behavior, internal thought, dialogue, rhythm, physical detail, what the character avoids, and what the character notices. Avoid generic racing-heart reactions, excessive crying, immediate emotional clarity, explaining the emotional meaning after showing it, treating grief/fear/anger/love as universal and identical, and resolving emotional tension too neatly.

Description: select meaningful details; reflect the viewpoint character's attention; respect physical space; use sensory detail when relevant; avoid decorative description that does not affect the story and detached-camera description unless requested.

Plot: do not invent major plot turns, use coincidence to solve problems, introduce unsupported revelations, force characters to act unnaturally, create stakes only through death or danger, resolve conflict too quickly, introduce information exactly when convenient, or add a twist only because something surprising was requested.

Theme: do not state the theme directly, explain what the reader should think, add a moral, summarize the lesson, turn characters into simple representatives of positions, or resolve moral ambiguity automatically.

Watch for and avoid overused AI prose patterns (contextual warnings, not banned words): "a tapestry of", "a symphony of", "the air was thick with", "there was something about", "in that moment", "little did they know", "a mix of", "not X, but Y" constructions, three-part lists, heavy em-dash use, rhetorical questions, cosmic metaphors, shadows, echoes, storms, fire, stars, broken glass, racing hearts, clenched fists, held breath.`;

export function buildGenerationSystemPrompt(mode: WritingControlMode): string {
  return `${COLLABORATION_PRINCIPLES}

${modeInstructions(mode)}

You now have the author's approved context. Write the requested passage.

${WRITING_QUALITY_RULES}

OUTPUT RULES
- Return ONLY the requested prose. No preamble, no meta-commentary, no clarification questions, no context summaries, no explanation of choices, no moral or conclusion unless requested.
- Preserve the author's requested length, style, point of view, and tense.
- Treat every stored context item and author answer as established fact.
- Where the author allowed a temporary assumption, honor it exactly as stated; do not extend it.`;
}

export function buildGenerationUserPrompt(input: {
  request: PendingWritingRequest;
  contextItems: StoryContextItem[];
  manuscript: string;
  nearby: string;
}): string {
  const { request } = input;
  const answered = request.questions
    .filter((q) => request.answers[q.id])
    .map((q) => {
      const a = request.answers[q.id];
      const value = Array.isArray(a.answer) ? a.answer.join("; ") : a.answer;
      const tag =
        a.source === "temporary_ai_assumption"
          ? " [temporary AI assumption approved by the author — do not treat as permanent canon]"
          : "";
      return `Q: ${q.question}\nA: ${value}${tag}`;
    })
    .join("\n\n");

  const actionLine = describeDocumentAction(request);

  return `THE AUTHOR'S REQUEST:
"""
${request.originalPrompt}
"""

${actionLine}
${request.selectedText?.trim() ? `\nSELECTED TEXT:\n"""\n${request.selectedText.trim()}\n"""\n` : ""}
AUTHOR-APPROVED STORY CONTEXT (established canon):
${formatContextForModel(input.contextItems)}

CLARIFICATION ANSWERS FOR THIS REQUEST (the author's direct decisions — follow them exactly):
${answered || "(none needed)"}

MANUSCRIPT SO FAR:
"""
${input.manuscript || "(the document is empty)"}
"""

TEXT NEAREST THE INSERTION POINT (match its voice and rhythm):
"""
${input.nearby || "(none)"}
"""

Write the passage now. Prose only.`;
}

function describeDocumentAction(request: PendingWritingRequest): string {
  if (request.destination === "assistant_tab") {
    return "DESTINATION: the assistant conversation. The author may insert the result into their document afterward.";
  }
  switch (request.documentAction) {
    case "replace_selection":
      return "DESTINATION: the document editor. Your prose will REPLACE the selected text.";
    case "rewrite_selection":
      return "DESTINATION: the document editor. Rewrite the selected text; your prose will replace it.";
    case "expand_selection":
      return "DESTINATION: the document editor. Expand the selected text into a fuller passage; your prose will replace it.";
    case "add_below":
      return "DESTINATION: the document editor. Your prose will be added on a new paragraph below the cursor.";
    case "continue":
      return "DESTINATION: the document editor. Continue the manuscript from where it leaves off.";
    case "insert_at_cursor":
    default:
      return "DESTINATION: the document editor. Your prose will be inserted at the cursor position.";
  }
}

export function summarizeAssumptions(assumptions: WritingAssumption[]): string {
  return assumptions.map((a) => `- (${a.importance}) ${a.description}`).join("\n");
}

export function answerToText(answer: ClarificationAnswer): string {
  return Array.isArray(answer.answer)
    ? answer.answer.join("; ")
    : answer.answer;
}
