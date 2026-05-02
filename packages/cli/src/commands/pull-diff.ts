import { writeFile } from "node:fs/promises";
import type { CAC } from "cac";
import { resolveProfile, resolveToken } from "../utils/config.ts";
import { fetchDiff } from "../utils/platform.ts";

interface PullDiffOptions {
  profile?: string;
}

export function registerPullDiffCommands(cli: CAC): void {
  cli
    .command(
      "pull-diff <pr_url> [output]",
      "Fetch PR/MR diff from a code platform"
    )
    .option(
      "--profile <name>",
      "Force a specific config profile for auth lookup"
    )
    .example("  diffdeck pull-diff https://github.com/owner/repo/pull/42")
    .example("  diffdeck pull-diff https://github.com/owner/repo/pull/42 patch.diff")
    .example("  diffdeck pull-diff https://github.com/owner/repo/pull/42 -")
    .example("  diffdeck pull-diff https://gitlab.com/ns/repo/-/merge_requests/7 result.diff")
    .action(
      async (prUrl: string, output: string | undefined, options: PullDiffOptions) => {
        // ── 1. Validate URL ────────────────────────────────────────────────
        let prParsedUrl: URL;
        try {
          prParsedUrl = new URL(prUrl);
        } catch {
          console.error(`Error: Invalid URL "${prUrl}"`);
          process.exit(1);
        }

        // ── 2. Resolve auth profile ────────────────────────────────────────
        const profile = await resolveProfile(prParsedUrl, options.profile);
        const token = resolveToken(profile);

        if (!token) {
          console.error(
            `Warning: No auth token found for "${prParsedUrl.hostname}".\n` +
              `Public repositories may still work; private repositories will fail with 401/404.\n` +
              `To add a token: diffdeck config set --url ${prParsedUrl.origin} --auth-token <token>\n` +
              `--------------------------------`
          );
          // Non-fatal — allow unauthenticated attempt for public repos
        }

        console.error(`Fetching diff from ${prParsedUrl.hostname}…`);

        // ── 3. Fetch diff ──────────────────────────────────────────────────
        let diff: string;
        try {
          diff = await fetchDiff(prUrl, token);
        } catch (err: unknown) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }

        if (!diff.trim()) {
          console.error(
            "Warning: The fetched diff is empty. The PR/MR may have no changes."
          );
        }

        // ── 5. Write output ────────────────────────────────────────────────
        const toStdout = !output || output === "-";

        if (toStdout) {
          process.stdout.write(diff);
        } else {
          try {
            await writeFile(output, diff, "utf8");
            console.error(`Diff written to ${output}`);
          } catch (err: unknown) {
            console.error(
              `Error writing to "${output}": ${(err as Error).message}`
            );
            process.exit(1);
          }
        }
      }
    );
}
