"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ASK_QUESTIONS,
  DEFAULT_NATURALNESS,
  type NaturalnessLevel,
} from "@/lib/writing/types";
import { trackWritingEvent } from "@/lib/writing/analytics";

const NATURALNESS_KEY = "wright:naturalness";
const ASK_QUESTIONS_KEY = "wright:ask-questions";

function isNaturalness(value: string | null): value is NaturalnessLevel {
  return (
    value === "preserve_current_style" ||
    value === "balanced" ||
    value === "natural_understated" ||
    value === "raw_conversational"
  );
}

/**
 * Author preferences for the natural-prose enhancement, persisted like the
 * writing control mode:
 * - naturalness: how aggressively AI-typical prose patterns are reduced
 * - askQuestions: whether Wright may pause to ask clarification questions
 */
export function useGenerationPreferences() {
  const [naturalness, setNaturalnessState] =
    useState<NaturalnessLevel>(DEFAULT_NATURALNESS);
  const [askQuestions, setAskQuestionsState] = useState<boolean>(
    DEFAULT_ASK_QUESTIONS
  );

  useEffect(() => {
    try {
      const storedNaturalness = window.localStorage.getItem(NATURALNESS_KEY);
      if (isNaturalness(storedNaturalness)) {
        setNaturalnessState(storedNaturalness);
      }
      const storedAsk = window.localStorage.getItem(ASK_QUESTIONS_KEY);
      if (storedAsk === "false") setAskQuestionsState(false);
    } catch {
      // Private browsing etc. — defaults stand.
    }
  }, []);

  const setNaturalness = useCallback((next: NaturalnessLevel) => {
    setNaturalnessState(next);
    trackWritingEvent("naturalness_selected", { naturalness: next });
    try {
      window.localStorage.setItem(NATURALNESS_KEY, next);
    } catch {
      // Non-fatal.
    }
  }, []);

  const setAskQuestions = useCallback((next: boolean) => {
    setAskQuestionsState(next);
    trackWritingEvent("ask_questions_toggled", { enabled: next });
    try {
      window.localStorage.setItem(ASK_QUESTIONS_KEY, String(next));
    } catch {
      // Non-fatal.
    }
  }, []);

  return { naturalness, setNaturalness, askQuestions, setAskQuestions };
}
