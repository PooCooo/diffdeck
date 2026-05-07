import type { Command } from "commander";
import { readFileOrStdin } from "../utils/read";
import { submitReview, type SubmitRequest } from "../utils/platform";
import { resolveProfile, resolveToken } from "../utils/config";

export function registerSubmitCommand(program: Command): void {
    program.command("submit <pr_url> <comments_file>")
    .option("--profile <name>", "Force a specific config profile for auth lookup")
    .description("Submit a comment to a PR/MR")
    .action(async (pr_url: string, comments_file: string, options: { profile?: string }) => {
        try {
            new URL(pr_url);
        } catch {
            console.error(`ERROR: Invalid PR/MR URL: ${pr_url}`);
            process.exit(1);
        }

        const commentsText = await readFileOrStdin(comments_file);

        let commentJson: SubmitRequest;
        try {
            commentJson = JSON.parse(commentsText);
        } catch {
            console.error(`ERROR: Invalid JSON in comments file: ${comments_file}`);
            process.exit(1);
        }

        const VALID_EVENTS = ["APPROVE", "REQUEST_CHANGES", "COMMENT"];
        if (commentJson.event && !VALID_EVENTS.includes(commentJson.event)) {
            console.error(
                `ERROR: Invalid event "${commentJson.event}". Must be one of: ${VALID_EVENTS.join(", ")}`,
            );
            process.exit(1);
        }

        await handleSubmit(pr_url, commentJson, options.profile);
    });
}

async function handleSubmit(rawUrl: string, request: SubmitRequest, explicit?: string): Promise<void> {
    const profile = await resolveProfile(new URL(rawUrl), explicit);
    if (!profile) {
        console.error(
            `Warning: No profile found for ${rawUrl}. Attempting without auth.\n` +
            `To add a profile: diffdeck config set --url ${rawUrl} --auth-token <token>`,
        );
    }

    const token = resolveToken(profile);
    await submitReview(rawUrl, token, request);
}
