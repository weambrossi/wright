import type { StoryContextItem } from "./types";

// Structured retrieval: pick the stored context most relevant to the current
// request instead of shipping the whole story database to the model. There is
// no vector store in this stack, so relevance is scored with cheap lexical
// signals: character-name matches, keyword overlap with the prompt/selection,
// category priors, scope, and recency.

const MAX_RETRIEVED_ITEMS = 40;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "is",
  "it", "for", "with", "as", "was", "are", "be", "this", "that", "from",
  "by", "about", "into", "after", "before", "he", "she", "they", "his",
  "her", "their", "them", "him", "i", "you", "we", "my", "your", "our",
  "me", "us", "do", "does", "did", "not", "no", "so", "if", "then", "when",
  "what", "how", "who", "where", "why", "write", "writing", "scene",
  "chapter", "paragraph", "please", "make", "more", "some", "just",
]);

function keywords(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9']+/)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (word.length >= 3 && !STOPWORDS.has(word)) out.add(word);
  }
  return out;
}

/** Capitalized words in the prompt/selection are likely character or place names. */
function properNouns(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/gm) ?? [];
  for (const m of matches) out.add(m.toLowerCase());
  // Also grab sentence-initial capitalized words; cheap and errs inclusive.
  const initial = text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  for (const m of initial) out.add(m.toLowerCase());
  return out;
}

export interface RetrievalQuery {
  prompt: string;
  selectedText?: string;
  /** Trailing slice of the manuscript near the cursor/selection. */
  nearbyText?: string;
}

export function scoreContextItem(
  item: StoryContextItem,
  query: {
    promptWords: Set<string>;
    nearbyWords: Set<string>;
    names: Set<string>;
  }
): number {
  let score = 0;

  for (const name of item.characterNames) {
    if (query.names.has(name.toLowerCase())) score += 6;
    if (query.promptWords.has(name.toLowerCase())) score += 4;
  }

  const contentWords = keywords(item.content);
  for (const w of query.promptWords) {
    if (contentWords.has(w)) score += 2;
  }
  for (const w of query.nearbyWords) {
    if (contentWords.has(w)) score += 0.5;
  }

  // Style and theme apply to almost every writing request.
  if (item.category === "style" || item.category === "theme") score += 3;
  // Story-wide facts are safer to include than scene-scoped ones.
  if (item.scope === "story") score += 1;
  if (item.scope === "request") score -= 2;

  return score;
}

/**
 * Select the stored context most relevant to this request. Items must already
 * be filtered to the current document by the caller (the store enforces it).
 */
export function selectRelevantContext(
  items: StoryContextItem[],
  query: RetrievalQuery,
  limit = MAX_RETRIEVED_ITEMS
): StoryContextItem[] {
  const active = items.filter((i) => i.status === "active");
  if (active.length <= limit) {
    // Small canon: send it all, ordered stable by recency.
    return [...active].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
  }

  const promptWords = keywords(
    `${query.prompt} ${query.selectedText ?? ""}`
  );
  const nearbyWords = keywords(query.nearbyText ?? "");
  const names = properNouns(
    `${query.prompt} ${query.selectedText ?? ""} ${query.nearbyText ?? ""}`
  );

  const scored = active.map((item) => ({
    item,
    score: scoreContextItem(item, { promptWords, nearbyWords, names }),
  }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(b.item.updatedAt) - Date.parse(a.item.updatedAt)
  );
  return scored.slice(0, limit).map((s) => s.item);
}

const MAX_MANUSCRIPT_CHARS = 24_000;
const NEARBY_CHARS = 4_000;

/**
 * Trim the manuscript for the model: keep the opening (for canon established
 * early) plus the text nearest the cursor/selection, which matters most.
 */
export function trimManuscriptForModel(
  manuscript: string,
  selectedText?: string
): { manuscript: string; nearby: string } {
  const text = manuscript.trim();
  if (!text) return { manuscript: "", nearby: "" };

  // Locate the selection (or default to the end, where "continue" happens).
  let anchor = text.length;
  if (selectedText?.trim()) {
    const idx = text.indexOf(selectedText.trim());
    if (idx !== -1) anchor = idx;
  }
  const nearby = text.slice(
    Math.max(0, anchor - NEARBY_CHARS),
    Math.min(text.length, anchor + NEARBY_CHARS)
  );

  if (text.length <= MAX_MANUSCRIPT_CHARS) {
    return { manuscript: text, nearby };
  }

  const headBudget = Math.floor(MAX_MANUSCRIPT_CHARS * 0.3);
  const tailBudget = MAX_MANUSCRIPT_CHARS - headBudget;
  const head = text.slice(0, headBudget);
  const tailStart = Math.max(
    headBudget,
    Math.min(text.length - tailBudget, anchor - Math.floor(tailBudget / 2))
  );
  const tail = text.slice(tailStart, tailStart + tailBudget);
  return {
    manuscript: `${head}\n\n[… manuscript trimmed …]\n\n${tail}`,
    nearby,
  };
}

/** Render context items as a compact block for the model prompt. */
export function formatContextForModel(items: StoryContextItem[]): string {
  if (items.length === 0) return "(no stored story context yet)";
  return items
    .map((item) => {
      const chars =
        item.characterNames.length > 0
          ? ` | characters: ${item.characterNames.join(", ")}`
          : "";
      return `- [id: ${item.id}] (${item.category}, ${item.scope}${chars}) ${item.content}`;
    })
    .join("\n");
}
