// ── Types ────────────────────────────────────────────────────────────────────

type Platform = "github" | "gitlab";

// ── Platform Clients ─────────────────────────────────────────────────────────

interface PlatformClient {
  fetchDiff(token: string | null): Promise<string>;
  submitReview(token: string | null, request: SubmitRequest): Promise<void>;
}

type SubmitEvent = "REQUEST_CHANGES" | "APPROVE" | "COMMENT";

export interface SubmitRequest {
    commit_id?: string;
    event?: SubmitEvent;
    body: string;
    comments?: ReviewComment[];
}

interface ReviewComment {
    path: string;
    body: string;
    position ?: number;
    line?: number;
    start_line?: number;
    side?: "LEFT" | "RIGHT";
    start_side?: "LEFT" | "RIGHT";
}

class GitHubClient implements PlatformClient {
  private readonly endpoint: URL;

  constructor(apiBase: URL, owner: string, repo: string, pullNumber: string) {
    const base = apiBase.href.endsWith("/") ? apiBase.href : `${apiBase.href}/`;
    this.endpoint = new URL(`repos/${owner}/${repo}/pulls/${pullNumber}`, base);
  }

  async fetchDiff(token: string | null): Promise<string> {
    const headers: Record<string, string> = {
      "User-Agent": "diffdeck-cli",
      Accept: "application/vnd.github.diff",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(this.endpoint.toString(), { headers });
    } catch (err: unknown) {
      throw new Error(
        `Network error fetching diff: ${(err as Error).message}\nURL: ${this.endpoint}`,
      );
    }

    if (!res.ok) {
      const hint = httpErrorHint(res.status, "github");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from github API.\n${hint}`,
      );
    }

    return res.text();
  }

  async submitReview(token: string | null, request: SubmitRequest): Promise<void> {
    const headers: Record<string, string> = {
      "User-Agent": "diffdeck-cli",
      Accept: "application/vnd.github.diff",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = this.endpoint.toString() + "/reviews";

    let res: Response;
    try {
      res = await fetch(url, { headers, method: "POST", body: JSON.stringify(request) });
    } catch (err: unknown) {
      throw new Error(
        `Network error submitting review: ${(err as Error).message}\nURL: ${url}`,
      );
    }

    if (!res.ok) {
      const hint = httpErrorHint(res.status, "github");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from github API.\n${hint}`,
      );
    }
    
  }
}

class GitLabClient implements PlatformClient {
  private readonly diffsEndpoint: URL;
  private readonly changesEndpoint: URL;

  constructor(apiBase: URL, projectId: string, iid: string) {
    const base = apiBase.href.endsWith("/") ? apiBase.href : `${apiBase.href}/`;
    const mrBase = new URL(
      `api/v4/projects/${projectId}/merge_requests/${iid}/`,
      base,
    );

    this.diffsEndpoint = new URL("diffs", mrBase);
    this.diffsEndpoint.searchParams.set("view", "raw");

    this.changesEndpoint = new URL("changes", mrBase);
  }

  async fetchDiff(token: string | null): Promise<string> {
    const headers: Record<string, string> = { "User-Agent": "diffdeck-cli" };
    if (token) headers["PRIVATE-TOKEN"] = token;

    // Primary: /diffs?view=raw (GitLab 15+)
    let res: Response;
    try {
      res = await fetch(this.diffsEndpoint.toString(), { headers });
    } catch (err: unknown) {
      throw new Error(
        `Network error fetching diff: ${(err as Error).message}\nURL: ${this.diffsEndpoint}`,
      );
    }

    // Fallback: older GitLab instances may return 404 or non-diff responses for /diffs
    if (!res.ok) {
      if (res.status === 404 || res.status === 422) {
        return this.fetchDiffViaChanges(headers);
      }
      const hint = httpErrorHint(res.status, "gitlab");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from gitlab API.\n${hint}`,
      );
    }

    const text = await this.parseDiffsResponse(res);
    // Empty body from /diffs can indicate an unsupported old instance — fall back
    if (!text.trim()) {
      return this.fetchDiffViaChanges(headers);
    }

    return text;
  }

  // TODO: Implement GitLab review submission
  async submitReview(token: string | null, request: SubmitRequest): Promise<void> {
  }

  /** Fallback for GitLab < 15: GET /merge_requests/:iid/changes */
  private async fetchDiffViaChanges(
    headers: Record<string, string>,
  ): Promise<string> {
    let res: Response;
    try {
      res = await fetch(this.changesEndpoint.toString(), { headers });
    } catch (err: unknown) {
      throw new Error(
        `Network error fetching diff (fallback): ${(err as Error).message}\nURL: ${this.changesEndpoint}`,
      );
    }

    if (!res.ok) {
      const hint = httpErrorHint(res.status, "gitlab");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from gitlab API (fallback /changes).\n${hint}`,
      );
    }

