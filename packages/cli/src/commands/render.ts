/**
 * Render command: starts a local web server for diff review.
 *
 * Reads sub-patches from stdin or files, serves pre-built static UI,
 * blocks until the user submits review decisions, then outputs them to stdout.
 */

import {
  createServer,
  type ServerResponse,
} from "node:http";
import { resolve, extname } from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import type{
  AgentDraftComment,
  ReviewSubmission,
  SubPatch,
  ReviewResponse,
} from "@diffdeck/shared";
import { CAC } from "cac";
import { readStdin } from "../utils/read";

interface RenderOptions {
  port?: string;
}

const SUB_PATCH_SEPARATOR = "===SUB_PATCH===";

export function registerRenderCommands(cli: CAC) {
  cli
    .command("render <source>")
    .option("-p, --port <port>", "port")
    .action(RenderAction);
}

const RenderAction = async (source: string, options: RenderOptions) => {
  let subPatches: SubPatch[] = [];
  if (source === "-") {
    const input = await readStdin();
    subPatches = parseSubPatchesFromStdin(input, SUB_PATCH_SEPARATOR);
  } else {
    subPatches = await parseSubPatchesFromDir(source);
  }

  if (subPatches.length === 0) {
    console.error("ERRPR: No sub-patches to review");
    process.exit(1);
  }

  console.error(`Loaded ${subPatches.length} sub-patches for review`);
  const port = options.port ? parseInt(options.port, 10) : undefined;
  const submission = await startReviewServer(subPatches, { port });

  // Output submission as JSON to stdout
  process.stdout.write(JSON.stringify(submission, null, 2));
  process.stdout.write("\n");
};

async function findDir(candidates: string[]): Promise<string | null> {
  for (const dir of candidates) {
    try {
      const s = await stat(dir);
      if (s.isDirectory()) return dir;
    } catch {
      // continue
    }
  }
  return null;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function resolveDistDir(): Promise<string> {
  const candidates = [
    resolve(import.meta.dirname, "web"), // for production
    resolve(import.meta.dirname, "../../../cli-ui/dist"), // for development
  ];
  const dir = await findDir(candidates);
  if (!dir) {
    console.error(`ERROR: Web UI not built. Run "npm run build:web" first.`);
    process.exit(1);
  }
  return dir;
}

/**
 * Start the review server. Returns a promise that resolves with the final
 * review submission when the user submits the review.
 */
async function startReviewServer(
  subPatches: SubPatch[],
  opts: { port?: number } = {}
): Promise<ReviewSubmission> {
  const port = opts.port ?? 3847;
  const distDir = await resolveDistDir();

  return new Promise<ReviewSubmission>((resolveComments) => {
    const server = createServer(async (req, res) => {
      const url = req.url ?? "";
      // 获得patch列表
      if (url === "/api/patches" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(subPatches));
        return;
      }

      // 完成修改后的提交请求
   if (url === "/api/submit" && req.method === "POST") {
        req.setEncoding("utf-8");
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        const submission: ReviewSubmission = JSON.parse(body);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true } as ReviewResponse));

        setTimeout(() => {
          server.close(() => resolveComments(submission));
        }, 300);
        return;
      }

      // 静态文件请求
      await serveStatic(distDir, url, res);
      return;
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.error(`Review server running at ${url}`);
      console.error("Waiting for review submissions...");

      // 打开浏览器
      import("node:child_process")
        .then(({ exec }) => {
          const cmd =
            process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "start"
                : "xdg-open";
          exec(`${cmd} ${url}`);
        })
        .catch((err) => {
          console.error(`Failed to open browser: ${err.message}`);
        });
    });
  });
}

async function serveStatic(
  distDir: string,
  url: string,
  res: ServerResponse
): Promise<void> {
  // Strip query string
  const pathname = url.split("?")[0]!;

  let filePath = resolve(distDir,
    pathname === "/" ? "index.html" : `.${pathname}`
  );

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) {
      filePath = resolve(filePath, "index.html");
    }
  } catch (err) {
    // 处理spa路由fallback
    filePath = resolve(distDir, "index.html");
  }
  
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

/**
 * Parse sub-patches from the separator-delimited format.
 *
 * Supports both:
 *   1. Legacy format: first patch raw, then `\n===SUB_PATCH=== description\n`
 *   2. Headered format: every patch starts with `===SUB_PATCH=== <json-meta>\n`
 */
