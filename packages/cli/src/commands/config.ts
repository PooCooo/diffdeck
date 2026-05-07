import type { Command } from "commander";
import {
  readConfig,
  upsertProfile,
  getConfigFilePath,
  deleteProfile,
} from "../utils/config.ts";

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Manage auth profiles");

  // ── config set ──────────────────────────────────────────────────────────────
  config
    .command("set")
    .description("Add or update an auth profile")
    .requiredOption("--url <url>", "Base URL of the code platform (e.g. https://github.com)")
    .requiredOption("--auth-token <token>", "Auth token for the platform")
    .option("--profile <name>", "Profile name to create or update")
    .option("--make-default", "Set this profile as the default", false)
    .addHelpText(
      "after",
      `
Examples:
  diffdeck config set --url https://github.com --auth-token ghp_xxx
  diffdeck config set --url https://gitlab.com --auth-token glpat_xxx --profile gl
  diffdeck config set --url https://git.corp.com --auth-token xxx --profile corp --make-default`
    )
    .action(async (options: { url: string; authToken: string; profile?: string; makeDefault: boolean }) => {
      await handleConfigSet(options);
    });

  // ── config get ──────────────────────────────────────────────────────────────
  config
    .command("get")
    .description("Print profile config (token masked)")
    .option("--profile <name>", "Profile name to read (defaults to default profile)")
    .addHelpText(
      "after",
      `
Examples:
  diffdeck config get
  diffdeck config get --profile gl`
    )
    .action(async (options: { profile?: string }) => {
      await handleConfigGet(options);
    });

  // ── config list ─────────────────────────────────────────────────────────────
  config
    .command("list")
    .description("List all configured profiles")
    .addHelpText(
      "after",
      `
Examples:
  diffdeck config list`
    )
    .action(async () => {
      await handleConfigList();
    });

  // ── config delete ───────────────────────────────────────────────────────────
  config
    .command("delete")
    .description("Delete an auth profile")
    .requiredOption("--profile <name>", "Profile name to delete")
    .addHelpText(
      "after",
      `
Examples:
  diffdeck config delete --profile gl`
    )
    .action(async (options: { profile: string }) => {
      await handleConfigDelete(options);
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function handleConfigSet(options: {
  url: string;
  authToken: string;
  profile?: string;
  makeDefault: boolean;
}): Promise<void> {
  let inputUrl: URL;
  try {
    inputUrl = new URL(options.url);
  } catch {
    console.error(`Error: "--url ${options.url}" is not a valid URL`);
    process.exit(1);
  }

  const profileName = options.profile ? options.profile : inputUrl.hostname;
  await upsertProfile(
    profileName,
    { url: options.url, authToken: options.authToken },
    options.makeDefault
  );
  console.error(`Profile "${profileName}" saved to ${getConfigFilePath()}`);
}

async function handleConfigGet(options: { profile?: string }): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(
      "No config file found. Create a profile first:\n" +
        "  diffdeck config set --url <url> --auth-token <token>"
    );
    process.exit(1);
  }

  const name = options.profile ?? config.default;
  const profile = config.profiles[name];
  if (!profile) {
    console.error(
      `Profile "${name}" not found.\n` +
        `Available profiles: ${Object.keys(config.profiles).join(", ") || "(none)"}`
    );
    process.exit(1);
  }

  const masked = maskToken(profile.authToken);
  process.stdout.write(
    JSON.stringify(
      { name, url: profile.url, authToken: masked },
      null,
      2
    ) + "\n"
  );
}

async function handleConfigList(): Promise<void> {
  const config = await readConfig();
  if (!config || Object.keys(config.profiles).length === 0) {
    console.error(
      "No profiles configured. Create one with:\n" +
        "  diffdeck config set --url <url> --auth-token <token>"
    );
    process.exit(1);
  }

  for (const name of Object.keys(config.profiles)) {
    const isDefault = name === config.default;
    process.stdout.write(`${name}${isDefault ? " (default)" : ""}\n`);
  }
}

async function handleConfigDelete(options: { profile: string }): Promise<void> {
  const config = await readConfig();

  if (!config || Object.keys(config.profiles).length === 0) {
    console.error(
      "No profiles configured. Create one with:\n" +
        " diffdeck config set --url <url> --auth-token <token> --profile <name>"
    );
    process.exit(1);
  }

  const profileName = options.profile;
  if (!config.profiles[profileName]) {
    console.error(
      `Profile "${profileName}" not found. Avaliable profiles: ${Object.keys(config.profiles).join(", ") || "(none)"}`
    );
    process.exit(1);
  }

  await deleteProfile(profileName);
  console.error(`Profile "${profileName}" deleted from ${getConfigFilePath()}`);
}

/**
 * Masks a token for display: shows first 4 and last 4 chars.
 * Tokens shorter than 10 chars are fully masked for safety.
 */
function maskToken(token: string): string {
  if (!token) return "(empty)";
  if (token.length < 10) return "***";
  return `${token.slice(0, 4)}*****${token.slice(-4)}`;
}
