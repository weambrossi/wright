"use client";

import { useEffect, useState, useCallback } from "react";

export type ToastKind = "info" | "success" | "error";

export interface ToastMessage {
  id: string;
  text: string;
  kind?: ToastKind;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastHostProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.action) return; // sticky if it has an action
    const ms = toast.durationMs ?? 4000;
    const t = window.setTimeout(() => onDismiss(toast.id), ms);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  const borderColor =
    toast.kind === "error"
      ? "border-l-red-soft"
      : toast.kind === "success"
      ? "border-l-green-soft"
      : "border-l-amber-accent";

  return (
    <div
      className={`pointer-events-auto bg-cream-100 text-ink-900 border border-cream-300 border-l-4 ${borderColor} rounded-panel shadow-toast px-4 py-3 max-w-sm animate-slideUp`}
    >
      <div className="text-sm">{toast.text}</div>
      <div className="flex items-center gap-3 mt-1">
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="text-xs text-amber-accent font-medium hover:underline"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-xs text-ink-500 hover:text-ink-900"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((t: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
