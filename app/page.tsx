"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentImportButton } from "@/components/document/DocumentImportButton";

interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export default function LibraryPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Could not load your documents");
      const data = (await res.json()) as { documents: DocumentSummary[] };
      setDocs(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createBlankAndOpen = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      if (!res.ok) throw new Error("Could not create a document");
      const doc = (await res.json()) as DocumentSummary;
      router.push(`/editor/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setBusy(false);
    }
  }, [router]);

  const rename = useCallback(
    async (doc: DocumentSummary) => {
      const next = window.prompt("Rename document", doc.title);
      if (next == null || next.trim() === doc.title) return;
      await fetch(`/api/documents/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      load();
    },
    [load]
  );

  const remove = useCallback(
    async (doc: DocumentSummary) => {
      if (!window.confirm(`Delete “${doc.title}”? This can't be undone.`)) return;
      setDocs((d) => (d ? d.filter((x) => x.id !== doc.id) : d));
      await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    },
    []
  );

  return (
    <main className="min-h-screen w-full bg-cream-50 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-serif italic text-4xl text-ink-900 tracking-tight">
              Wright
            </div>
            <div className="mt-1 text-ink-500 text-sm">Your documents</div>
          </div>
          <div className="flex items-center gap-2">
            <DocumentImportButton
              label="Import document"
              busyLabel="Importing..."
              disabled={busy}
              showHelper
              className="rounded-modal border border-cream-300 bg-white px-3 py-2 text-sm text-ink-700 hover:border-amber-accent disabled:opacity-60"
              beforeImport={() => {
                setBusy(true);
                setError(null);
                return true;
              }}
              onImported={(result) => {
                router.push(`/editor/${result.document.id}`);
              }}
              onError={(message) => {
                setError(message);
                setBusy(false);
              }}
            />
            <button
              type="button"
              onClick={createBlankAndOpen}
              disabled={busy}
              className="rounded-modal bg-amber-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              New document
            </button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-soft">{error}</div>}

        <div className="mt-8 flex flex-col gap-2">
          {docs === null ? (
            <div className="text-ink-500 text-sm">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="rounded-modal border-2 border-dashed border-cream-300 bg-cream-100/40 px-8 py-16 text-center text-ink-500">
              No documents yet. Create a new one or import a document to begin.
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-3 rounded-modal border border-cream-300 bg-white px-4 py-3 hover:border-amber-accent"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/editor/${doc.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-medium text-ink-900">
                    {doc.title || "Untitled Document"}
                  </div>
                  <div className="text-xs text-ink-500">
                    Edited {formatWhen(doc.updatedAt)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => rename(doc)}
                  className="rounded px-2 py-1 text-xs text-ink-500 opacity-0 hover:bg-cream-100 group-hover:opacity-100"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  className="rounded px-2 py-1 text-xs text-red-soft opacity-0 hover:bg-red-50 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function formatWhen(iso: string): string {
  if (!iso) return "just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
