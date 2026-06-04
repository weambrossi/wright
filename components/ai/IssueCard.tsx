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
  Grammar: "bg-red-50 text-red-600",
  Clarity: "bg-blue-50 text-blue-700",
  Wordiness: "bg-neutral-100 text-neutral-700",
  Tone: "bg-green-50 text-green-700",
  Flow: "bg-blue-50 text-blue-700",
};

export function IssueCard({
  issue,
  onApply,
  onDismiss,
  applied,
}: IssueCardProps) {
  const badgeClass =
    TYPE_COLORS[issue.issueType] || "bg-neutral-100 text-neutral-700";

  return (
    <div
      className={`bg-white border border-neutral-200 rounded-md p-3 shadow-sm ${
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
          <span className="text-[10px] text-green-700 font-medium">
            Applied ✓
          </span>
        )}
      </div>
      <div className="text-xs text-neutral-500 mb-1">Original</div>
      <code className="block bg-neutral-100 text-neutral-700 text-[13px] font-mono px-2 py-1 rounded mb-2 break-words">
        {issue.originalPhrase}
      </code>
      <div className="text-xs text-neutral-500 mb-1">Suggestion</div>
      <div className="text-[14px] text-neutral-800 mb-2 leading-snug">
        {issue.suggestedFix}
      </div>
      {issue.reason && (
        <div className="text-xs text-neutral-500 mb-3">{issue.reason}</div>
      )}
      {!applied && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 bg-blue-600 text-white text-xs font-medium rounded px-3 py-1.5 hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="px-2 py-1.5 text-neutral-500 hover:text-neutral-800 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
