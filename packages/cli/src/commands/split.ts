import { CAC } from "cac";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parsePatch, indexChanges, validateMeta, generateSubPatches, reconstructBase, applyPatch, resolveSplitGroupMeta } from "@diffdeck/core";
import type { SplitMeta, ResolvedSplitGroupMeta } from "@diffdeck/shared";
import { readFileOrStdin } from "../utils/read";

interface SplitOptions {
  output: string;
}

export function registerSplitCommands(cli: CAC) {
  cli.command("split <diff_file> <split_meta_file>")
    .option("-o, --output <file>", "output file")
    .action(SplitAction);
}

const SUB_PATCH_SEPARATOR = "===SUB_PATCH===";

const writeSubs = async (subs: string[], groups: ResolvedSplitGroupMeta[], outDir: string | undefined) => {
  if (outDir) {
    await mkdir(outDir, { recursive: true });
    // 将各段区分好的diff分别写入文件中 
    for(let i = 0; i < subs.length; i++) {
      const outPath = `${outDir}/sub${i + 1}.diff`;
      await writeFile(outPath, subs[i]!);
      const lineCount = subs[i]!.split("\n").length;
      console.error(`  Wrote ${outPath} (${lineCount} lines)`);
    }

    // 将数据写入meta.json中, 供render读取
    const meta = groups.map(group => ({
      index: group.index,
      description: group.description,
      draftComments: group.draftComments,
    }))
    await writeFile(`${outDir}/meta.json`, JSON.stringify(meta, null, 2) + "\n");
    console.error(`  Wrote ${outDir}/meta.json`);
  } else {
    for (let i = 0; i < subs.length; i++) {
      const meta = JSON.stringify(groups[i]!);
      process.stdout.write(`${i > 0 ? "\n" : ""}${SUB_PATCH_SEPARATOR} ${meta}\n`);
      process.stdout.write(subs[i]!);
    }
  }
}

const SplitAction = async (diff_file: string, split_meta_file: string, options: SplitOptions) => {
  if (!diff_file || !split_meta_file) {
    console.error("ERROR: Missing required arguments");
    process.exit(1);
  }

  const diff_text = await readFile(diff_file, "utf-8");
  let meta: SplitMeta;
  const metaRaw = await readFileOrStdin(split_meta_file);
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    console.error(`ERROR: Invalid JSON in split metadata.
The input must be a valid JSON object with this structure:
{
  "groups": [
    { "description": "...", "changes": [0, 1, "2-5"] }
  ]
}

Received: ${metaRaw.slice(0, 200)}${metaRaw.length > 200 ? "..." : ""}`);
    process.exit(1);
  }

  // 验证元数据
  const patches = parsePatch(diff_text);
  const changes = indexChanges(patches);
  const errors = validateMeta(meta, changes.length);

  if (errors.length > 0) {
    console.error(`ERROR: Invalid split metadata (${errors.length} issue${errors.length > 1 ? "s" : ""}):
${errors.map((e) => `  - ${e}`).join("\n")}

Total change indices in this diff: 0-${changes.length - 1} (${changes.length} changes).
Every index must appear in exactly one group. Fix the meta JSON and retry.`);
    process.exit(1);
  }


  console.error(`Split: ${meta.groups.length} groups, ${changes.length} changes`);
  for (let i = 0; i < meta.groups.length; i++) {
    const g = meta.groups[i]!;
    console.error(`  ${i + 1}. ${g.description} (${g.changes.length} items)`);
  }

  // core: 生成 sub-patches
  const subs = generateSubPatches(diff_text, meta);

  // 验证组合正确性
  const base = reconstructBase(patches);
  const expected = applyPatch(base, patches);

  let state = base;
  for (let i = 0; i < subs.length; i++) {
    try {
      state = applyPatch(state, parsePatch(subs[i]!));
    } catch (e: any) {
      console.error(`ERROR: Sub-patch #${i + 1} ("${meta.groups[i]!.description}") failed to apply: ${e.message}

This usually means the changes in group ${i + 1} conflict with earlier groups.
Check that the change indices in this group are correct and don't depend on changes in later groups.`);
      process.exit(1);
    }
  }

  const allFiles = [...new Set([...expected.keys(), ...state.keys()])].sort();
  const mismatches: string[] = [];

  for (const f of allFiles) {
    const exp = expected.get(f) ?? [];
    const act = state.get(f) ?? [];
    if (exp.length !== act.length || !exp.every((l, i) => l === act[i])) {
      mismatches.push(f);
    }
  }

  if (mismatches.length > 0) {
    console.error(`ERROR: Composition mismatch — sub-patches do NOT reproduce the original diff.
${mismatches.length} file(s) differ after applying all sub-patches sequentially:
${mismatches.map((f) => `  - ${f}`).join("\n")}

This is likely a bug in the splitting algorithm. Please report it.`);
    process.exit(1);
  }

  console.error("OK: Verified — sub-patches compose to equal the original diff.");
  const groupMeta = resolveSplitGroupMeta(meta, changes);
  await writeSubs(subs, groupMeta, options.output);

  if (options.output) {
    console.error(`Next: run "diffdeck render ${options.output}" to review these sub-patches.`);
  } else {
    console.error('Next: pipe this output into "diffdeck render -" to launch review.');
  }
}