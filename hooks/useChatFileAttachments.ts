"use client";

import { useCallback, useRef, useState } from "react";
import {
  CHAT_CONTEXT_ACCEPT,
  MAX_CHAT_CONTEXT_FILES,
  MAX_CHAT_FILE_SIZE_BYTES,
  MAX_CHAT_CONTEXT_CHARS,
  type ChatFileAttachment,
  validateChatContextFile,
  isTextContextFile,
} from "@/lib/ai/chatFileContext";
import { ImportValidationError } from "@/lib/import/validateFile";

export function useChatFileAttachments(
  onToast: (msg: string, kind?: "success" | "error" | "info") => void
) {
  const [files, setFiles] = useState<ChatFileAttachment[]>([]);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const parseFile = useCallback(async (file: File): Promise<ChatFileAttachment> => {
    validateChatContextFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (isTextContextFile(file.name)) {
      const raw = await file.text();
      const text = raw.replace(/\u0000/g, "").trim();
      if (!text) {
        throw new ImportValidationError(
          "That file is empty. Try a document with some content.",
          "empty_file"
        );
      }
      const truncated = text.length > MAX_CHAT_CONTEXT_CHARS;
      return {
        id: crypto.randomUUID(),
        name: file.name,
        text: truncated ? text.slice(0, MAX_CHAT_CONTEXT_CHARS) : text,
        truncated,
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/ai/context-file", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      name?: string;
      text?: string;
      truncated?: boolean;
    };
    if (!res.ok) {
      throw new Error(data.error || "We couldn't read that file.");
    }
    return {
      id: crypto.randomUUID(),
      name: data.name ?? file.name,
      text: data.text ?? "",
      truncated: data.truncated,
    };
  }, []);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const remaining = MAX_CHAT_CONTEXT_FILES - files.length;
      if (remaining <= 0) {
        onToast(`You can attach up to ${MAX_CHAT_CONTEXT_FILES} files.`, "info");
        return;
      }

      const batch = list.slice(0, remaining);
      if (list.length > remaining) {
        onToast(
          `Only ${remaining} more file${remaining === 1 ? "" : "s"} can be attached.`,
          "info"
        );
      }

      setParsing(true);
      try {
        const parsed: ChatFileAttachment[] = [];
        for (const file of batch) {
          try {
            parsed.push(await parseFile(file));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "We couldn't read that file.";
            onToast(message, "error");
          }
        }
        if (parsed.length > 0) {
          setFiles((prev) => [...prev, ...parsed]);
        }
      } finally {
        setParsing(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [files.length, onToast, parseFile]
  );

  return {
    files,
    parsing,
    inputRef,
    accept: CHAT_CONTEXT_ACCEPT,
    openPicker,
    removeFile,
    clearFiles,
    addFiles,
    maxBytes: MAX_CHAT_FILE_SIZE_BYTES,
  };
}
