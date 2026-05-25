"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PENDING_HTML_KEY = "pagemind:pending-html";
const PENDING_FILENAME_KEY = "pagemind:pending-filename";

export default function LandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not parse that document");
        }
        const data = (await res.json()) as { html: string; filename: string };
        sessionStorage.setItem(PENDING_HTML_KEY, data.html);
        sessionStorage.setItem(
          PENDING_FILENAME_KEY,
          data.filename.replace(/\.docx$/i, "")
        );
        router.push("/editor");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <main className="min-h-screen w-full bg-cream-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col items-center text-center">
        <div className="font-serif italic text-5xl text-ink-900 tracking-tight">
          PageMind
        </div>
        <div className="mt-4 text-ink-500 text-base">
          Your book, with an AI collaborator.
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={[
            "mt-12 w-full rounded-modal border-2 border-dashed px-8 py-16 flex flex-col items-center justify-center gap-3",
            "transition",
            dragging
              ? "border-amber-accent bg-amber-light"
              : "border-cream-300 bg-cream-100/40 hover:border-amber-accent hover:bg-amber-light",
            uploading ? "opacity-60 cursor-wait" : "cursor-pointer",
          ].join(" ")}
        >
          <UploadIcon />
          <div className="text-ink-700 text-base">
            {uploading ? (
              <span>Reading your document…</span>
            ) : (
              <>
                <span className="font-medium">Drop your .docx here</span>
                <span className="text-ink-500"> or click to browse</span>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onChange}
          />
        </button>

        {error && (
          <div className="mt-4 text-sm text-red-soft">{error}</div>
        )}

        <button
          type="button"
          onClick={() => router.push("/editor")}
          className="mt-6 text-amber-accent text-sm hover:underline"
        >
          Or start with a blank document →
        </button>
      </div>

      <footer className="mt-24 flex items-center gap-2 text-xs text-ink-500">
        <span>Powered by</span>
        <span className="font-medium text-ink-700">Claude</span>
        <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-amber-accent" />
      </footer>
    </main>
  );
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-500"
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
