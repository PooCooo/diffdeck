import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ── Schema ──────────────────────────────────────────────────────────────────

export interface ProfileConfig {
  /** Base URL of the platform, e.g. "https://github.com" */
  url: string;
  authToken: string;
}

export interface DiffdeckConfig {
  /** Name of the default profile */
  default: string;
  profiles: Record<string, ProfileConfig>;
}

/** Resolved profile with name injected for diagnostics */
export interface ResolvedProfile extends ProfileConfig {
  name: string;
}

// ── Paths ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".diffdeck");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

// ── Read ────────────────────────────────────────────────────────────────────

/**
 * Reads config from disk.
 * Returns null when the file does not exist yet (first run).
 * Throws on corrupt JSON or unexpected I/O errors.
 */
export async function readConfig(): Promise<DiffdeckConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as DiffdeckConfig;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * Atomically writes config to disk.
 * Creates ~/.diffdeck/ on first use.
 * Uses write-to-tmp + rename for crash safety.
 */
export async function writeConfig(config: DiffdeckConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const tmp = CONFIG_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(config, null, 2) + "\n", "utf8");
  await fs.rename(tmp, CONFIG_FILE);
}

// ── Upsert ──────────────────────────────────────────────────────────────────

export async function upsertProfile(
  name: string,
  profile: ProfileConfig,
  makeDefault = false
): Promise<void> {
  const existing = (await readConfig()) ?? { default: name, profiles: {} };
  existing.profiles[name] = profile;
  if (makeDefault || !existing.default) existing.default = name;
  await writeConfig(existing);
}

// ── Resolve profile for a given PR URL ─────────────────────────────────────

/**
 * Returns the best-matching profile for `prUrl`, or null if none found.
 *
 * Priority:
 *   1. Explicit `--profile` flag value
 *   2. Profile whose `url` host exactly matches the PR host
 *   3. Well-known implicit names: "github" → github.com, "gitlab" → gitlab.com
 *   4. The default profile (last resort)
 *   5. null
 */
export async function resolveProfile(
  prUrl: URL,
  explicit?: string
): Promise<ResolvedProfile | null> {
  const config = await readConfig();
  if (!config) return null;

  // 1. Explicit --profile wins
  if (explicit) {
    const p = config.profiles[explicit];
    return p ? { ...p, name: explicit } : null;
  }

  const prHost = prUrl.hostname;

  // 2. Exact host match among all profiles
  for (const [name, profile] of Object.entries(config.profiles)) {
    try {
      if (new URL(profile.url).hostname === prHost) {
        return { ...profile, name };
      }
    } catch {
      // skip malformed profile URL
    }
  }

  // 3. Well-known implicit profile names
  const wellKnown: Record<string, string> = {
    "github.com": "github",
    "gitlab.com": "gitlab",
  };
  const implicitName = wellKnown[prHost];
  if (implicitName) {
    const p = config.profiles[implicitName];
    if (p) return { ...p, name: implicitName };
  }

  // 4. Fall back to the default profile
  const def = config.profiles[config.default];
  if (def) return { ...def, name: config.default };

  return null;
}

// ── Token resolution ────────────────────────────────────────────────────────

/**
 * Returns the auth token from the resolved profile, falling back to the
 * DIFFDECK_TOKEN environment variable. Returns null if neither is set.
 */
export function resolveToken(profile: ResolvedProfile | null): string | null {
  if (profile?.authToken) return profile.authToken;
  return process.env["DIFFDECK_TOKEN"] ?? null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}
