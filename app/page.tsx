"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { useDocumentImport } from "@/hooks/useDocumentImport";
import type { DocumentSummary } from "@/lib/documentStore";
import type { DocumentFilter, DocumentSort } from "@/lib/documentStore";
import type { DocumentImportResult } from "@/hooks/useDocumentImport";

type Tab = DocumentFilter;

const FEATURES_ANNOUNCEMENT_VERSION = "document-saving-v1";

export default function LibraryPage() {
  const router = useRouter();

  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<Tab>("recent");
  const [sort, setSort] = useState<DocumentSort>("updated_at");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);

  // Title prompt — rename existing doc or name a newly created doc
  const [titlePrompt, setTitlePrompt] = useState<{
    doc: DocumentSummary;
    purpose: "rename" | "new";
  } | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input → query
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const params = new URLSearchParams({ filter: tab, sort });
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Server error (${res.status})`);
      }
      const data = (await res.json()) as { documents: DocumentSummary[] };
      setDocs(data.documents);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setDocs([]);
    }
  }, [tab, sort, searchQuery]);

  useEffect(() => {
    setDocs(null);
    load();
  }, [load]);

  useEffect(() => {
    try {
      const seenVersion = window.localStorage.getItem("wright:features-seen");
      if (seenVersion !== FEATURES_ANNOUNCEMENT_VERSION) {
        setIsFeaturesOpen(true);
      }
    } catch {
      setIsFeaturesOpen(true);
    }
  }, []);

  // Focus title input when modal opens
  useEffect(() => {
    if (titlePrompt) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [titlePrompt]);

  const dismissFeatures = useCallback(() => {
    try {
      window.localStorage.setItem(
        "wright:features-seen",
        FEATURES_ANNOUNCEMENT_VERSION
      );
    } catch {
      // Ignore storage errors; the modal can still close for this session.
    }
    setIsFeaturesOpen(false);
  }, []);

  useEffect(() => {
    if (!isFeaturesOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissFeatures();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dismissFeatures, isFeaturesOpen]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const createBlank = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not create document");
      }
      const doc = (await res.json()) as DocumentSummary;
      if (!doc.id) throw new Error("Could not create document");
      setTitleValue("");
      setTitlePrompt({ doc, purpose: "new" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }, []);

  const openDoc = useCallback(
    (id: string) => router.push(`/editor/${id}`),
    [router]
  );

  const startRename = useCallback((doc: DocumentSummary) => {
    setTitleValue(doc.title || "Untitled Document");
    setTitlePrompt({ doc, purpose: "rename" });
  }, []);

  const closeTitlePrompt = useCallback(() => {
    setTitlePrompt(null);
    setTitleValue("");
  }, []);

  const openNewDocInEditor = useCallback(
    (id: string) => {
      closeTitlePrompt();
      router.push(`/editor/${id}`);
    },
    [closeTitlePrompt, router]
  );

  const submitTitlePrompt = useCallback(async () => {
    if (!titlePrompt) return;
    const next = titleValue.trim() || "Untitled Document";
    const { doc, purpose } = titlePrompt;

    if (purpose === "new") {
      if (next !== "Untitled Document") {
        await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
      }
      openNewDocInEditor(doc.id);
      return;
    }

    closeTitlePrompt();
    if (next === doc.title) return;
    setDocs((prev) =>
      prev ? prev.map((d) => (d.id === doc.id ? { ...d, title: next } : d)) : prev
    );
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    load();
  }, [titlePrompt, titleValue, closeTitlePrompt, openNewDocInEditor, load]);

  const duplicate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/documents/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) return;
      const newDoc = (await res.json()) as DocumentSummary;
      router.push(`/editor/${newDoc.id}`);
    },
    [router]
  );

  const star = useCallback(async (id: string) => {
    setDocs((prev) =>
      prev
        ? prev.map((d) =>
            d.id === id ? { ...d, isStarred: !d.isStarred } : d
          )
        : prev
    );
    await fetch(`/api/documents/${id}/star`, { method: "POST" });
    // Refetch to sync (especially when in starred tab so it disappears correctly)
    load();
  }, [load]);

  const moveToTrash = useCallback(
    async (id: string) => {
      setDocs((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
      await fetch(`/api/documents/${id}/trash`, { method: "POST" });
    },
    []
  );

  const restore = useCallback(async (id: string) => {
    setDocs((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    await fetch(`/api/documents/${id}/restore`, { method: "POST" });
  }, []);

  const deleteForever = useCallback(async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Permanently delete "${title}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDocs((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
  }, []);

  // ── UI helpers ────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "starred", label: "Starred" },
    { id: "trash", label: "Trash" },
  ];

  const isEmpty = docs !== null && docs.length === 0;
  const isLoading = docs === null && !loadError;

  return (
    <div className="min-h-screen bg-neutral-200">
      {/* ── Top header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-neutral-300 bg-white">
        <div className="mx-auto flex min-h-12 max-w-screen-xl flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap sm:py-0">
          <span className="shrink-0 font-serif text-lg italic text-neutral-700">
            Wright
          </span>

          {/* Search */}
          <div className="relative order-3 w-full sm:order-none sm:mx-2 sm:max-w-xl sm:flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search documents"
              className="w-full rounded border border-neutral-300 bg-white py-1.5 pl-9 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFeaturesOpen(true)}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-blue-300 hover:text-blue-700"
            aria-label="Show new features"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
              <path d="M19 16v4M17 18h4" />
            </svg>
            What&apos;s new
          </button>

          {/* New document */}
          <button
            type="button"
            onClick={createBlank}
            disabled={busy}
            className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            New document
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 pb-16">

        {/* ── Start a new document ────────────────────────────────────────── */}
        {!searchQuery && tab === "recent" && (
          <section className="pt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Start a new document
            </h2>
            <div className="flex flex-wrap gap-4">
              {/* Blank document card */}
              <button
                type="button"
                onClick={createBlank}
                disabled={busy}
                className="group flex h-48 w-44 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-left transition hover:border-blue-400 hover:shadow-paper disabled:opacity-60 sm:w-48"
              >
                <div className="flex h-32 items-center justify-center bg-neutral-100">
                  <div className="relative h-[70px] w-[54px] rounded-sm border-2 border-dashed border-neutral-300 bg-white group-hover:border-blue-300">
                    <svg
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-300 group-hover:text-blue-400"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </div>
                <div className="flex h-16 flex-col justify-center border-t border-neutral-200 px-3">
                  <p className="text-sm font-medium text-neutral-800">
                    Blank document
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Start from scratch
                  </p>
                </div>
              </button>

              {/* Import document card */}
              <ImportDocumentCard
                disabled={busy}
                onImporting={() => setBusy(true)}
                onImported={(result) => router.push(`/editor/${result.document.id}`)}
                onError={(msg) => {
                  alert(msg);
                  setBusy(false);
                }}
              />
            </div>
          </section>
        )}

        {/* ── Documents section ───────────────────────────────────────────── */}
        <section className="mt-8">
          {/* Tab bar + sort */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 pb-0">
            <div className="flex gap-0">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setSearchInput("");
                  }}
                  className={[
                    "relative px-4 py-3 text-sm font-medium transition",
                    tab === t.id
                      ? "text-neutral-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600"
                      : "text-neutral-500 hover:text-neutral-800",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {!searchQuery && (
              <div className="flex items-center gap-2 pb-2">
                <span className="text-xs text-neutral-500">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as DocumentSort)}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="updated_at">Last edited</option>
                  <option value="created_at">Date created</option>
                  <option value="title">Title</option>
                </select>
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="mt-12 flex justify-center">
              <span className="text-sm text-neutral-500">Loading documents…</span>
            </div>
          )}

          {/* Error */}
          {loadError && (
            <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}{" "}
              <button
                type="button"
                onClick={load}
                className="underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty states */}
          {isEmpty && !loadError && (
            <EmptyState tab={tab} searchQuery={searchQuery} onCreateBlank={createBlank} busy={busy} />
          )}

          {/* Document grid */}
          {docs && docs.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  inTrash={tab === "trash"}
                  onOpen={() => openDoc(doc.id)}
                  onRename={() => startRename(doc)}
                  onDuplicate={() => duplicate(doc.id)}
                  onStar={() => star(doc.id)}
                  onTrash={() => moveToTrash(doc.id)}
                  onRestore={() => restore(doc.id)}
                  onDeleteForever={() => deleteForever(doc.id, doc.title)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Title modal (new doc or rename) ─────────────────────────────────── */}
      {titlePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (titlePrompt.purpose === "new") {
              openNewDocInEditor(titlePrompt.doc.id);
            } else {
              closeTitlePrompt();
            }
          }}
        >
          <div className="w-80 rounded-lg border border-neutral-300 bg-white p-5 shadow-toast">
            <h3 className="text-sm font-semibold text-neutral-900">
              {titlePrompt.purpose === "new"
                ? "Name your document"
                : "Rename document"}
            </h3>
            {titlePrompt.purpose === "new" && (
              <p className="mt-1 text-xs text-neutral-500">
                Give your document a title before you start writing.
              </p>
            )}
            <input
              ref={titleInputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitTitlePrompt();
                if (e.key === "Escape") {
                  if (titlePrompt.purpose === "new") {
                    openNewDocInEditor(titlePrompt.doc.id);
                  } else {
                    closeTitlePrompt();
                  }
                }
              }}
              className="mt-3 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Document title"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (titlePrompt.purpose === "new") {
                    openNewDocInEditor(titlePrompt.doc.id);
                  } else {
                    closeTitlePrompt();
                  }
                }}
                className="rounded px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                {titlePrompt.purpose === "new" ? "Skip" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => void submitTitlePrompt()}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {titlePrompt.purpose === "new" ? "Open document" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFeaturesOpen && <FeaturesAnnouncement onClose={dismissFeatures} />}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ImportDocumentCard({
  disabled,
  onImporting,
  onImported,
  onError,
}: {
  disabled: boolean;
  onImporting: () => void;
  onImported: (result: DocumentImportResult) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFile, importing } = useDocumentImport();

  const handleFile = async (file: File) => {
    onImporting();
    try {
      const result = await importFile(file);
      onImported(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const isDisabled = disabled || importing;

  return (
    <div className="w-44 sm:w-48">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isDisabled}
        className="group flex h-48 w-full flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-left transition hover:border-blue-400 hover:shadow-paper disabled:opacity-60"
      >
        <div className="flex h-32 items-center justify-center bg-neutral-100">
          <div className="relative h-[70px] w-[54px] rounded-sm border border-neutral-300 bg-white group-hover:border-blue-300">
            {importing ? (
              <svg
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-blue-600"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-400 group-hover:text-blue-400"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex h-16 flex-col justify-center border-t border-neutral-200 px-3">
          <p className="text-sm font-medium text-neutral-800">
            {importing ? "Importing…" : "Import file"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            .docx, .txt, .md, .pdf
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.txt,.md,.markdown,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

function EmptyState({
  tab,
  searchQuery,
  onCreateBlank,
  busy,
}: {
  tab: Tab;
  searchQuery: string;
  onCreateBlank: () => void;
  busy: boolean;
}) {
  if (searchQuery) {
    return (
      <div className="mt-16 flex flex-col items-center gap-2 text-center">
        <svg
          className="text-neutral-400"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p className="text-sm font-medium text-neutral-700">No matching documents</p>
        <p className="text-xs text-neutral-500">Try a different search term</p>
      </div>
    );
  }

  if (tab === "trash") {
    return (
      <div className="mt-16 flex flex-col items-center gap-2 text-center">
        <svg
          className="text-neutral-400"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
        <p className="text-sm font-medium text-neutral-700">Trash is empty</p>
        <p className="text-xs text-neutral-500">
          Deleted documents appear here before being permanently removed
        </p>
      </div>
    );
  }

  if (tab === "starred") {
    return (
      <div className="mt-16 flex flex-col items-center gap-2 text-center">
        <svg
          className="text-neutral-400"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <p className="text-sm font-medium text-neutral-700">No starred documents</p>
        <p className="text-xs text-neutral-500">
          Star a document to find it here quickly
        </p>
      </div>
    );
  }

  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <svg
        className="text-neutral-400"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <div>
        <p className="text-sm font-medium text-neutral-700">No documents yet</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Create a blank document or import a file to get started
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateBlank}
        disabled={busy}
        className="mt-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        New document
      </button>
    </div>
  );
}

function FeaturesAnnouncement({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="features-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-toast">
        <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                New in Wright
              </p>
              <h2
                id="features-title"
                className="mt-1 text-xl font-semibold text-neutral-950"
              >
                Your documents now save
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
              aria-label="Close new features"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M17 21v-8H7v8" />
                <path d="M7 3v5h8" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Save your documents and come back whenever
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Wright now keeps your documents in the library, so drafts,
                imports, and revisions are waiting when you return.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-sm text-neutral-700 sm:grid-cols-3">
            <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-medium text-neutral-900">Recent</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Pick up where you left off.
              </p>
            </div>
            <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-medium text-neutral-900">Starred</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Keep key drafts close.
              </p>
            </div>
            <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-medium text-neutral-900">Trash</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Restore removed work.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
