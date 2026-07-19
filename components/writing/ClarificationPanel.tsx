"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClarificationQuestion,
  StoryContextConflict,
  SuggestedAnswer,
} from "@/lib/writing/types";
import type { WritingFlow, WritingPanelState } from "@/hooks/useWritingFlow";

// The clarification question area. Renders directly above the chat input in a
// visually distinct container — never as a chat bubble, never inside the
// document. One question at a time.

interface ClarificationPanelProps {
  flow: WritingFlow;
}

export function ClarificationPanel({ flow }: ClarificationPanelProps) {
  const { panel } = flow;
  if (panel.kind === "idle") return null;

  return (
    <section
      role="region"
      aria-label="Wright needs your input before writing"
      aria-live="polite"
      className="mb-2 rounded-panel border border-amber-accent/40 bg-amber-light/40 shadow-paper"
      data-testid="clarification-panel"
    >
      {panel.kind === "starting" && <StartingState />}
      {panel.kind === "question" && <QuestionState flow={flow} panel={panel} />}
      {panel.kind === "options" && <OptionsState flow={flow} panel={panel} />}
      {panel.kind === "conflict" && <ConflictState flow={flow} panel={panel} />}
      {panel.kind === "review" && <ReviewState flow={flow} panel={panel} />}
      {panel.kind === "generating" && (
        <GeneratingState flow={flow} panel={panel} />
      )}
      {panel.kind === "insert_review" && (
        <InsertReviewState flow={flow} panel={panel} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Starting
// ---------------------------------------------------------------------------

function StartingState() {
  return (
    <div className="px-3.5 py-4">
      <BusyIndicator
        text="Checking your story context…"
        subtext="Wright is reading your manuscript and stored context before writing."
      />
    </div>
  );
}

/** Prominent loading block — the workflow steps take a few seconds each. */
function BusyIndicator({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <svg
        className="h-6 w-6 shrink-0 animate-spin text-amber-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <div>
        <div className="text-[13px] font-medium text-neutral-800">{text}</div>
        {subtext && (
          <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

function QuestionState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "question" }>;
}) {
  const { question } = panel;
  const [custom, setCustom] = useState(initialAnswerText(flow, question));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const multi = question.answerType === "multi_choice";

  // Reset local state when the question changes.
  useEffect(() => {
    setCustom(initialAnswerText(flow, question));
    setSelectedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const chooseSuggested = (s: SuggestedAnswer) => {
    if (panel.busy) return;
    if (multi) {
      setSelectedIds((prev) =>
        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
      );
      return;
    }
    void flow.submitAnswer(question.id, s.label, "selected_option");
  };

  const submitCustom = () => {
    if (panel.busy) return;
    if (multi && selectedIds.length > 0) {
      const labels = (question.suggestedAnswers ?? [])
        .filter((s) => selectedIds.includes(s.id))
        .map((s) => s.label);
      const combined = custom.trim() ? [...labels, custom.trim()] : labels;
      void flow.submitAnswer(question.id, combined, "selected_option");
      return;
    }
    if (!custom.trim()) return;
    void flow.submitAnswer(question.id, custom.trim(), "author");
  };

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <PanelHeading
          title="Help me understand before I write"
          subtitle="Answering this will help the writing match your intent instead of making assumptions."
        />
        <ProgressBadge
          number={panel.questionNumber}
          remaining={panel.remainingEstimate}
          isEdit={panel.isEdit}
        />
      </div>

      <p className="mt-2 text-[13px] font-medium leading-snug text-neutral-800">
        {question.question}
      </p>
      {question.whyItMatters && (
        <p className="mt-1 text-[11px] leading-snug text-neutral-500">
          {question.whyItMatters}
        </p>
      )}

      {question.suggestedAnswers && question.suggestedAnswers.length > 0 && (
        <div
          className="mt-2.5 flex flex-col gap-1.5"
          role={multi ? "group" : undefined}
          aria-label="Suggested answers"
        >
          {question.suggestedAnswers.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={panel.busy}
              onClick={() => chooseSuggested(s)}
              aria-pressed={multi ? selectedIds.includes(s.id) : undefined}
              className={[
                "rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] leading-snug transition-colors disabled:opacity-50",
                multi && selectedIds.includes(s.id)
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:bg-blue-50/60",
              ].join(" ")}
            >
              {s.label}
              {s.description && (
                <span className="mt-0.5 block text-[11px] text-neutral-400">
                  {s.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2.5">
        <label
          htmlFor="clarification-custom-answer"
          className="mb-1 block text-[11px] font-medium text-neutral-500"
        >
          {question.suggestedAnswers?.length
            ? "Or write your own answer"
            : "Your answer"}
        </label>
        <textarea
          id="clarification-custom-answer"
          ref={inputRef}
          value={custom}
          disabled={panel.busy}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitCustom();
            }
            if (e.key === "Escape") void flow.cancel();
          }}
          rows={question.answerType === "long_text" ? 3 : 2}
          placeholder="Type your answer…"
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      </div>

      {panel.error && <ErrorLine text={panel.error} />}

      {panel.busy ? (
        <div className="mt-2">
          <BusyIndicator
            text="Adding context…"
            subtext="Saving your answer and checking whether Wright needs anything else."
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PrimaryButton
            onClick={submitCustom}
            disabled={!custom.trim() && !(multi && selectedIds.length > 0)}
          >
            Continue
          </PrimaryButton>
          <GhostButton onClick={() => void flow.skip()}>Skip</GhostButton>
          <GhostButton
            title="Wright picks the most fitting answer itself and writes with it as a clearly labeled temporary assumption — never saved as story canon."
            onClick={() =>
              void flow.submitAnswer(
                question.id,
                "You choose — make the best choice for this detail, keep it consistent with everything established, and flag it as an assumption. (temporary assumption — not confirmed canon)",
                "temporary_ai_assumption"
              )
            }
          >
            Make the best choice for me
          </GhostButton>
          <GhostButton
            title="Skip all remaining questions and write now. Wright makes reasonable choices and flags them as assumptions — nothing is saved as story canon."
            onClick={() => void flow.generateWithoutAnswering()}
          >
            Generate without answering
          </GhostButton>
          {panel.isEdit && (
            <GhostButton onClick={flow.backToReview}>Back</GhostButton>
          )}
          <div className="flex-1" />
          <GhostButton onClick={() => void flow.cancel()}>Cancel</GhostButton>
        </div>
      )}
    </div>
  );
}

function initialAnswerText(
  flow: WritingFlow,
  question: ClarificationQuestion
): string {
  const existing = flow.request?.answers[question.id];
  if (!existing) return "";
  return Array.isArray(existing.answer)
    ? existing.answer.join("; ")
    : existing.answer;
}

function ProgressBadge({
  number,
  remaining,
  isEdit,
}: {
  number: number;
  remaining?: number;
  isEdit: boolean;
}) {
  const label = isEdit
    ? "Editing answer"
    : remaining != null && remaining > 0
    ? `Question ${number} of about ${number + remaining}`
    : `Question ${number}`;
  return (
    <span
      title={
        isEdit
          ? "You're editing a previous answer"
          : remaining != null && remaining > 0
          ? `Wright expects about ${remaining} more question${remaining === 1 ? "" : "s"} after this one`
          : "This may be the only question"
      }
      className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-amber-accent ring-1 ring-amber-accent/40"
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Options after skip
// ---------------------------------------------------------------------------

function OptionsState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "options" }>;
}) {
  const [selected, setSelected] = useState<SuggestedAnswer | null>(null);
  const [custom, setCustom] = useState("");
  const { question } = panel;

  const currentAnswer = () => selected?.label ?? custom.trim();

  return (
    <div className="px-3.5 py-3">
      <PanelHeading
        title="You skipped — choose how to handle this"
        subtitle={`I won't silently invent the answer to “${question.question}”. Pick a direction, write your own, or let me make a labeled temporary assumption.`}
      />

      <div className="mt-2.5 flex flex-col gap-1.5" role="group" aria-label="Possible directions">
        {panel.options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={panel.busy}
            onClick={() => setSelected(selected?.id === o.id ? null : o)}
            aria-pressed={selected?.id === o.id}
            className={[
              "rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] leading-snug transition-colors disabled:opacity-50",
              selected?.id === o.id
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:bg-blue-50/60",
            ].join(" ")}
          >
            {o.label}
            {o.description && (
              <span className="mt-0.5 block text-[11px] text-neutral-400">
                {o.description}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-2.5">
        <label
          htmlFor="skip-custom-answer"
          className="mb-1 block text-[11px] font-medium text-neutral-500"
        >
          Or write your own answer
        </label>
        <textarea
          id="skip-custom-answer"
          value={custom}
          disabled={panel.busy}
          onChange={(e) => {
            setCustom(e.target.value);
            if (e.target.value.trim()) setSelected(null);
          }}
          rows={2}
          placeholder="Type your answer…"
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      </div>

      {panel.error && <ErrorLine text={panel.error} />}

      {panel.busy ? (
        <div className="mt-2">
          <BusyIndicator
            text="Getting more information…"
            subtext="Wright is working on this before continuing."
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PrimaryButton
            onClick={() =>
              void flow.submitAnswer(
                question.id,
                currentAnswer(),
                selected ? "selected_option" : "author"
              )
            }
            disabled={!currentAnswer()}
          >
            Use this answer
          </PrimaryButton>
          <GhostButton
            title="Wright will write with this as a clearly labeled temporary assumption. It won't become story canon unless you accept it later."
            onClick={() =>
              void flow.submitAnswer(
                question.id,
                `${currentAnswer()} (temporary assumption — not confirmed canon)`,
                "temporary_ai_assumption"
              )
            }
            disabled={!currentAnswer()}
          >
            Use as temporary assumption
          </GhostButton>
          <GhostButton
            title="Wright drafts freely for this detail, makes a reasonable choice itself, and flags it as an assumption you can review."
            onClick={() =>
              void flow.submitAnswer(
                question.id,
                "You choose — make a reasonable creative decision for this detail, keep it consistent with everything established, and flag it as an assumption. (temporary assumption — not confirmed canon)",
                "temporary_ai_assumption"
              )
            }
          >
            You choose
          </GhostButton>
          <GhostButton onClick={() => void flow.leaveUnspecified()}>
            Leave unspecified
          </GhostButton>
          <GhostButton onClick={() => void flow.moreOptions()}>
            Different options
          </GhostButton>
          <div className="flex-1" />
          <GhostButton onClick={() => void flow.cancel()}>Cancel</GhostButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contradiction
// ---------------------------------------------------------------------------

function ConflictState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "conflict" }>;
}) {
  const conflict: StoryContextConflict | undefined = panel.conflicts[0];
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState("");
  if (!conflict) return null;

  return (
    <div className="px-3.5 py-3">
      <PanelHeading
        title="This answer conflicts with your story"
        subtitle="I won't overwrite existing story context without your decision."
        tone="warning"
      />

      <dl className="mt-2.5 space-y-2 text-[12.5px] leading-snug">
        <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Your new answer
          </dt>
          <dd className="mt-0.5 text-neutral-800">{conflict.newStatement}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Established context — from {conflict.existingSource}
          </dt>
          <dd className="mt-0.5 text-neutral-800">
            {conflict.existingStatement}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] leading-snug text-neutral-600">
        {conflict.explanation}
      </p>

      {editing && (
        <div className="mt-2.5">
          <label
            htmlFor="conflict-edited-answer"
            className="mb-1 block text-[11px] font-medium text-neutral-500"
          >
            Edit your answer
          </label>
          <textarea
            id="conflict-edited-answer"
            value={edited}
            disabled={panel.busy}
            onChange={(e) => setEdited(e.target.value)}
            rows={2}
            placeholder="Rewrite your answer so it fits the story…"
            className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-neutral-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
      )}

      {panel.error && <ErrorLine text={panel.error} />}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <PrimaryButton
              onClick={() =>
                void flow.resolveConflict(conflict.id, "edit_new", edited.trim())
              }
              disabled={panel.busy || !edited.trim()}
              busy={panel.busy}
            >
              Save edited answer
            </PrimaryButton>
            <GhostButton onClick={() => setEditing(false)} disabled={panel.busy}>
              Back
            </GhostButton>
          </>
        ) : (
          <>
            <GhostButton
              onClick={() => void flow.resolveConflict(conflict.id, "keep_existing")}
              disabled={panel.busy}
            >
              Keep existing
            </GhostButton>
            <GhostButton
              onClick={() =>
                void flow.resolveConflict(conflict.id, "replace_with_new")
              }
              disabled={panel.busy}
            >
              Replace with new
            </GhostButton>
            <GhostButton onClick={() => setEditing(true)} disabled={panel.busy}>
              Edit answer
            </GhostButton>
            <GhostButton
              title="Both statements stay — they apply in different situations."
              onClick={() => void flow.resolveConflict(conflict.id, "keep_both")}
              disabled={panel.busy}
            >
              Keep both
            </GhostButton>
            <GhostButton
              title="Mark the difference as intentional (e.g. a character is lying or pretending)."
              onClick={() =>
                void flow.resolveConflict(conflict.id, "mark_intentional")
              }
              disabled={panel.busy}
            >
              Intentional
            </GhostButton>
          </>
        )}
        <div className="flex-1" />
        <GhostButton
          onClick={() => void flow.resolveConflict(conflict.id, "cancel")}
          disabled={panel.busy}
        >
          Cancel
        </GhostButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review before generation
// ---------------------------------------------------------------------------

function ReviewState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "review" }>;
}) {
  return (
    <div className="px-3.5 py-3">
      <PanelHeading
        title="Review your answers"
        subtitle="Wright will write from these. Edit anything before generating."
      />

      <ul className="mt-2.5 space-y-1.5">
        {panel.questions.map((q) => {
          const a = panel.answers[q.id];
          const text = a
            ? Array.isArray(a.answer)
              ? a.answer.join("; ")
              : a.answer
            : "(no answer)";
          return (
            <li
              key={q.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="text-[11px] leading-snug text-neutral-500">
                  {q.question}
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-800">
                  {text}
                  {a?.source === "temporary_ai_assumption" && (
                    <span className="ml-1.5 rounded bg-amber-light px-1.5 py-0.5 text-[10px] font-medium text-amber-accent">
                      AI assumption
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => flow.editAnswer(q.id)}
                disabled={panel.busy}
                className="shrink-0 text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                aria-label={`Edit answer to: ${q.question}`}
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>

      {panel.assumptions.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-accent/30 bg-white px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-accent">
            Wright will assume
          </div>
          <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-neutral-700">
            {panel.assumptions.map((a) => (
              <li key={a.id}>
                {a.importance === "major" ? "⚠ " : ""}
                {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {panel.error && <ErrorLine text={panel.error} />}

      <div className="mt-2.5 flex items-center gap-2">
        <PrimaryButton
          onClick={() => void flow.generate()}
          disabled={panel.busy}
          busy={panel.busy}
        >
          Looks right — write it
        </PrimaryButton>
        <div className="flex-1" />
        <GhostButton onClick={() => void flow.cancel()} disabled={panel.busy}>
          Cancel
        </GhostButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

function GeneratingState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "generating" }>;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center gap-2 text-[13px] text-neutral-700">
        <Spinner />
        {panel.destination === "document_editor"
          ? "Writing your passage…"
          : "Writing…"}
        <div className="flex-1" />
        <GhostButton onClick={() => void flow.cancel()}>Stop</GhostButton>
      </div>
      {panel.destination === "document_editor" && panel.preview && (
        <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-neutral-700">
          {panel.preview}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insert review (document changed while answering)
// ---------------------------------------------------------------------------

function InsertReviewState({
  flow,
  panel,
}: {
  flow: WritingFlow;
  panel: Extract<WritingPanelState, { kind: "insert_review" }>;
}) {
  return (
    <div className="px-3.5 py-3">
      <PanelHeading
        title={
          panel.reason === "selection_invalid"
            ? "The selected text changed"
            : "Your document changed while we talked"
        }
        subtitle="Review the passage before it goes in — I didn't insert it automatically."
        tone="warning"
      />
      <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-neutral-700">
        {panel.content}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => flow.insertAnyway(panel.content)}>
          Insert at cursor
        </PrimaryButton>
        <GhostButton
          onClick={() => {
            void navigator.clipboard?.writeText(panel.content);
          }}
        >
          Copy
        </GhostButton>
        <div className="flex-1" />
        <GhostButton onClick={flow.discardResult}>Discard</GhostButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PanelHeading({
  title,
  subtitle,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "warning";
}) {
  return (
    <header>
      <h3
        className={[
          "text-[12px] font-semibold",
          tone === "warning" ? "text-red-soft" : "text-amber-accent",
        ].join(" ")}
      >
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
          {subtitle}
        </p>
      )}
    </header>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
    >
      {busy && <Spinner light />}
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-2 text-[11.5px] text-red-soft">
      {text}
    </p>
  );
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg
      className={["h-3.5 w-3.5 animate-spin", light ? "text-white" : "text-amber-accent"].join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
