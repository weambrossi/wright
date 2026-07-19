import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AskQuestionsToggle,
  NaturalnessSelector,
} from "@/components/writing/NaturalnessSelector";

describe("NaturalnessSelector", () => {
  it("shows the current level compactly and defaults come from the caller", () => {
    render(<NaturalnessSelector level="balanced" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /naturalness: balanced/i })
    ).toBeVisible();
  });

  it("opens a listbox with all four levels", async () => {
    render(<NaturalnessSelector level="balanced" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(screen.getByText("Preserve current style")).toBeVisible();
    expect(screen.getByText("More natural and understated")).toBeVisible();
    expect(screen.getByText("Raw and conversational")).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("selects a level on click", async () => {
    const onChange = vi.fn();
    render(<NaturalnessSelector level="balanced" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByText("More natural and understated"));
    expect(onChange).toHaveBeenCalledWith("natural_understated");
  });

  it("closes on Escape without selecting", async () => {
    const onChange = vi.fn();
    render(<NaturalnessSelector level="balanced" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("AskQuestionsToggle", () => {
  it("renders as an accessible switch reflecting its state", () => {
    render(<AskQuestionsToggle enabled onChange={() => {}} />);
    expect(
      screen.getByRole("switch", { name: /ask questions when more context/i })
    ).toBeChecked();
  });

  it("flips the value on click", async () => {
    const onChange = vi.fn();
    render(<AskQuestionsToggle enabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("enables questions again when off", async () => {
    const onChange = vi.fn();
    render(<AskQuestionsToggle enabled={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
