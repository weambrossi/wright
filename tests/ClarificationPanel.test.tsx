import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClarificationPanel } from "@/components/writing/ClarificationPanel";
import type { WritingFlow, WritingPanelState } from "@/hooks/useWritingFlow";
import type {
  ClarificationQuestion,
  PendingWritingRequest,
} from "@/lib/writing/types";

const question: ClarificationQuestion = {
  id: "q1",
  question: "How does Naomi feel when she sees Daniel again?",
  whyItMatters: "It defines the tone of the reunion.",
  category: "character_emotion",
  required: true,
  answerType: "single_choice",
  suggestedAnswers: [
    { id: "s1", label: "Relieved, but trying not to show it" },
    { id: "s2", label: "Angry that he returned without warning" },
  ],
  allowCustomAnswer: true,
};

function makeFlow(
  panel: WritingPanelState,
  request?: Partial<PendingWritingRequest>
): WritingFlow {
  return {
    panel,
    request: (request ?? { answers: {} }) as PendingWritingRequest,
    start: vi.fn(),
    submitAnswer: vi.fn(),
    skip: vi.fn(),
    generateWithoutAnswering: vi.fn(),
    moreOptions: vi.fn(),
    leaveUnspecified: vi.fn(),
    resolveConflict: vi.fn(),
    editAnswer: vi.fn(),
    backToReview: vi.fn(),
    generate: vi.fn(),
    regenerate: vi.fn(),
    cancel: vi.fn(),
    insertAnyway: vi.fn(),
    discardResult: vi.fn(),
  } as unknown as WritingFlow;
}

const questionPanel: WritingPanelState = {
  kind: "question",
  question,
  questionNumber: 1,
  remainingEstimate: 1,
  isEdit: false,
  busy: false,
};

describe("ClarificationPanel — question state", () => {
  it("renders in a distinct region above the input, not as a chat bubble", () => {
    render(<ClarificationPanel flow={makeFlow(questionPanel)} />);
    const region = screen.getByRole("region", {
      name: /needs your input before writing/i,
    });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("Help me understand before I write")).toBeVisible();
    expect(
      screen.getByText(/match your intent instead of making assumptions/i)
    ).toBeVisible();
  });

  it("shows exactly one question with its why-it-matters note", () => {
    render(<ClarificationPanel flow={makeFlow(questionPanel)} />);
    expect(
      screen.getByText("How does Naomi feel when she sees Daniel again?")
    ).toBeVisible();
    expect(screen.getByText(/tone of the reunion/i)).toBeVisible();
    expect(screen.getByText("Question 1 of about 2")).toBeVisible();
  });

  it("shows a prominent loading state while the next step is prepared", () => {
    render(<ClarificationPanel flow={makeFlow({ ...questionPanel, busy: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent(/adding context/i);
    // Actions are replaced by the loading indicator while busy.
    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();
  });

  it("submits a suggested answer on click", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Relieved, but trying not to show it" })
    );
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      "Relieved, but trying not to show it",
      "selected_option"
    );
  });

  it("submits a custom answer with the continue button", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.type(
      screen.getByLabelText(/or write your own answer/i),
      "Hopeful and suspicious at the same time"
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      "Hopeful and suspicious at the same time",
      "author"
    );
  });

  it("submits on Enter for keyboard users", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    const box = screen.getByLabelText(/or write your own answer/i);
    await userEvent.type(box, "Numb{Enter}");
    expect(flow.submitAnswer).toHaveBeenCalledWith("q1", "Numb", "author");
  });

  it("supports skip and cancel", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(flow.skip).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(flow.cancel).toHaveBeenCalled();
  });

  it("offers a visible 'Make the best choice for me' option as a temporary assumption", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Make the best choice for me" })
    );
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      expect.stringContaining("temporary assumption"),
      "temporary_ai_assumption"
    );
  });

  it("offers a visible 'Generate without answering' option", async () => {
    const flow = makeFlow(questionPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Generate without answering" })
    );
    expect(flow.generateWithoutAnswering).toHaveBeenCalled();
  });

  it("shows a back button when editing an existing answer", () => {
    const flow = makeFlow({ ...questionPanel, isEdit: true });
    render(<ClarificationPanel flow={flow} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
    expect(screen.getByText("Editing answer")).toBeVisible();
  });

  it("renders errors as alerts", () => {
    const flow = makeFlow({ ...questionPanel, error: "Network hiccup" });
    render(<ClarificationPanel flow={flow} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network hiccup");
  });
});

describe("ClarificationPanel — skip options state", () => {
  const optionsPanel: WritingPanelState = {
    kind: "options",
    question,
    options: [
      { id: "o1", label: "Emotionally numb" },
      { id: "o2", label: "Relieved, but trying not to show it" },
    ],
    busy: false,
  };

  it("offers options rather than silently inventing an answer", () => {
    render(<ClarificationPanel flow={makeFlow(optionsPanel)} />);
    expect(screen.getByText(/won't silently invent the answer/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Emotionally numb" })
    ).toBeVisible();
  });

  it("submits a selected option as canon", async () => {
    const flow = makeFlow(optionsPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Emotionally numb" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use this answer" })
    );
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      "Emotionally numb",
      "selected_option"
    );
  });

  it("labels temporary assumptions when the author chooses one", async () => {
    const flow = makeFlow(optionsPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Emotionally numb" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use as temporary assumption" })
    );
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      expect.stringContaining("temporary assumption"),
      "temporary_ai_assumption"
    );
  });

  it("lets Wright choose freely as a flagged temporary assumption", async () => {
    const flow = makeFlow(optionsPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: "You choose" }));
    expect(flow.submitAnswer).toHaveBeenCalledWith(
      "q1",
      expect.stringContaining("You choose"),
      "temporary_ai_assumption"
    );
  });

  it("lets the author leave the detail unspecified or ask for different options", async () => {
    const flow = makeFlow(optionsPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Leave unspecified" })
    );
    expect(flow.leaveUnspecified).toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Different options" })
    );
    expect(flow.moreOptions).toHaveBeenCalled();
  });
});

