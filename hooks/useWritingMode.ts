"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WRITING_MODE,
  type WritingControlMode,
} from "@/lib/writing/types";
import { trackWritingEvent } from "@/lib/writing/analytics";

const STORAGE_KEY = "wright:writing-control-mode";

function isMode(value: string | null): value is WritingControlMode {
  return (
    value === "ask_me_first" ||
    value === "suggest_options" ||
    value === "draft_freely"
  );
}

/**
 * The author's writing control mode, persisted as a user preference so the
 * most recent selection survives reloads. Included in every writing request.
 */
export function useWritingMode() {
  const [mode, setModeState] = useState<WritingControlMode>(DEFAULT_WRITING_MODE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isMode(stored)) setModeState(stored);
    } catch {
      // Private browsing etc. — default stands.
    }
  }, []);

  const setMode = useCallback((next: WritingControlMode) => {
    setModeState(next);
    trackWritingEvent("writing_mode_selected", { mode: next });
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal.
    }
  }, []);

  return { mode, setMode };
}
