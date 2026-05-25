"use client";

export interface GrammarIssue {
  originalPhrase: string;
  suggestedFix: string;
  issueType: string;
  reason: string;
}

interface IssueCardProps {
  issue: GrammarIssue;
  onApply: () => void;
  onDismiss: () => void;
  applied?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  Grammar: "bg-red-soft/15 text-red-soft",
  Clarity: "bg-amber-accent/15 text-amber-accent",
  Wordiness: "bg-ink-700/10 text-ink-700",
  Tone: "bg-green-soft/15 text-green-soft",
  Flow: "bg-amber-light text-amber-accent",
};

export function IssueCard({
  issue,
  onApply,
  onDismiss,
  applied,
}: IssueCardProps) {
  const badgeClass =
    TYPE_COLORS[issue.issueType] || "bg-cream-300 text-ink-700";

  return (
    <div
      className={`bg-cream-100 border border-cream-300 rounded-panel p-3 ${
        applied ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${badgeClass}`}
        >
          {issue.issueType}
        </span>
        {applied && (
          <span className="text-[10px] text-green-soft font-medium">
            Applied ✓
          </span>
        )}
      </div>
      <div className="text-xs text-ink-500 mb-1">Original</div>
      <code className="block bg-cream-200/60 text-ink-700 text-[13px] font-mono px-2 py-1 rounded mb-2 break-words">
        {issue.originalPhrase}
      </code>
      <div className="text-xs text-ink-500 mb-1">Suggestion</div>
      <div className="text-[14px] text-ink-900 font-serif mb-2 leading-snug">
        {issue.suggestedFix}
      </div>
      {issue.reason && (
        <div className="text-xs text-ink-500 italic mb-3">{issue.reason}</div>
      )}
      {!applied && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 bg-amber-accent text-white text-xs font-medium rounded px-3 py-1.5 hover:opacity-90"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="px-2 py-1.5 text-ink-500 hover:text-ink-900 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
