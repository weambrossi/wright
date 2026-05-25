"use client";

interface StreamingResponseProps {
  text: string;
  isStreaming: boolean;
  emptyHint?: string;
  fontClass?: string;
}

export function StreamingResponse({
  text,
  isStreaming,
  emptyHint,
  fontClass = "font-serif",
}: StreamingResponseProps) {
  if (!text && isStreaming) {
    return (
      <div className="space-y-2 px-1 py-2">
        <div className="shimmer-row w-[90%]" />
        <div className="shimmer-row w-[75%]" />
        <div className="shimmer-row w-[85%]" />
      </div>
    );
  }
  if (!text) {
    return emptyHint ? (
      <div className="text-sm text-ink-500 italic px-1">{emptyHint}</div>
    ) : null;
  }
  return (
    <div
      className={`${fontClass} text-ink-900 text-[15px] leading-relaxed whitespace-pre-wrap px-1`}
    >
      {text}
      {isStreaming && (
        <span className="inline-block w-[6px] h-[14px] bg-amber-accent align-middle ml-0.5 animate-breath" />
      )}
    </div>
  );
}
