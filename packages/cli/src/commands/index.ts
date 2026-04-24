import type { CAC } from "cac";
import { parsePatch, formatIndexedChanges, indexChanges } from "@diffdeck/core";
import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";

interface IndexOptions {
  output: string;
}

export function registerIndexCommands(cli: CAC) {
  cli.command("index <diff_file>")
    .option("-o, --output <file>", "output file")
    .action(IndexAction);
}

const IndexAction = async (diff_file: string, options: IndexOptions) => {
  const text = await readFile(diff_file, "utf-8");
  const patches = parsePatch(text);
  const changes = indexChanges(patches);
  const output = `${formatIndexedChanges(changes)}\n\nTotal: ${changes.length} change lines\n`;

  if (options.output) {
    writeFileSync(options.output, output);
    console.error(`Wrote ${options.output} (${changes.length} changes)`);
    return;
  }

  process.stdout.write(output);
}