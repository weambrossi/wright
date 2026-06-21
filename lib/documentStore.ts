import { getSupabase } from "./supabase";
import type { JSONContent } from "@tiptap/core";
import type {
  ImportMode,
  ImportWarning,
  SourceFileSummary,
  WrightDocument,
  WrightDocumentSource,
} from "@/lib/document/wrightDocumentTypes";

// Documents live in a Supabase `documents` table so they persist across
// deploys and are reachable from any browser/machine. See README for schema.

export interface DocumentSummary {
  id: string;
  title: string;
  documentType: string;
  isStarred: boolean;
  isTrashed: boolean;
  sourceFileName: string | null;
  sourceFileType: string | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface StoredDocument {
  id: string;
  title: string;
  html: string;
  contentJson?: JSONContent;
  importStatus?: string;
  importWarnings?: ImportWarning[];
  sourceFile?: SourceFileSummary | null;
  documentType: string;
  isStarred: boolean;
  isTrashed: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

interface SourceFileRecordInput {
  id: string;
  documentId: string;
  originalFileName: string;
  fileType: string;
  mimeType: string | null;
  fileSizeBytes: number;
  storagePath: string;
  importMode: ImportMode;
}

export type DocumentFilter = "recent" | "starred" | "trash";
export type DocumentSort = "updated_at" | "created_at" | "title";

// Columns added by the Document Library migration. If they don't exist in the
// user's Supabase table yet, listDocuments falls back to a base-column select
// so the app still works and an empty/legacy table doesn't 500 the library.
const LIBRARY_COLUMNS =
  "id, title, document_type, is_starred, is_trashed, source_file_id, word_count, created_at, updated_at, last_opened_at";
const BASE_COLUMNS = "id, title, source_file_id, created_at, updated_at";

function isMissingColumnError(err: { code?: string; message?: string }): boolean {
  // Postgres 42703 = undefined_column. Supabase surfaces it via code or message.
  if (err?.code === "42703") return true;
  return /column .* does not exist/i.test(err?.message ?? "");
}

export async function listDocuments(opts: {
  filter?: DocumentFilter;
  q?: string;
  sort?: DocumentSort;
} = {}): Promise<DocumentSummary[]> {
  const sb = getSupabase();
  const { filter = "recent", q, sort = "updated_at" } = opts;

  const buildQuery = (cols: string, useNewCols: boolean) => {
    let query = sb.from("documents").select(cols);
    if (useNewCols) {
      if (filter === "starred") {
        query = query.eq("is_starred", true).eq("is_trashed", false);
      } else if (filter === "trash") {
        query = query.eq("is_trashed", true);
      } else {
        query = query.eq("is_trashed", false);
      }
    } else if (filter === "starred" || filter === "trash") {
      // No starred/trash data in a pre-migration table — return nothing.
      return null;
    }
    if (q && q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    const sortCol = sort === "title" || sort === "created_at" || sort === "updated_at" ? sort : "updated_at";
    query = query.order(sortCol, { ascending: sortCol === "title" });
    return query;
  };

  type Row = Record<string, unknown>;
  type Res = { data: Row[] | null; error: { code?: string; message?: string } | null };

  let res = (await buildQuery(LIBRARY_COLUMNS, true)!) as unknown as Res;

  if (res.error && isMissingColumnError(res.error)) {
    // Migration not run — fall back to base columns.
    const fallback = buildQuery(BASE_COLUMNS, false);
    if (!fallback) return [];
    res = (await fallback) as unknown as Res;
  }
  if (res.error) throw new Error(res.error.message ?? "Query failed");

  const rows: Row[] = res.data ?? [];

  // Batch-fetch source file info for imported docs
  const sourceFileIds = rows
    .map((r) => r.source_file_id as string | null)
    .filter(Boolean) as string[];
  const sourceFileMap: Record<
    string,
    { original_file_name: string; file_type: string }
  > = {};
  if (sourceFileIds.length > 0) {
    const { data: sfData } = await sb
      .from("source_files")
      .select("id, original_file_name, file_type")
      .in("id", sourceFileIds);
    for (const sf of sfData ?? []) {
      sourceFileMap[sf.id as string] = {
        original_file_name: sf.original_file_name as string,
        file_type: sf.file_type as string,
      };
    }
  }

  return rows.map((d) => {
    const sf = d.source_file_id
      ? sourceFileMap[d.source_file_id as string]
      : null;
    return {
      id: d.id as string,
      title: (d.title as string) || "Untitled Document",
      documentType: (d.document_type as string) ?? "native",
      isStarred: (d.is_starred as boolean) ?? false,
      isTrashed: (d.is_trashed as boolean) ?? false,
      sourceFileName: sf?.original_file_name ?? null,
      sourceFileType: sf?.file_type ?? null,
      wordCount: (d.word_count as number) ?? 0,
      createdAt: d.created_at as string,
      updatedAt: d.updated_at as string,
      lastOpenedAt: (d.last_opened_at as string | null) ?? null,
    };
  });
}

export async function createDocument(
  title = "Untitled Document",
  html = "",
  contentJson?: JSONContent
): Promise<DocumentSummary> {
  const sb = getSupabase();

  const tryInsert = async (withNewCols: boolean) => {
    const insert: Record<string, unknown> = {
      title: title || "Untitled Document",
      html,
    };
    if (withNewCols) insert.document_type = "native";
    if (contentJson) insert.content_json = contentJson;
    return sb
      .from("documents")
      .insert(insert)
      .select("id, title, created_at, updated_at")
      .single();
  };

  let { data, error } = await tryInsert(true);
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await tryInsert(false));
  }
  if (error) throw new Error(error.message);

  return {
    id: data!.id as string,
    title: data!.title as string,
    documentType: "native",
    isStarred: false,
    isTrashed: false,
    sourceFileName: null,
    sourceFileType: null,
    wordCount: 0,
    createdAt: data!.created_at as string,
    updatedAt: data!.updated_at as string,
    lastOpenedAt: null,
  };
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  const sb = getSupabase();
  const fullCols =
    "id, title, html, content_json, import_status, import_warnings, source_file_id, document_type, is_starred, is_trashed, word_count, created_at, updated_at, last_opened_at";
  const baseCols =
    "id, title, html, content_json, import_status, import_warnings, source_file_id, created_at, updated_at";

  let res = (await sb
    .from("documents")
    .select(fullCols)
    .eq("id", id)
    .maybeSingle()) as { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null };
  if (res.error && isMissingColumnError(res.error)) {
    res = (await sb
      .from("documents")
      .select(baseCols)
      .eq("id", id)
      .maybeSingle()) as { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null };
  }
  if (res.error) throw new Error(res.error.message ?? "Query failed");
  const data = res.data;
  if (!data) return null;
  return {
    id: data.id as string,
    title: data.title as string,
    html: (data.html as string) ?? "",
    contentJson: data.content_json as JSONContent | undefined,
    importStatus: data.import_status as string | undefined,
    importWarnings:
      (data.import_warnings as ImportWarning[] | null) ?? undefined,
    sourceFile: data.source_file_id
      ? await getSourceFileSummary(data.source_file_id as string)
      : null,
    documentType: (data.document_type as string) ?? "native",
    isStarred: (data.is_starred as boolean) ?? false,
    isTrashed: (data.is_trashed as boolean) ?? false,
    wordCount: (data.word_count as number) ?? 0,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastOpenedAt: (data.last_opened_at as string | null) ?? null,
  };
}

export async function updateDocument(
  id: string,
  fields: {
    html?: string;
    title?: string;
    contentJson?: JSONContent;
    importStatus?: string;
    importWarnings?: ImportWarning[];
    sourceFileId?: string | null;
  }
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof fields.html === "string") patch.html = fields.html;
  if (typeof fields.title === "string") patch.title = fields.title;
  if (fields.contentJson) patch.content_json = fields.contentJson;
  if (typeof fields.importStatus === "string")
    patch.import_status = fields.importStatus;
  if (fields.importWarnings) patch.import_warnings = fields.importWarnings;
  if ("sourceFileId" in fields) patch.source_file_id = fields.sourceFileId;
  const { error } = await sb.from("documents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteDocument(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function trashDocument(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("documents")
    .update({ is_trashed: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restoreDocument(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("documents")
    .update({ is_trashed: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function permanentDeleteDocument(id: string): Promise<void> {
  const sb = getSupabase();
  // Verify it's in trash to prevent accidental permanent deletion
  const { data } = await sb
    .from("documents")
    .select("is_trashed")
    .eq("id", id)
    .maybeSingle();
  if (!data || !(data.is_trashed as boolean)) {
    throw new Error("Document must be in trash before permanent deletion");
  }
  const { error } = await sb.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleStarDocument(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data: current } = await sb
    .from("documents")
    .select("is_starred")
    .eq("id", id)
    .maybeSingle();
  const next = !((current?.is_starred as boolean) ?? false);
  const { error } = await sb
    .from("documents")
    .update({ is_starred: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return next;
}

export async function duplicateDocument(id: string): Promise<DocumentSummary> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("documents")
    .select("title, html, content_json, document_type")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Document not found");

  const insert: Record<string, unknown> = {
    title: `Copy of ${(data.title as string) || "Untitled Document"}`,
    html: (data.html as string) ?? "",
    document_type: (data.document_type as string) ?? "native",
  };
  if (data.content_json) insert.content_json = data.content_json;

  const { data: newDoc, error: insertError } = await sb
    .from("documents")
    .insert(insert)
    .select(
      "id, title, document_type, is_starred, is_trashed, word_count, created_at, updated_at, last_opened_at"
    )
    .single();
  if (insertError) throw new Error(insertError.message);

  return {
    id: newDoc.id as string,
    title: newDoc.title as string,
    documentType: (newDoc.document_type as string) ?? "native",
    isStarred: false,
    isTrashed: false,
    sourceFileName: null,
    sourceFileType: null,
    wordCount: (newDoc.word_count as number) ?? 0,
    createdAt: newDoc.created_at as string,
    updatedAt: newDoc.updated_at as string,
    lastOpenedAt: null,
  };
}

export async function touchLastOpenedAt(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("documents")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createImportedDocument(params: {
  id: string;
  title: string;
  html: string;
  contentJson: JSONContent;
  sourceFileId?: string | null;
  warnings: ImportWarning[];
  documentType?: string;
}): Promise<DocumentSummary> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("documents")
    .insert({
      id: params.id,
      title: params.title || "Untitled Document",
      html: params.html,
      content_json: params.contentJson,
      source_file_id: params.sourceFileId ?? null,
      import_status: "ready",
      import_warnings: params.warnings,
      document_type: params.documentType ?? "native",
    })
    .select(
      "id, title, document_type, is_starred, is_trashed, word_count, created_at, updated_at, last_opened_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    title: data.title as string,
    documentType: (data.document_type as string) ?? "native",
    isStarred: false,
    isTrashed: false,
    sourceFileName: null,
    sourceFileType: null,
    wordCount: 0,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastOpenedAt: null,
  };
}

export async function upsertSourceFile(
  input: SourceFileRecordInput
): Promise<SourceFileSummary> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("source_files")
    .upsert({
      id: input.id,
      document_id: input.documentId,
      original_file_name: input.originalFileName,
      file_type: input.fileType,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      storage_path: input.storagePath,
      import_mode: input.importMode,
    })
    .select("id, original_file_name, file_type, file_size_bytes, import_mode")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    originalFileName: data.original_file_name as string,
    fileType: data.file_type as string,
    fileSize: Number(data.file_size_bytes),
    importMode: data.import_mode as ImportMode,
  };
}

export async function getSourceFileSummary(
  id: string
): Promise<SourceFileSummary | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("source_files")
    .select("id, original_file_name, file_type, file_size_bytes, import_mode")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    originalFileName: data.original_file_name as string,
    fileType: data.file_type as string,
    fileSize: Number(data.file_size_bytes),
    importMode: data.import_mode as ImportMode,
  };
}

export function toWrightDocument(params: {
  id: string;
  title: string;
  contentJson: JSONContent;
  source?: WrightDocumentSource;
  warnings?: ImportWarning[];
  createdAt?: string;
  updatedAt?: string;
}): WrightDocument {
  const now = new Date().toISOString();
  return {
    id: params.id,
    title: params.title || "Untitled Document",
    version: 1,
    source: params.source,
    content: params.contentJson,
    metadata: {
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      importWarnings: params.warnings,
    },
  };
}
