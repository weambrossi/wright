import { describe, expect, it } from "vitest";
import {
  selectRelevantContext,
  trimManuscriptForModel,
  formatContextForModel,
} from "@/lib/writing/contextRetrieval";
import type { StoryContextItem } from "@/lib/writing/types";

let counter = 0;
function makeItem(overrides: Partial<StoryContextItem>): StoryContextItem {
  counter += 1;
  return {
    id: `ctx-${counter}`,
    documentId: "doc-1",
    category: "plot",
    scope: "story",
    content: "Something happened.",
    characterNames: [],
    source: "author_answer",
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("selectRelevantContext", () => {
  it("returns everything when the canon is small", () => {
    const items = [makeItem({}), makeItem({}), makeItem({})];
    expect(selectRelevantContext(items, { prompt: "write a scene" })).toHaveLength(
      3
    );
  });

  it("excludes superseded items", () => {
    const items = [makeItem({}), makeItem({ status: "superseded" })];
    const result = selectRelevantContext(items, { prompt: "anything" });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
  });

  it("ranks character-name matches above unrelated items when over the limit", () => {
    const elena = makeItem({
      characterNames: ["Elena"],
      content: "Elena wants Marcus to admit he lied.",
    });
    const unrelated = Array.from({ length: 60 }, () =>
      makeItem({ content: "The northern mountains are cold." })
    );
    const result = selectRelevantContext(
      [...unrelated, elena],
      { prompt: "Write the scene where Elena confronts Marcus" },
      10
    );
    expect(result.map((i) => i.id)).toContain(elena.id);
  });

  it("respects the limit", () => {
    const items = Array.from({ length: 80 }, () => makeItem({}));
    expect(
      selectRelevantContext(items, { prompt: "scene" }, 20)
    ).toHaveLength(20);
  });
});

describe("trimManuscriptForModel", () => {
  it("returns the whole text when short", () => {
    const { manuscript, nearby } = trimManuscriptForModel("A short draft.");
    expect(manuscript).toBe("A short draft.");
    expect(nearby).toContain("A short draft.");
  });

  it("trims long manuscripts but keeps the opening and the selection area", () => {
    const opening = "OPENING-CANON ".repeat(200);
    const middle = "filler ".repeat(8000);
    const target = "THE-SELECTED-PASSAGE";
    const text = `${opening}${middle}${target} tail`;
    const { manuscript, nearby } = trimManuscriptForModel(text, target);
    expect(manuscript.length).toBeLessThan(text.length);
    expect(manuscript).toContain("OPENING-CANON");
    expect(manuscript).toContain("[… manuscript trimmed …]");
    expect(nearby).toContain(target);
  });
});

describe("formatContextForModel", () => {
  it("includes ids, category, scope, and characters", () => {
    const item = makeItem({
      id: "ctx-format",
      category: "relationship",
      scope: "story",
      characterNames: ["Elena", "Marcus"],
      content: "They attended school together for five years.",
    });
    const out = formatContextForModel([item]);
    expect(out).toContain("ctx-format");
    expect(out).toContain("relationship");
    expect(out).toContain("Elena, Marcus");
    expect(out).toContain("school together");
  });

  it("handles an empty canon", () => {
    expect(formatContextForModel([])).toContain("no stored story context");
  });
});
