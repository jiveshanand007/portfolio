// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupTestDb, type TestDbContext } from "@/tests/helpers/test-db";
import { documents } from "@/lib/db/schema";

// Embeddings come from Voyage in production; here every chunk gets a fixed vector.
const embedSpy = vi.fn(async (inputs: string[]) => ({
  embeddings: inputs.map(() => Array(1024).fill(0.01)),
  totalTokens: inputs.length * 10,
}));
vi.mock("@/lib/clients/voyage", () => ({
  embed: (inputs: string[]) => embedSpy(inputs),
  voyageCostCents: () => 0,
}));

const { ingestMdxDir } = await import("./source-mdx");

const PROJECT = `---
title: "Algorithms Visualizer"
slug: "algorithm-visualizer"
description: "Shows sorting and graph algorithms step by step."
---

## How it works

A canvas engine I wrote draws each comparison as it happens.
`;

describe("ingestMdxDir with projects", () => {
  let ctx: TestDbContext;
  let root: string;
  let dir: string;

  beforeAll(async () => {
    ctx = await setupTestDb();
    root = await mkdtemp(join(tmpdir(), "ingest-"));
    dir = join(root, "projects");
    await mkdir(dir);
    await writeFile(join(dir, "algorithm-visualizer.mdx"), PROJECT);
    await writeFile(join(dir, "notes.txt"), "not markdown, ignored");
  }, 60_000);

  afterAll(async () => {
    await ctx?.cleanup();
    await rm(root, { recursive: true, force: true });
  });

  it("stores project pages as 'project' sources under their real folder path", async () => {
    const result = await ingestMdxDir(ctx.db, dir, "project");

    expect(result.scanned).toBe(1);
    expect(result.inserted).toBeGreaterThan(0);
    const rows = await ctx.db.select().from(documents);
    expect(rows.length).toBe(result.inserted);
    for (const row of rows) {
      expect(row.sourceType).toBe("project");
      expect(row.filePath).toBe("content/projects/algorithm-visualizer.mdx");
    }
    expect(rows.map((r) => r.content).join("\n")).toContain("canvas engine");
  });

  it("re-running over unchanged content embeds nothing and inserts nothing", async () => {
    embedSpy.mockClear();
    const again = await ingestMdxDir(ctx.db, dir, "project");
    expect(again.inserted).toBe(0);
    expect(again.removed).toBe(0);
    expect(again.skipped).toBeGreaterThan(0);
    expect(embedSpy).not.toHaveBeenCalled();
  });

  it("editing a page replaces its old text instead of keeping both", async () => {
    await writeFile(
      join(dir, "algorithm-visualizer.mdx"),
      PROJECT.replace("canvas engine I wrote", "WebGL renderer I rewrote")
    );
    const result = await ingestMdxDir(ctx.db, dir, "project");
    expect(result.removed).toBeGreaterThan(0);

    const text = (await ctx.db.select().from(documents)).map((r) => r.content).join("\n");
    expect(text).toContain("WebGL renderer");
    expect(text).not.toContain("canvas engine");
  });
});