function parseSubPatchesFromStdin(
  input: string,
  separator: string
): SubPatch[] {
  if (input.trimStart().startsWith(separator)) {
    return parseHeaderedSubPatches(input, separator);
  }

  return parseLegacySubPatches(input, separator);
}

function parseHeaderedSubPatches(input: string, separator: string): SubPatch[] {
  const regex = new RegExp(`^${escapeRegex(separator)}(?: (.+))?$`, "gm");
  const matches = [...input.matchAll(regex)];
  const results: SubPatch[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const next = matches[i + 1];
    const metadataRaw = match[1]?.trim();
    const start = match.index! + match[0].length + 1;
    const end = next ? next.index! : input.length;
    const diff = input.slice(start, end).trim();
    if (!diff) continue;

    const metadata = parseSeparatorMetadata(metadataRaw, results.length);
    results.push({
      index: metadata.index ?? results.length,
      description: metadata.description,
      draftComments: metadata.draftComments ?? [],
      diff,
    });
  }

  return results;
}

function parseLegacySubPatches(input: string, separator: string): SubPatch[] {
  // Split on separator lines, capturing the description after the separator
  const separatorRegex = new RegExp(`\n${escapeRegex(separator)}(?: (.+))?\n`);
  const parts = input.split(separatorRegex);

  // parts alternates: [diff0, desc1, diff1, desc2, diff2, ...]
  const results: SubPatch[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const diff = parts[i]!.trim();
    if (!diff) continue;

    // Description comes from the separator before this part (except first)
    const desc = i > 0 ? parts[i - 1] : undefined;
    const fileMatch = diff.match(/^diff --git a\/(.+?) b\//m);
    const description =
      desc?.trim() ??
      (fileMatch
        ? `Changes to ${fileMatch[1]}`
        : `Sub-patch ${results.length + 1}`);

    results.push({
      index: results.length,
      description,
      draftComments: [],
      diff,
    });
  }
  return results;
}

function parseSeparatorMetadata(
  raw: string | undefined,
  fallbackIndex: number
): {
  index?: number;
  description: string;
  draftComments?: AgentDraftComment[];
} {
  if (!raw)
    return {
      index: fallbackIndex,
      description: `Sub-patch ${fallbackIndex + 1}`,
    };
  try {
    const parsed = JSON.parse(raw) as {
      index?: number;
      description?: string;
      draftComments?: AgentDraftComment[];
    };
    return {
      index: parsed.index ?? fallbackIndex,
      description:
        parsed.description?.trim() || `Sub-patch ${fallbackIndex + 1}`,
      draftComments: parsed.draftComments ?? [],
    };
  } catch {
    return { index: fallbackIndex, description: raw.trim(), draftComments: [] };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse sub-patches from files in a directory.
 * Reads meta.json (written by `split -o`) for descriptions when available.
 */
async function parseSubPatchesFromDir(dir: string): Promise<SubPatch[]> {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".diff"))
    .sort((a, b) => {
      // Numeric sort: sub1.diff, sub2.diff, ..., sub10.diff
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0");
      return na - nb || a.localeCompare(b);
    });

  // Try to load descriptions and agent draft comments from meta.json
  let metaRecords: {
    index: number;
    description: string;
    draftComments?: AgentDraftComment[];
  }[] = [];
  try {
    const raw = await readFile(resolve(dir, "meta.json"), "utf-8");
    const meta: {
      index: number;
      description: string;
      draftComments?: AgentDraftComment[];
    }[] = JSON.parse(raw);
    metaRecords = meta.sort((a, b) => a.index - b.index);
  } catch {
    // No meta.json — fall back to generated descriptions
  }

  const patches: SubPatch[] = [];
  for (let i = 0; i < files.length; i++) {
    const diff = await readFile(resolve(dir, files[i]!), "utf-8");
    const meta = metaRecords[i];
    const description =
      meta?.description ??
      diff.match(/^diff --git a\/(.+?) b\//m)?.[1] ??
      `Sub-patch ${i + 1}`;
    patches.push({
      index: i,
      description,
      draftComments: meta?.draftComments ?? [],
      diff: diff.trim(),
    });
  }
  return patches;
}
