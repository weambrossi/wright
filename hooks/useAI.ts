"use client";

import { useCallback, useRef, useState } from "react";
import type { AIRequest } from "@/lib/prompts";

export interface AIStreamHandlers {
  onChunk?: (chunk: string, accumulated: string) => void;
  onDone?: (final: string) => void;
  onError?: (err: Error) => void;
}

export function useAI() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (req: AIRequest, handlers: AIStreamHandlers = {}) => {
      setError(null);
      setResponse("");
      setIsStreaming(true);

      // cancel any previous
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      let accumulated = "";

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Claude couldn't respond (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setResponse(accumulated);
          handlers.onChunk?.(chunk, accumulated);
        }

        handlers.onDone?.(accumulated);
        return accumulated;
      } catch (err) {
        if ((err as Error).name === "AbortError") return accumulated;
        const e = err instanceof Error ? err : new Error("Unknown error");
        setError(e.message);
        handlers.onError?.(e);
        return accumulated;
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { run, cancel, isStreaming, response, error };
}
