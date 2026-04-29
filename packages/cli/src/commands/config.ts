import type { CAC } from "cac";
import {
  readConfig,
  upsertProfile,
  getConfigFilePath,
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

export function registerConfigCommands(cli: CAC): void {
  // ── config set ────────────────────────────────────────────────────────────
  cli
    .command("config set", "Create or update a named auth profile")
    .option("--url <url>", "Base URL of the code platform (e.g. https://github.com)")
    .option("--auth-token <token>", "Auth token for the platform")
    .option("--profile <name>", "Profile name to create/update", { default: "default" })
    .option("--make-default", "Set this profile as the default", { default: false })
    .example("  diffdeck config set --url https://github.com --auth-token ghp_xxx")
    .example("  diffdeck config set --url https://gitlab.com --auth-token glpat_xxx --profile gl")
    .example("  diffdeck config set --url https://git.corp.com --auth-token xxx --profile corp --make-default")
    .action(async (options: ConfigSetOptions) => {
      if (!options.url) {
        console.error("Error: --url is required");
        process.exit(1);
      }
      if (!options.authToken) {
        console.error("Error: --auth-token is required");
        process.exit(1);
      }

      // Validate URL
      try {
        new URL(options.url);
      } catch {
        console.error(`Error: "--url ${options.url}" is not a valid URL`);
        process.exit(1);
      }

      const profileName = options.profile ?? "default";
      await upsertProfile(
        profileName,
        { url: options.url, authToken: options.authToken },
        options.makeDefault
      );
      console.error(
        `Profile "${profileName}" saved to ${getConfigFilePath()}`
      );
    });

  // ── config get ────────────────────────────────────────────────────────────
  cli
    .command("config get", "Show a profile (auth token is masked)")
    .option("--profile <name>", "Profile name (defaults to the default profile)")
    .example("  diffdeck config get")
    .example("  diffdeck config get --profile gl")
    .action(async (options: ConfigGetOptions) => {
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
    });

  // ── config list ───────────────────────────────────────────────────────────
  cli
    .command("config list", "List all configured profiles")
    .example("  diffdeck config list")
    .action(async () => {
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
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Masks a token for display: shows first 4 and last 4 chars.
 * Tokens shorter than 10 chars are fully masked for safety.
 */
function maskToken(token: string): string {
  if (!token) return "(empty)";
  if (token.length < 10) return "***";
  return `${token.slice(0, 4)}*****${token.slice(-4)}`;
}