describe("ClarificationPanel — contradiction state", () => {
  const conflictPanel: WritingPanelState = {
    kind: "conflict",
    conflicts: [
      {
        id: "c1",
        newStatement: "Elena has never met Marcus before this scene.",
        existingStatement:
          "Elena and Marcus attended school together for five years.",
        existingContextId: "ctx-1",
        existingSource: 'your earlier answer to "How do they know each other?"',
        explanation:
          "Should the previous history be replaced, or is Elena pretending not to know him?",
      },
    ],
    busy: false,
  };

  it("shows both statements, the source, and the explanation", () => {
    render(<ClarificationPanel flow={makeFlow(conflictPanel)} />);
    expect(
      screen.getByText("Elena has never met Marcus before this scene.")
    ).toBeVisible();
    expect(
      screen.getByText("Elena and Marcus attended school together for five years.")
    ).toBeVisible();
    expect(screen.getByText(/your earlier answer to/i)).toBeVisible();
    expect(screen.getByText(/pretending not to know him/i)).toBeVisible();
  });

  it("offers every resolution action", async () => {
    const flow = makeFlow(conflictPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: "Keep existing" }));
    expect(flow.resolveConflict).toHaveBeenCalledWith("c1", "keep_existing");
    await userEvent.click(
      screen.getByRole("button", { name: "Replace with new" })
    );
    expect(flow.resolveConflict).toHaveBeenCalledWith("c1", "replace_with_new");
    await userEvent.click(screen.getByRole("button", { name: "Keep both" }));
    expect(flow.resolveConflict).toHaveBeenCalledWith("c1", "keep_both");
    await userEvent.click(screen.getByRole("button", { name: "Intentional" }));
    expect(flow.resolveConflict).toHaveBeenCalledWith("c1", "mark_intentional");
  });

  it("supports editing the new answer", async () => {
    const flow = makeFlow(conflictPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit answer" }));
    const box = screen.getByLabelText(/edit your answer/i);
    fireEvent.change(box, {
      target: { value: "Elena pretends not to know Marcus." },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Save edited answer" })
    );
    expect(flow.resolveConflict).toHaveBeenCalledWith(
      "c1",
      "edit_new",
      "Elena pretends not to know Marcus."
    );
  });
});

describe("ClarificationPanel — review state", () => {
  const reviewPanel: WritingPanelState = {
    kind: "review",
    questions: [question],
    answers: {
      q1: {
        questionId: "q1",
        answer: "Relieved, but trying not to show it",
        source: "selected_option",
      },
    },
    assumptions: [
      { id: "a1", description: "The reunion happens indoors", importance: "minor" },
    ],
    busy: false,
  };

  it("shows each question, answer, and assumption before generating", () => {
    render(<ClarificationPanel flow={makeFlow(reviewPanel)} />);
    expect(screen.getByText(/review your answers/i)).toBeVisible();
    expect(
      screen.getByText("How does Naomi feel when she sees Daniel again?")
    ).toBeVisible();
    expect(
      screen.getByText("Relieved, but trying not to show it")
    ).toBeVisible();
    expect(screen.getByText(/reunion happens indoors/i)).toBeVisible();
  });

  it("lets the author edit a previous answer", async () => {
    const flow = makeFlow(reviewPanel);
    render(<ClarificationPanel flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: /edit answer to/i }));
    expect(flow.editAnswer).toHaveBeenCalledWith("q1");
  });

  it("labels temporary AI assumptions in the review", () => {
    const panel: WritingPanelState = {
      ...reviewPanel,
      answers: {
        q1: {
          questionId: "q1",
          answer: "Numb",
          source: "temporary_ai_assumption",
        },
      },
    };
    render(<ClarificationPanel flow={makeFlow(panel)} />);
    expect(screen.getByText("AI assumption")).toBeVisible();
  });

  it("only generates when the author approves", async () => {
    const flow = makeFlow(reviewPanel);
    render(<ClarificationPanel flow={flow} />);
    expect(flow.generate).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /looks right — write it/i })
    );
    expect(flow.generate).toHaveBeenCalled();
  });
});

describe("ClarificationPanel — insert review state", () => {
  it("warns when the document changed and never inserts automatically", async () => {
    const flow = makeFlow({
      kind: "insert_review",
      content: "The generated passage.",
      reason: "document_changed",
    });
    render(<ClarificationPanel flow={flow} />);
    expect(screen.getByText(/document changed while we talked/i)).toBeVisible();
    expect(screen.getByText("The generated passage.")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Insert at cursor" })
    );
    expect(flow.insertAnyway).toHaveBeenCalledWith("The generated passage.");
  });
});

describe("ClarificationPanel — idle", () => {
  it("renders nothing when there is no active flow", () => {
    const { container } = render(
      <ClarificationPanel flow={makeFlow({ kind: "idle" })} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
