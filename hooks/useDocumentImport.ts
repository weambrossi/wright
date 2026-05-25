"use client";

import { useCallback, useState } from "react";

export function useDocumentImport() {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(async (file: File): Promise<string | null> => {
    setImporting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not parse document");
      }
      const data = (await res.json()) as { html: string };
      return data.html;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      return null;
    } finally {
      setImporting(false);
    }
  }, []);

  return { importFile, importing, error };
}