    return this.parseChangesResponse(res);
  }

  /** /diffs: plain text on newer instances, JSON array on older ones */
  private async parseDiffsResponse(res: Response): Promise<string> {
    const contentType = res.headers.get("content-type") ?? "";

    if (
      contentType.includes("text/plain") ||
      contentType.includes("text/x-diff")
    ) {
      return res.text();
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return res.text();
    }

    if (!Array.isArray(data)) {
      throw new Error(
        "Unexpected GitLab /diffs response — expected a JSON array of file diffs.",
      );
    }

    return (data as Array<{ diff?: string }>)
      .map((f) => f.diff ?? "")
      .filter(Boolean)
      .join("\n");
  }

  /**
   * /changes returns an MR object with a top-level `changes` array.
   * Each element has a `diff` string field.
   * Reference: https://docs.gitlab.com/api/merge_requests/#retrieve-merge-request-changes
   */
  private async parseChangesResponse(res: Response): Promise<string> {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        "GitLab /changes returned non-JSON response — cannot parse diff."
      );
    }

    type ChangesPayload = { changes?: Array<{ diff?: string }> };
    const payload = data as ChangesPayload;

    if (!Array.isArray(payload?.changes)) {
      throw new Error(
        "Unexpected GitLab /changes response — expected an object with a `changes` array."
      );
    }

    return payload.changes
      .map((f) => f.diff ?? "")
      .filter(Boolean)
      .join("\n");
  }
}

// ── URL Parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a web PR/MR URL and returns the appropriate platform client.
 *
 * Platform is detected by URL *path shape*, not just hostname, so self-hosted
 * instances work correctly:
 *   GitHub  : /{owner}/{repo}/pull/{n}
 *   GitLab  : /{...}/-/merge_requests/{iid}
 *
 * @param raw        The full PR/MR web URL, e.g. https://github.com/owner/repo/pull/42
 * @param profileUrl Optional base URL from the matched config profile — reserved for
 *                   future use (e.g. deriving Enterprise API base overrides).
 */
export function parsePrUrl(raw: string, _profileUrl?: string): PlatformClient {
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
    const apiBase =
      host === "github.com"
        ? new URL("https://api.github.com")
        : new URL(`${u.protocol}//${host}/api/v3/`);

    return new GitHubClient(apiBase, owner!, repo!, num!);
  }

  // ── GitLab / GitLab self-hosted ──────────────────────────────────────────
  // Path: /{namespace...}/{repo}/-/merge_requests/{iid}
  const gitlabMatch = pathname.match(/^(\/.*?)\/-\/merge_requests\/(\d+)/);
  if (gitlabMatch) {
    const [, projectPath, iid] = gitlabMatch;
    const projectId = encodeURIComponent(projectPath!.replace(/^\//, ""));
    const apiBase = new URL(`${u.protocol}//${host}/`);

    return new GitLabClient(apiBase, projectId, iid!);
  }

  throw new Error(
    `Unrecognized PR/MR URL format for "${raw}".\n` +
      `Expected one of:\n` +
      `  GitHub  : https://github.com/{owner}/{repo}/pull/{number}\n` +
      `  GitLab  : https://gitlab.com/{namespace}/{repo}/-/merge_requests/{iid}\n` +
      `For self-hosted platforms, ensure the URL path follows one of these patterns.`,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the raw diff text for a PR/MR.
 *
 * - Automatically detects the platform from the URL path shape.
 * - Sets Authorization: Bearer <token> when token is provided.
 * - Handles platform-specific response shapes and version fallbacks.
 * - Throws with an actionable message on HTTP errors.
 */
export async function fetchDiff(
  raw: string,
  token: string | null,
): Promise<string> {
  const client = parsePrUrl(raw);
  return client.fetchDiff(token);
}


/**
 * Submits a review to a PR/MR.
 */
export async function submitReview(
  raw: string,
  token: string | null,
  request: SubmitRequest,
): Promise<void> {
  const client = parsePrUrl(raw);
  return client.submitReview(token, request);
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
