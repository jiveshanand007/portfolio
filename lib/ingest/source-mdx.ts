import { readFile, readdir } from "node:fs/promises";
import { basename, join, extname } from "node:path";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { chunkMdx } from "./chunk-mdx";
import { upsertDocuments } from "./upsert";
import { embed, voyageCostCents } from "@/lib/clients/voyage";
import { recordSpend } from "@/lib/spend-cap/daily-cap";
import type { TestDb } from "@/tests/helpers/test-db";
import type { db as dbFn } from "@/lib/db/client";
import { documents, type NewDocument } from "@/lib/db/schema";

type AnyDb = TestDb | ReturnType<typeof dbFn>;

export type MdxSourceType = "experience" | "snippet" | "project";

export interface IngestMdxResult {
  scanned: number;
  chunked: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Stale chunks deleted because their page changed or lost that section. */
  removed: number;
  costCents: number;
  ms: number;
}

export async function ingestMdxDir(
  db: AnyDb,
  dir: string,
  sourceType: MdxSourceType
): Promise<IngestMdxResult> {
  const start = Date.now();
  const entries = await readdir(dir, { withFileTypes: true });
  const mdxFiles = entries
    .filter((e) => e.isFile() && (extname(e.name) === ".mdx" || extname(e.name) === ".md"))
    .map((e) => e.name);

  const allChunks: NewDocument[] = [];
  let scanned = 0;
  let chunked = 0;

  for (const file of mdxFiles) {
    scanned++;
    const fullPath = join(dir, file);
    const raw = await readFile(fullPath, "utf-8");
    const chunks = chunkMdx(raw, `content/${basename(dir)}/${file}`);
    chunked += chunks.length;
    for (const chunk of chunks) {
      allChunks.push({
        sourceType,
        sourceProject: (chunk.metadata.source_project as string | undefined) ?? null,
        sourceUrl: null,
        filePath: chunk.metadata.filePath as string,
        title:
          (chunk.metadata.title as string | undefined) ??
          (chunk.metadata.heading as string | undefined) ??
          file,
        content: chunk.content,
        contentHash: chunk.contentHash,
        metadata: chunk.metadata,
        embedding: [],
      });
    }
  }

  const stored = await storeChunks(db, allChunks);
  const removed = await removeStaleChunks(db, sourceType, allChunks);
  return { scanned, chunked, ...stored, removed, ms: Date.now() - start };
}

/**
 * Chunks are keyed by content hash, so editing a page adds the new text without touching the
 * old. Delete what a re-ingested page no longer contains, or search keeps quoting old wording.
 */
async function removeStaleChunks(db: AnyDb, sourceType: MdxSourceType, current: NewDocument[]): Promise<number> {
  const files = [...new Set(current.map((c) => c.filePath).filter((f): f is string => !!f))];
  if (files.length === 0) return 0;
  const keep = current.map((c) => c.contentHash);
  const gone = await db
    .delete(documents)
    .where(
      and(
        eq(documents.sourceType, sourceType),
        inArray(documents.filePath, files),
        notInArray(documents.contentHash, keep)
      )
    )
    .returning({ id: documents.id });
  return gone.length;
}

/** Chunks from one markdown string (a single page rather than a folder). */
export function docsFromMarkdown(
  raw: string,
  filePath: string,
  sourceType: MdxSourceType
): NewDocument[] {
  return chunkMdx(raw, filePath).map((chunk) => ({
    sourceType,
    sourceProject: (chunk.metadata.source_project as string | undefined) ?? null,
    sourceUrl: null,
    filePath,
    title:
      (chunk.metadata.heading as string | undefined) ??
      (chunk.metadata.title as string | undefined) ??
      filePath,
    content: chunk.content,
    contentHash: chunk.contentHash,
    metadata: chunk.metadata,
    embedding: [],
  }));
}

/**
 * Embed only the chunks whose content hash is new, then upsert. Idempotent: a re-run
 * over unchanged content makes no Voyage call and costs nothing.
 */
export async function storeChunks(
  db: AnyDb,
  allChunks: NewDocument[]
): Promise<Omit<IngestMdxResult, "scanned" | "chunked" | "removed" | "ms">> {
  // Pre-filter: skip chunks whose content_hash already exists. Idempotent re-runs cost ~zero.
  let preSkipped = 0;
  let newChunks = allChunks;
  if (allChunks.length > 0) {
    const hashes = allChunks.map((c) => c.contentHash);
    const existingRows = await db
      .select({ contentHash: documents.contentHash })
      .from(documents)
      .where(inArray(documents.contentHash, hashes));
    const existingSet = new Set(existingRows.map((r) => r.contentHash));
    newChunks = allChunks.filter((c) => !existingSet.has(c.contentHash));
    preSkipped = allChunks.length - newChunks.length;
  }

  const BATCH = 8;
  const SLEEP_BETWEEN_BATCHES_MS = 21_000;
  let costCents = 0;
  for (let i = 0; i < newChunks.length; i += BATCH) {
    const batch = newChunks.slice(i, i + BATCH);
    const result = await embed(batch.map((c) => c.content), "voyage-3");
    batch.forEach((c, j) => {
      c.embedding = result.embeddings[j];
    });
    costCents += voyageCostCents(result.totalTokens, "voyage-3");
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(newChunks.length / BATCH);
    const isLast = i + BATCH >= newChunks.length;
    console.log(
      `[ingest:mdx] batch ${batchNum}/${totalBatches} embedded (${result.totalTokens} tokens)${isLast ? "" : ` — sleeping ${SLEEP_BETWEEN_BATCHES_MS / 1000}s for rate limit`}`
    );
    if (!isLast) await new Promise((r) => setTimeout(r, SLEEP_BETWEEN_BATCHES_MS));
  }

  if (costCents > 0) await recordSpend(db, costCents);
  const upsertResult = await upsertDocuments(db, newChunks);

  return {
    inserted: upsertResult.inserted,
    updated: upsertResult.updated,
    skipped: upsertResult.skipped + preSkipped,
    costCents,
  };
}
