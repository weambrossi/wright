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
  fontClass = "",
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
      <div className="text-sm text-neutral-500 px-1">{emptyHint}</div>
    ) : null;
  }
  return (
    <div
      className={`${fontClass} text-neutral-800 text-[14px] leading-relaxed whitespace-pre-wrap px-1`}
    >
      {text}
      {isStreaming && (
        <span className="inline-block w-[6px] h-[14px] bg-blue-600 align-middle ml-0.5 animate-breath" />
      )}
    </div>
  );
}
