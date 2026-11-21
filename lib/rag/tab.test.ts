import { describe, it, expect } from "vitest";
import { pickCodeChunk } from "./tab";
import type { RetrievedChunk } from "./retrieve";

function chunk(over: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: 1,
    sourceType: "experience",
    sourceProject: null,
    sourceUrl: null,
    filePath: "content/experience/zeta-sde.mdx",
    title: "Idempotent dispute and claim creation",
    content: "I redesigned the dispute and claim creation workflow to be idempotent.",
    metadata: {},
    cosineScore: 1,
    ...over,
  };
}

const visualizerCode = chunk({
  id: 2,
  sourceType: "github",
  sourceProject: "algorithm-visualizer",
  filePath: "src/Algorithm/pathfindingAlgorithms.js",
  title: "pathfindingAlgorithms.js",
  content: "export function dijkstra(grid) { /* ... */ }",
  metadata: { language: "js" },
});

describe("pickCodeChunk", () => {
  it("does not show unrelated project code for a question about employer work", () => {
    const picked = pickCodeChunk([chunk({}), visualizerCode]);
    expect(picked?.kind).toBe("prose");
    expect(picked?.file).toBe("content/experience/zeta-sde.mdx");
    expect(picked?.code).toContain("idempotent");
  });

  it("shows code when the best source is code", () => {
    const picked = pickCodeChunk([visualizerCode, chunk({})]);
    expect(picked).toMatchObject({ kind: "code", language: "js", file: "src/Algorithm/pathfindingAlgorithms.js" });
  });

  it("shows a project's code when the best source is that project's page", () => {
    const projectPage = chunk({
      sourceType: "project",
      filePath: "content/projects/algorithm-visualizer.mdx",
      content: "An interactive visualizer for sorting and graph algorithms.",
    });
    expect(pickCodeChunk([projectPage, visualizerCode])?.kind).toBe("code");
  });

  it("returns nothing when there are no sources", () => {
    expect(pickCodeChunk([])).toBeNull();
  });
});
