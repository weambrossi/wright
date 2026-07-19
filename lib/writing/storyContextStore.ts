import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import type {
  StoryContextCategory,
  StoryContextItem,
  StoryContextScope,
  StoryContextSource,
} from "./types";

// Persistent story context lives in the Supabase `story_context` table, keyed
// by document (in Wright a document is the book/project unit). All access is
// server-side and always filtered by document_id so one book can never read
// another book's canon. See SUPABASE_SETUP.md for the migration.

type Row = Record<string, unknown>;

const COLUMNS =
  "id, document_id, category, scope, content, character_names, source, source_question, source_request_id, status, created_at, updated_at";

function rowToItem(row: Row): StoryContextItem {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    category: row.category as StoryContextCategory,
    scope: (row.scope as StoryContextScope) ?? "story",
    content: row.content as string,
    characterNames: (row.character_names as string[] | null) ?? [],
    source: row.source as StoryContextSource,
    sourceQuestion: (row.source_question as string | null) ?? undefined,
    sourceRequestId: (row.source_request_id as string | null) ?? undefined,
    status: (row.status as "active" | "superseded") ?? "active",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listStoryContext(
  documentId: string,
  opts: {
    category?: StoryContextCategory;
    q?: string;
    includeSuperseded?: boolean;
  } = {}
): Promise<StoryContextItem[]> {
  const sb = getSupabase();
  let query = sb
    .from("story_context")
    .select(COLUMNS)
    .eq("document_id", documentId)
    .order("updated_at", { ascending: false });
  if (!opts.includeSuperseded) query = query.eq("status", "active");
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q?.trim()) query = query.ilike("content", `%${opts.q.trim()}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToItem);
}

export async function getStoryContextItem(
  id: string
): Promise<StoryContextItem | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("story_context")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToItem(data as Row) : null;
}

export interface CreateStoryContextInput {
  documentId: string;
  category: StoryContextCategory;
  scope: StoryContextScope;
  content: string;
  characterNames?: string[];
  source: StoryContextSource;
  sourceQuestion?: string;
  sourceRequestId?: string;
}

export async function createStoryContext(
  input: CreateStoryContextInput
): Promise<StoryContextItem> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    document_id: input.documentId,
    category: input.category,
    scope: input.scope,
    content: input.content,
    character_names: input.characterNames ?? [],
    source: input.source,
    source_question: input.sourceQuestion ?? null,
    source_request_id: input.sourceRequestId ?? null,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await sb
    .from("story_context")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToItem(data as Row);
}

/**
 * Idempotent save for clarification answers: if this request already saved
 * context for this question, update it instead of inserting a duplicate.
 */
export async function upsertAnswerContext(
  input: CreateStoryContextInput & { sourceRequestId: string; sourceQuestion: string }
): Promise<StoryContextItem> {
  const sb = getSupabase();
  const { data: existing, error: findError } = await sb
    .from("story_context")
    .select(COLUMNS)
    .eq("document_id", input.documentId)
    .eq("source_request_id", input.sourceRequestId)
    .eq("source_question", input.sourceQuestion)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing) {
    const { data, error } = await sb
      .from("story_context")
      .update({
        category: input.category,
        scope: input.scope,
        content: input.content,
        character_names: input.characterNames ?? [],
        source: input.source,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", (existing as Row).id as string)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToItem(data as Row);
  }
  return createStoryContext(input);
}

export async function updateStoryContext(
  id: string,
  fields: {
    category?: StoryContextCategory;
    scope?: StoryContextScope;
    content?: string;
    characterNames?: string[];
    status?: "active" | "superseded";
  }
): Promise<StoryContextItem> {
  const sb = getSupabase();
  const patch: Row = { updated_at: new Date().toISOString() };
  if (fields.category) patch.category = fields.category;
  if (fields.scope) patch.scope = fields.scope;
  if (typeof fields.content === "string") patch.content = fields.content;
  if (fields.characterNames) patch.character_names = fields.characterNames;
  if (fields.status) patch.status = fields.status;
  const { data, error } = await sb
    .from("story_context")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToItem(data as Row);
}

export async function deleteStoryContext(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("story_context").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Mark an item superseded (kept for history) rather than deleting it. */
export async function supersedeStoryContext(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("story_context")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
