import { readFile } from "node:fs/promises";

export async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf-8");
  let result = "";
  for await (const chunk of process.stdin) {
    result += chunk;
  }
  return result;
}

export async function readFileOrStdin(path: string): Promise<string> {
  return path === "-" ? await readStdin() : await readFile(path, "utf-8");
}
