import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  DocumentGenerationAction,
  GenerationMetadata,
  PendingRequestStatus,
  PendingWritingRequest,
  StoryContextConflict,
  WritingAssumption,
  WritingControlMode,
  WritingDestination,
} from "./types";

// Pending writing requests persist in Supabase so the author can close the
// tab mid-question-flow and reopen it later, and so answers survive a failed
// generation. See SUPABASE_SETUP.md for the migration.

type Row = Record<string, unknown>;

const COLUMNS =
  "id, document_id, original_prompt, destination, document_action, selected_text, selection_start, selection_end, document_version, writing_control_mode, questions, answers, current_question_index, status, retrieved_context_ids, assumptions, conflicts, saved_context_by_question, generation_meta, created_at, updated_at";

function rowToRequest(row: Row): PendingWritingRequest {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    originalPrompt: row.original_prompt as string,
    destination: row.destination as WritingDestination,
    documentAction:
      (row.document_action as DocumentGenerationAction | null) ?? undefined,
    selectedText: (row.selected_text as string | null) ?? undefined,
    selectionStart: (row.selection_start as number | null) ?? undefined,
    selectionEnd: (row.selection_end as number | null) ?? undefined,
    documentVersion: (row.document_version as string | null) ?? undefined,
    writingControlMode: row.writing_control_mode as WritingControlMode,
    questions: (row.questions as ClarificationQuestion[] | null) ?? [],
    answers:
      (row.answers as Record<string, ClarificationAnswer> | null) ?? {},
    currentQuestionIndex: (row.current_question_index as number) ?? 0,
    status: row.status as PendingRequestStatus,
    retrievedContextIds: (row.retrieved_context_ids as string[] | null) ?? [],
    assumptions: (row.assumptions as WritingAssumption[] | null) ?? [],
    conflicts: (row.conflicts as StoryContextConflict[] | null) ?? [],
    savedContextByQuestion:
      (row.saved_context_by_question as Record<string, string> | null) ?? {},
    generationMeta:
      (row.generation_meta as GenerationMetadata | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface CreateWritingRequestInput {
  documentId: string;
  originalPrompt: string;
  destination: WritingDestination;
  documentAction?: DocumentGenerationAction;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
  documentVersion?: string;
  writingControlMode: WritingControlMode;
  retrievedContextIds: string[];
}

export async function createWritingRequest(
  input: CreateWritingRequestInput
): Promise<PendingWritingRequest> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    document_id: input.documentId,
    original_prompt: input.originalPrompt,
    destination: input.destination,
    document_action: input.documentAction ?? null,
    selected_text: input.selectedText ?? null,
    selection_start: input.selectionStart ?? null,
    selection_end: input.selectionEnd ?? null,
    document_version: input.documentVersion ?? null,
    writing_control_mode: input.writingControlMode,
    questions: [],
    answers: {},
    current_question_index: 0,
    status: "evaluating",
    retrieved_context_ids: input.retrievedContextIds,
    assumptions: [],
    conflicts: [],
    saved_context_by_question: {},
    generation_meta: null,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await sb
    .from("writing_requests")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToRequest(data as Row);
}

export async function getWritingRequest(
  id: string
): Promise<PendingWritingRequest | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("writing_requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRequest(data as Row) : null;
}

/** The most recent unfinished request for a document, if any. */
export async function getOpenWritingRequest(
  documentId: string
): Promise<PendingWritingRequest | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("writing_requests")
    .select(COLUMNS)
    .eq("document_id", documentId)
    .in("status", [
      "awaiting_answer",
      "checking_conflict",
      "ready_to_generate",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRequest(data as Row) : null;
}

export async function updateWritingRequest(
  id: string,
  fields: Partial<{
    questions: ClarificationQuestion[];
    answers: Record<string, ClarificationAnswer>;
    currentQuestionIndex: number;
    status: PendingRequestStatus;
    assumptions: WritingAssumption[];
    conflicts: StoryContextConflict[];
    savedContextByQuestion: Record<string, string>;
    generationMeta: GenerationMetadata;
  }>
): Promise<PendingWritingRequest> {
  const sb = getSupabase();
  const patch: Row = { updated_at: new Date().toISOString() };
  if (fields.questions) patch.questions = fields.questions;
  if (fields.answers) patch.answers = fields.answers;
  if (typeof fields.currentQuestionIndex === "number")
    patch.current_question_index = fields.currentQuestionIndex;
  if (fields.status) patch.status = fields.status;
  if (fields.assumptions) patch.assumptions = fields.assumptions;
  if (fields.conflicts) patch.conflicts = fields.conflicts;
  if (fields.savedContextByQuestion)
    patch.saved_context_by_question = fields.savedContextByQuestion;
  if (fields.generationMeta) patch.generation_meta = fields.generationMeta;
  const { data, error } = await sb
    .from("writing_requests")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToRequest(data as Row);
}
