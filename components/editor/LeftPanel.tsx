"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface LeftPanelProps {
  wordCount: number;
  title: string;
}

export function LeftPanel({
  wordCount,
  title,
}: LeftPanelProps) {
  const router = useRouter();

  return (
    <aside className="w-[72px] shrink-0 border-r border-cream-300 bg-cream-200 px-1.5 py-3 sm:w-[84px] sm:px-2">
      <div className="flex h-full flex-col items-stretch gap-2">
        <RailButton
          label="Home"
          description="Go back to the start screen"
          onClick={() => router.push("/")}
        >
          <DocIcon />
        </RailButton>

        <div className="mt-2 border-t border-cream-300 pt-3">
          <RailButton
            label="Words"
            description={`${wordCount.toLocaleString()} words in ${title}`}
          >
            <CountIcon />
          </RailButton>
          <div className="mt-1 text-center text-xs font-bold text-ink-500">
            {wordCount.toLocaleString()}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RailButton({
  label,
  description,
  onClick,
  children,
}: {
  label: string;
  description: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        title={`${label}: ${description}`}
        aria-label={`${label}: ${description}`}
        onClick={onClick}
        className="flex min-h-[64px] w-full flex-col items-center justify-center gap-1 rounded border border-transparent px-1 text-center text-xs font-bold text-ink-900 hover:border-cream-300 hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-amber-light focus:ring-offset-2 sm:min-h-[68px] sm:text-sm"
      >
        {children}
        <span className="leading-tight">{label}</span>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 w-max max-w-[240px] -translate-y-1/2 rounded bg-[#111827] px-3 py-2 text-left text-xs font-medium text-white opacity-0 shadow-lg group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-[#dbe4f0]">{description}</span>
      </span>
    </div>
  );
}

const sw = 2.4;
function svg(children: ReactNode) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const DocIcon = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /></>);
const CountIcon = () => svg(<><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h16" /></>);
