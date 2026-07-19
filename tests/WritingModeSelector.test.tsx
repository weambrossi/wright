import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WritingModeSelector } from "@/components/writing/WritingModeSelector";

describe("WritingModeSelector", () => {
  it("shows the current mode compactly", () => {
    render(<WritingModeSelector mode="ask_me_first" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /writing mode: ask me first/i })
    ).toBeVisible();
  });

  it("opens a listbox with all three modes and their descriptions", async () => {
    render(<WritingModeSelector mode="ask_me_first" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeVisible();
    expect(screen.getByText("Suggest Options")).toBeVisible();
    expect(screen.getByText("Draft Freely")).toBeVisible();
    expect(screen.getByText(/clarification over assumption/i)).toBeVisible();
  });

  it("selects a mode on click", async () => {
    const onChange = vi.fn();
    render(<WritingModeSelector mode="ask_me_first" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByText("Draft Freely"));
    expect(onChange).toHaveBeenCalledWith("draft_freely");
  });

  it("supports arrow-key navigation and Enter selection", async () => {
    const onChange = vi.fn();
    render(<WritingModeSelector mode="ask_me_first" onChange={onChange} />);
    const trigger = screen.getByRole("button");
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("suggest_options");
  });

  it("closes on Escape without selecting", async () => {
    const onChange = vi.fn();
    render(<WritingModeSelector mode="ask_me_first" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
