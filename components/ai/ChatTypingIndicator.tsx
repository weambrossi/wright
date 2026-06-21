"use client";

const DOT_DELAYS = ["0ms", "160ms", "320ms"] as const;

export function ChatTypingIndicator() {
  return (
    <div
      className="flex items-center gap-3 py-0.5"
      role="status"
      aria-label="Wright is writing"
    >
      <div className="flex items-center gap-1" aria-hidden="true">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-typing-dot"
            style={{ animationDelay: delay }}
          />
        ))}
      </div>
      <span className="text-[12px] text-neutral-400">Writing…</span>
    </div>
  );
}

export function ChatStreamCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[1px] animate-stream-cursor rounded-full bg-blue-500 align-text-bottom"
      aria-hidden="true"
    />
  );
}
