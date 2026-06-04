"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ----------------------------- layout helpers ---------------------------- */

/** A labelled group of controls, like Word's "Font" / "Paragraph" sections. */
export function Group({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 px-2">
      <div className="flex items-center gap-1">{children}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </div>
    </div>
  );
}

/** A horizontal row used to stack controls inside a group. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

export function Divider() {
  return <div className="mx-1 h-12 w-px shrink-0 self-center bg-neutral-200" />;
}

/* ------------------------------- buttons --------------------------------- */

export function RibbonButton({
  title,
  active,
  disabled,
  onClick,
  children,
  className = "",
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      className={[
        "grid h-7 min-w-7 place-items-center rounded px-1 text-neutral-700",
        "hover:bg-neutral-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        active ? "bg-blue-50 text-blue-700 ring-1 ring-blue-300" : "",
        disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A text-label button (e.g. for the Insert / Layout tab tiles). */
export function RibbonTile({
  title,
  label,
  onClick,
  icon,
}: {
  title: string;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-[52px] w-16 flex-col items-center justify-center gap-1 rounded px-1 text-center text-[11px] leading-tight text-neutral-700 hover:bg-neutral-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <span className="text-neutral-600">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ------------------------------- selects --------------------------------- */

export function RibbonSelect({
  value,
  onChange,
  title,
  width = 120,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  return (
    <select
      title={title}
      aria-label={title}
      value={value}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      style={{ width }}
      className="h-7 rounded border border-neutral-300 bg-white px-1.5 text-xs text-neutral-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
    >
      {children}
    </select>
  );
}

/* ----------------------------- color picker ------------------------------ */

const SWATCHES = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#c0593a", "#e69138", "#f1c232", "#6aa84f", "#3d85c6", "#674ea7",
  "#cc0000", "#e06666", "#ffd966", "#93c47d", "#76a5af", "#8e7cc3",
];

/**
 * A swatch popover used for text color and highlight. Renders a trigger button
 * (the icon) and, when open, a small grid of swatches plus a clear option.
 */
export function ColorPicker({
  title,
  icon,
  onPick,
  onClear,
  clearLabel = "None",
}: {
  title: string;
  icon: ReactNode;
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={title}
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 min-w-7 place-items-center rounded px-1 text-neutral-700 hover:bg-neutral-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[164px] rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
          <div className="grid grid-cols-6 gap-1">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                className="h-5 w-5 rounded-sm border border-neutral-300"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-100"
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- icons ---------------------------------- */

const sw = 2;
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
