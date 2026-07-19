// Privacy-conscious product analytics for the writing workflow.
//
// There is no analytics vendor in this stack, so events go to the server log
// in a structured form. Payloads must never contain manuscript text, prompts,
// or author answers — only ids, enums, and counts.

export type WritingAnalyticsEvent =
  | "writing_mode_selected"
  | "clarification_requested"
  | "suggested_answer_selected"
  | "custom_answer_submitted"
  | "question_skipped"
  | "question_edited"
  | "contradiction_detected"
  | "contradiction_resolved"
  | "context_saved"
  | "generation_started"
  | "generation_completed"
  | "generation_inserted"
  | "generation_rejected"
  | "generation_regenerated"
  | "pending_request_cancelled"
  | "evaluation_failed_fallback"
  | "questions_disabled_generation"
  | "generated_without_answering"
  | "naturalness_selected"
  | "ask_questions_toggled"
  | "draft_review_applied"
  | "draft_review_skipped";

type SafeValue = string | number | boolean | undefined;

export function trackWritingEvent(
  event: WritingAnalyticsEvent,
  props: Record<string, SafeValue> = {}
): void {
  try {
    console.info(
      JSON.stringify({ analytics: "wright", event, ...props, ts: Date.now() })
    );
  } catch {
    // Analytics must never break the product.
  }
}
