import type { CAC } from "cac";
import {
  readConfig,
  upsertProfile,
  getConfigFilePath,
  deleteProfile,
} from "../utils/config.ts";

interface ConfigSetOptions {
  url: string;
  authToken: string;
  profile: string;
  makeDefault: boolean;
}

interface ConfigGetOptions {
  profile?: string;
}
interface ConfigDeleteOptions {
  profile?: string;
}

type ConfigCommandOptions = ConfigSetOptions & ConfigGetOptions & ConfigDeleteOptions;

export function registerConfigCommands(cli: CAC): void {
  cli
    .command("config <action>", "Manage auth profiles")
    .usage("config <action> [options]")
    .option("--url <url>", "Base URL of the code platform (e.g. https://github.com)")
    .option("--auth-token <token>", "Auth token for the platform")
    .option("--profile <name>", "Profile name to create, read, or delete")
    .option("--make-default", "Set this profile as the default", { default: false })
    .example("  diffdeck config set --url https://github.com --auth-token ghp_xxx")
    .example("  diffdeck config get")
    .example("  diffdeck config get --profile gl")
    .example("  diffdeck config list")
    .example("  diffdeck config delete --profile gl")
    .example("  diffdeck config set --url https://gitlab.com --auth-token glpat_xxx --profile gl")
    .example("  diffdeck config set --url https://git.corp.com --auth-token xxx --profile corp --make-default")
    .action(async (action: string, options: ConfigCommandOptions) => {
      switch (action) {
        case "set":
          await handleConfigSet(options);
          return;
        case "get":
          await handleConfigGet(options);
          return;
        case "list":
          await handleConfigList();
          return;
        case "delete":
          await handleConfigDelete(options);
          return;
        default:
          console.error(
            `Unknown config action "${action}". Expected one of: set, get, list, delete`
          );
          process.exit(1);
      }
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function handleConfigSet(options: ConfigSetOptions): Promise<void> {
  if (!options.url) {
    console.error("Error: --url is required");
    process.exit(1);
  }
  if (!options.authToken) {
    console.error("Error: --auth-token is required");
    process.exit(1);
  }

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

async function handleConfigGet(options: ConfigGetOptions): Promise<void> {
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

async function handleConfigDelete(options: ConfigDeleteOptions): Promise<void> {
  const config = await readConfig();

  if (!config || Object.keys(config.profiles).length === 0) {
    console.error(
      "No profiles configured. Create one with:\n" +
        " diffdeck config set --url <url> --auth-token <token> --profile <name>"
    );
    process.exit(1);
  }

  if (!options.profile) {
    console.error(
      "Error: --profile is required. Example:\n" +
        " diffdeck config delete --profile gl"
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
