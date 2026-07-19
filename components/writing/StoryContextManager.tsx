"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STORY_CONTEXT_CATEGORIES,
  type StoryContextCategory,
  type StoryContextItem,
  type StoryContextScope,
} from "@/lib/writing/types";

// Project-level context management: review, search, edit, and delete the
// story canon Wright has gathered — clarification answers, manual entries,
// and superseded (outdated) facts. Never exposes system prompts.

interface StoryContextManagerProps {
  documentId: string;
  onClose: () => void;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

const CATEGORY_LABELS: Record<StoryContextCategory, string> = {
  character: "Character",
  character_motivation: "Motivation",
  character_emotion: "Emotion",
  character_action: "Action",
  relationship: "Relationship",
  dialogue_intent: "Dialogue intent",
  plot: "Plot",
  backstory: "Backstory",
  setting: "Setting",
  worldbuilding: "Worldbuilding",
  timeline: "Timeline",
  scene_outcome: "Scene outcome",
  theme: "Theme",
  style: "Style",
  other: "Other",
};

const SCOPE_LABELS: Record<StoryContextScope, string> = {
  story: "Whole story",
  scene: "Current scene",
  request: "One request",
};

export function StoryContextManager({
  documentId,
  onClose,
  onToast,
}: StoryContextManagerProps) {
  const [items, setItems] = useState<StoryContextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<StoryContextCategory | "all">("all");
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ documentId });
      if (q.trim()) params.set("q", q.trim());
      if (category !== "all") params.set("category", category);
      if (showSuperseded) params.set("includeSuperseded", "true");
      const res = await fetch(`/api/story-context?${params}`);
      if (!res.ok) throw new Error("Couldn't load story context");
      const body = (await res.json()) as { items: StoryContextItem[] };
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load context");
    } finally {
      setLoading(false);
    }
  }, [category, documentId, q, showSuperseded]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (item: StoryContextItem) => {
    if (!window.confirm("Delete this story context permanently?")) return;
    try {
      const res = await fetch(
        `/api/story-context/${item.id}?documentId=${encodeURIComponent(documentId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onToast("Context deleted.", "success");
    } catch {
      onToast("Couldn't delete that entry.", "error");
    }
  };

  const save = async (
    item: StoryContextItem,
    fields: {
      content: string;
      category: StoryContextCategory;
      scope: StoryContextScope;
      status?: "active" | "superseded";
    }
  ) => {
    try {
      const res = await fetch(
        `/api/story-context/${item.id}?documentId=${encodeURIComponent(documentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      const body = (await res.json()) as { item: StoryContextItem };
      setItems((prev) => prev.map((i) => (i.id === item.id ? body.item : i)));
      setEditingId(null);
      onToast("Context updated.", "success");
    } catch {
      onToast("Couldn't save that change.", "error");
    }
  };

  const add = async (fields: {
    content: string;
    category: StoryContextCategory;
    scope: StoryContextScope;
  }) => {
    try {
      const res = await fetch("/api/story-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, ...fields }),
      });
      if (!res.ok) throw new Error("Save failed");
      const body = (await res.json()) as { item: StoryContextItem };
      setItems((prev) => [body.item, ...prev]);
      setAdding(false);
      onToast("Context added.", "success");
    } catch {
      onToast("Couldn't add that entry.", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Story context"
    >
      <div
        className="flex h-[80vh] w-full max-w-2xl flex-col rounded-modal bg-white shadow-toast"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">
              Story context
            </h2>
            <p className="text-[11px] text-neutral-500">
              Everything Wright knows about your story — from your answers,
              your edits, and entries you add here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story context"
            className="grid h-7 w-7 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search context…"
            aria-label="Search story context"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[13px] focus:border-blue-400 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as StoryContextCategory | "all")
            }
            aria-label="Filter by category"
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px] text-neutral-700"
          >
            <option value="all">All categories</option>
            {STORY_CONTEXT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
            <input
              type="checkbox"
              checked={showSuperseded}
              onChange={(e) => setShowSuperseded(e.target.checked)}
            />
            Show outdated
          </label>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700"
          >
            Add entry
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {adding && (
            <ContextEditor
              heading="New context entry"
              initial={{ content: "", category: "other", scope: "story" }}
              onSave={(fields) => void add(fields)}
              onCancel={() => setAdding(false)}
            />
          )}
          {loading ? (
            <p className="py-8 text-center text-[13px] text-neutral-400">
              Loading story context…
            </p>
          ) : error ? (
            <p className="py-8 text-center text-[13px] text-red-soft">{error}</p>
          ) : items.length === 0 && !adding ? (
            <p className="py-8 text-center text-[13px] text-neutral-400">
              Nothing stored yet. When you answer Wright&apos;s questions before
              it writes, those answers appear here as story context.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) =>
                editingId === item.id ? (
                  <li key={item.id}>
                    <ContextEditor
                      heading="Edit context"
                      initial={{
                        content: item.content,
                        category: item.category,
                        scope: item.scope,
                      }}
                      onSave={(fields) => void save(item, fields)}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={item.id}
                    className={[
                      "rounded-lg border px-3 py-2",
                      item.status === "superseded"
                        ? "border-neutral-200 bg-neutral-50 opacity-70"
                        : "border-neutral-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{CATEGORY_LABELS[item.category]}</Badge>
                        <Badge muted>{SCOPE_LABELS[item.scope]}</Badge>
                        {item.status === "superseded" && (
                          <Badge warning>Outdated</Badge>
                        )}
                        {item.characterNames.map((n) => (
                          <Badge key={n} muted>
                            {n}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.status === "superseded" && (
                          <button
                            type="button"
                            onClick={() =>
                              void save(item, {
                                content: item.content,
                                category: item.category,
                                scope: item.scope,
                                status: "active",
                              })
                            }
                            className="text-[11px] font-medium text-green-soft hover:underline"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingId(item.id)}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                          aria-label={`Edit: ${item.content.slice(0, 40)}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(item)}
                          className="text-[11px] font-medium text-red-soft hover:underline"
                          aria-label={`Delete: ${item.content.slice(0, 40)}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-snug text-neutral-800">
                      {item.content}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {sourceDescription(item)} ·{" "}
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function sourceDescription(item: StoryContextItem): string {
  switch (item.source) {
    case "author_answer":
      return item.sourceQuestion
        ? `From your answer to “${item.sourceQuestion}”`
        : "From an answer you gave";
    case "manual_entry":
      return "Added by you";
    case "resolved_conflict":
      return "From a contradiction you resolved";
    case "manuscript":
      return "From the manuscript";
  }
}

function ContextEditor({
  heading,
  initial,
  onSave,
  onCancel,
}: {
  heading: string;
  initial: {
    content: string;
    category: StoryContextCategory;
    scope: StoryContextScope;
  };
  onSave: (fields: {
    content: string;
    category: StoryContextCategory;
    scope: StoryContextScope;
  }) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initial.content);
  const [category, setCategory] = useState(initial.category);
  const [scope, setScope] = useState(initial.scope);

  return (
    <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-2.5">
      <div className="text-[11px] font-semibold text-neutral-600">{heading}</div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        aria-label="Context content"
        className="mt-1.5 w-full resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] focus:border-blue-400 focus:outline-none"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StoryContextCategory)}
          aria-label="Category"
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[12px]"
        >
          {STORY_CONTEXT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as StoryContextScope)}
          aria-label="Scope"
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[12px]"
        >
          {(Object.keys(SCOPE_LABELS) as StoryContextScope[]).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onSave({ content: content.trim(), category, scope })}
          disabled={!content.trim()}
          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-2.5 py-1 text-[12px] text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Badge({
  children,
  muted,
  warning,
}: {
  children: React.ReactNode;
  muted?: boolean;
  warning?: boolean;
}) {
  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        warning
          ? "bg-amber-light text-amber-accent"
          : muted
          ? "bg-neutral-100 text-neutral-500"
          : "bg-blue-50 text-blue-700",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
