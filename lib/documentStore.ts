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
  updatedAt: string;
}

export interface StoredDocument extends DocumentSummary {
  html: string;
  contentJson?: JSONContent;
  importStatus?: string;
  importWarnings?: ImportWarning[];
  sourceFile?: SourceFileSummary | null;
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

export async function listDocuments(): Promise<DocumentSummary[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("documents")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    updatedAt: d.updated_at as string,
  }));
}

export async function createDocument(
  title = "Untitled Document",
  html = "",
  contentJson?: JSONContent
): Promise<DocumentSummary> {
  const sb = getSupabase();
  const insert: Record<string, unknown> = { title: title || "Untitled Document", html };
  if (contentJson) insert.content_json = contentJson;
  const { data, error } = await sb
    .from("documents")
    .insert(insert)
    .select("id, title, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    title: data.title as string,
    updatedAt: data.updated_at as string,
  };
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("documents")
    .select("id, title, html, content_json, import_status, import_warnings, source_file_id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    title: data.title as string,
    html: (data.html as string) ?? "",
    contentJson: data.content_json as JSONContent | undefined,
    importStatus: data.import_status as string | undefined,
    importWarnings: (data.import_warnings as ImportWarning[] | null) ?? undefined,
    sourceFile: data.source_file_id
      ? await getSourceFileSummary(data.source_file_id as string)
      : null,
    updatedAt: data.updated_at as string,
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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof fields.html === "string") patch.html = fields.html;
  if (typeof fields.title === "string") patch.title = fields.title;
  if (fields.contentJson) patch.content_json = fields.contentJson;
  if (typeof fields.importStatus === "string") patch.import_status = fields.importStatus;
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

export async function createImportedDocument(params: {
  id: string;
  title: string;
  html: string;
  contentJson: JSONContent;
  sourceFileId?: string | null;
  warnings: ImportWarning[];
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
    })
    .select("id, title, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    title: data.title as string,
    updatedAt: data.updated_at as string,
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
