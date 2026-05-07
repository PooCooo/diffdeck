import type { Command } from "commander";
import { parsePatch, formatIndexedChanges, indexChanges } from "@diffdeck/core";
import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "../utils/write";
import { statSync } from "node:fs";

interface IndexOptions {
  output: string;
}

export function registerIndexCommands(program: Command) {
  program
    .command("index <diff_file>")
    .description("Index changes in a diff file")
    .option("-o, --output <file>", "output file")
    .action(IndexAction);
}

const IndexAction = async (diff_file: string, options: IndexOptions) => {
  const text = await readFile(diff_file, "utf-8");
  const patches = parsePatch(text);
  const changes = indexChanges(patches);
  const output = `${formatIndexedChanges(changes)}\n\nTotal: ${changes.length} change lines\n`;

  if (options.output) {
    const stat = statSync(options.output);
    if (stat.isDirectory()) {
      console.error(`ERROR: ${options.output} is a directory`);
      process.exit(1);
    }

    writeFileAtomic(options.output, output);
    console.error(`Wrote ${options.output} (${changes.length} changes)`);
  } else {
    process.stdout.write(output);
  }

  process.exit(0);
}