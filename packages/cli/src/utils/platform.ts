// ── Types ────────────────────────────────────────────────────────────────────

export type Platform = "github" | "gitlab" | "unknown";

export interface ParsedPrUrl {
  platform: Platform;
  /** Fully-qualified API endpoint for fetching the diff */
  diffEndpoint: string;
  /** Accept header to set on the request, if required */
  acceptHeader?: string;
  /** Additional query params to append */
  diffParams?: Record<string, string>;
}

// ── URL Parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a web PR/MR URL into everything needed to call the platform API.
 *
 * Platform is detected by URL *path shape*, not just hostname, so self-hosted
 * instances work correctly:
 *   GitHub  : /{owner}/{repo}/pull/{n}
 *   GitLab  : /{...}/-/merge_requests/{iid}
 *
 * @param raw        The full PR/MR web URL, e.g. https://github.com/owner/repo/pull/42
 * @param profileUrl Optional base URL from the matched config profile — used to
 *                   derive the GitHub Enterprise API base when the host is not github.com
 */
export function parsePrUrl(raw: string, profileUrl?: string): ParsedPrUrl {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }

  const host = u.hostname;
  const pathname = u.pathname.replace(/\/$/, ""); // strip trailing slash

  // ── GitHub / GitHub Enterprise ───────────────────────────────────────────
  // Path: /{owner}/{repo}/pull/{number}
  const githubMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (githubMatch) {
    const [, owner, repo, num] = githubMatch;
    // GitHub.com uses api.github.com; GitHub Enterprise Server uses /api/v3
    const apiBase =
      host === "github.com"
        ? "https://api.github.com"
        : `${u.protocol}//${host}/api/v3`;

    return {
      platform: "github",
      diffEndpoint: `${apiBase}/repos/${owner}/${repo}/pulls/${num}`,
      acceptHeader: "application/vnd.github.v3.diff",
    };
  }

  // ── GitLab / GitLab self-hosted ──────────────────────────────────────────
  // Path: /{namespace...}/{repo}/-/merge_requests/{iid}
  // Namespace can be multi-level: /group/subgroup/repo/-/merge_requests/42
  const gitlabMatch = pathname.match(/^(\/.*?)\/-\/merge_requests\/(\d+)/);
  if (gitlabMatch) {
    const [, projectPath, iid] = gitlabMatch;
    // URL-encode the project path (remove leading slash first)
    const projectId = encodeURIComponent(projectPath!.replace(/^\//, ""));
    const apiBase = `${u.protocol}//${host}`;

    return {
      platform: "gitlab",
      diffEndpoint: `${apiBase}/api/v4/projects/${projectId}/merge_requests/${iid}/diffs`,
      // view=raw returns plain-text unified diff (GitLab 15+).
      // For older instances this may fall back to JSON; fetchDiff handles both.
      diffParams: { view: "raw" },
    };
  }

  throw new Error(
    `Unrecognized PR/MR URL format for "${raw}".\n` +
      `Expected one of:\n` +
      `  GitHub  : https://github.com/{owner}/{repo}/pull/{number}\n` +
      `  GitLab  : https://gitlab.com/{namespace}/{repo}/-/merge_requests/{iid}\n` +
      `For self-hosted platforms, ensure the URL path follows one of these patterns.`
  );
}

// ── HTTP Fetch ────────────────────────────────────────────────────────────────
export const buildRequest = (parsed: ParsedPrUrl, token: string | null) => {
  const url = new URL(parsed.diffEndpoint)

  const headers: Record<string, string> = {
    "User-Agent": "diffdeck-cli"
  }

  if (parsed.diffParams) {
    for (const [k, v] of Object.entries(parsed.diffParams)) {
      url.searchParams.set(k, v)
    }
  }

  if (token) headers["Authorization"] = `Bearer ${token}`

  if (parsed.acceptHeader) headers["Accept"] = parsed.acceptHeader

  return { url, headers }
}

/**
 * Fetches the raw diff text for a PR/MR.
 *
 * - Sets Authorization: Bearer <token> when token is provided.
 * - Handles platform-specific response shapes (GitHub → raw text,
 *   GitLab → JSON array of file diffs).
 * - Throws with an actionable message on HTTP errors.
 */
export async function fetchDiff(
  parsed: ParsedPrUrl,
  token: string | null
): Promise<string> {
  const { url, headers } = buildRequest(parsed, token)
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers });
  } catch (err: unknown) {
    throw new Error(
      `Network error fetching diff: ${(err as Error).message}\n` +
        `URL: ${url.toString()}`
    );
  }

  if (!res.ok) {
    const hint = httpErrorHint(res.status, parsed.platform);
    throw new Error(
      `HTTP ${res.status} ${res.statusText} from ${parsed.platform} API.\n${hint}`
    );
  }

  return await parseResponse(res, parsed.platform)
}

// ── Response parsers ─────────────────────────────────────────────────────────
/**
 * GitLab /diffs with view=raw returns plain text on newer instances.
 * Older instances may return a JSON array of file-diff objects.
 * We detect which by content-type.
 */

export const parseResponse = async (res: Response, platform: Platform) => {
  if (platform === 'gitlab') {
    return await parseGitLabResponse(res)
  }

  // GitHub: returns raw diff text directly (when Accept: application/vnd.github.v3.diff)
  return await res.text()
}

async function parseGitLabResponse(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/plain") || contentType.includes("text/x-diff")) {
    return res.text();
  }

  // JSON array: [{ diff: "...", new_path: "...", ... }, ...]
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    // If we can't parse JSON, fall back to raw text
    return res.text();
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Unexpected GitLab diff response shape — expected a JSON array of file diffs."
    );
  }

  return (data as Array<{ diff?: string }>)
    .map((f) => f.diff ?? "")
    .filter(Boolean)
    .join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpErrorHint(status: number, platform: Platform): string {
  if (status === 401)
    return (
      "Authentication failed. Check your auth token:\n" +
      "  diffdeck config set --url <platform-url> --auth-token <token>"
    );
  if (status === 403)
    return "Permission denied. The token may lack the required scopes for this repository.";
  if (status === 404)
    return (
      "PR/MR not found. Possible causes:\n" +
      "  - The URL is incorrect\n" +
      "  - The repository is private and the token lacks read access\n" +
      "  - The PR/MR number does not exist"
    );
  if (status === 422)
    return "Unprocessable entity — the PR may be empty or in a state with no diff.";
  if (status === 429)
    return `Rate limited by ${platform}. Wait a moment and try again.`;
  return `Platform: ${platform}`;
}
