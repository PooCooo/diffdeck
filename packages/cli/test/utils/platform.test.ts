import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parsePrUrl,
  fetchDiff,
  buildRequest,
  parseResponse,
} from "../../src/utils/platform.ts";

// 测试parsePrUrl ─────────────────────────────────────────────────────────────────────────────
describe("parsePrUrl", () => {
  // ── GitHub ──────────────────────────────────────────────────────────────

  describe("GitHub", () => {
    it("parses a standard github.com PR URL", () => {
      const result = parsePrUrl("https://github.com/owner/repo/pull/42");

      expect(result.platform).toBe("github");
      expect(result.diffEndpoint).toBe(
        "https://api.github.com/repos/owner/repo/pulls/42",
      );
      expect(result.acceptHeader).toBe("application/vnd.github.v3.diff");
    });

    it("handles trailing slash in URL", () => {
      const result = parsePrUrl("https://github.com/owner/repo/pull/42/");

      expect(result.platform).toBe("github");
      expect(result.diffEndpoint).toContain("/pulls/42");
    });

    it("uses /api/v3 prefix for GitHub Enterprise (non-github.com host)", () => {
      const result = parsePrUrl("https://git.company.com/owner/repo/pull/99");

      expect(result.platform).toBe("github");
      expect(result.diffEndpoint).toBe(
        "https://git.company.com/api/v3/repos/owner/repo/pulls/99",
      );
    });

    it("throws for an invalid PR path", () => {
      expect(() =>
        parsePrUrl("https://github.com/owner/repo/commits/42"),
      ).toThrow("Unrecognized PR/MR URL format");
    });
  });

  // ── GitLab ───────────────────────────────────────────────────────────────

  describe("GitLab", () => {
    it("parses a gitlab.com MR URL", () => {
      const result = parsePrUrl(
        "https://gitlab.com/owner/repo/-/merge_requests/7",
      );

      expect(result.platform).toBe("gitlab");
      expect(result.diffEndpoint).toBe(
        "https://gitlab.com/api/v4/projects/owner%2Frepo/merge_requests/7/diffs",
      );
      expect(result.diffParams).toEqual({ view: "raw" });
    });

    it("parses a subgroup MR URL (multi-level namespace)", () => {
      const result = parsePrUrl(
        "https://gitlab.com/group/subgroup/repo/-/merge_requests/3",
      );

      expect(result.platform).toBe("gitlab");
      expect(result.diffEndpoint).toContain(
        "group%2Fsubgroup%2Frepo/merge_requests/3/diffs",
      );
    });

    it("uses self-hosted GitLab base URL", () => {
      const result = parsePrUrl(
        "https://w.src.corp.qihoo.net/sord/www_so_com/-/merge_requests/1027",
      );

      expect(result.platform).toBe("gitlab");
      expect(result.diffParams).toEqual({ view: "raw" });
      expect(result.diffEndpoint).toBe(
        "https://w.src.corp.qihoo.net/api/v4/projects/sord%2Fwww_so_com/merge_requests/1027/diffs",
      );
    });

    it("throws for an invalid MR path", () => {
      expect(() =>
        parsePrUrl("https://gitlab.com/owner/repo/-/issues/7"),
      ).toThrow("Unrecognized PR/MR URL format");
    });
  });

  // ── Errors ──────────────────────────────────────────────────────────────

  describe("invalid input", () => {
    it("throws for a completely invalid URL", () => {
      expect(() => parsePrUrl("not-a-url")).toThrow("Invalid URL");
    });

    it("throws with a helpful message listing expected formats", () => {
      try {
        parsePrUrl("https://example.com/weird/path");
      } catch (err) {
        expect((err as Error).message).toContain("GitHub");
        expect((err as Error).message).toContain("GitLab");
      }
    });
  });
});
// ─────────────────────────────────────────────────────────────────────────────

// 测试 buildRequest ─────────────────────────────────────────────────────────────────────────────
describe("buildRequest", () => {
  it("builds a Github request with Accept and Authorization headers", () => {
    const parsed = {
      platform: "github",
      diffEndpoint: "https://api.github.com/repos/foo/bar/pulls/1",
      acceptHeader: "application/vnd.github.v3.diff",
    } as const;

    const { url, headers } = buildRequest(parsed, "token-123");

    expect(url.toString()).toBe("https://api.github.com/repos/foo/bar/pulls/1");

    expect(headers).toEqual({
      "User-Agent": "diffdeck-cli",
      Accept: "application/vnd.github.v3.diff",
      Authorization: "Bearer token-123",
    });
  });

  it("adds diffParams to query string", () => {
    const parsed = {
      platform: "gitlab",
      diffEndpoint:
        "https://gitlab.com/api/v4/projects/foo/bar/merge_requests/1/diffs",
      diffParams: { view: "raw" },
    } as const;

    const { url, headers } = buildRequest(parsed, "token-123");

    expect(url.toString()).toBe(
      "https://gitlab.com/api/v4/projects/foo/bar/merge_requests/1/diffs?view=raw",
    );
    expect(headers).toEqual({
      "User-Agent": "diffdeck-cli",
      Authorization: "Bearer token-123",
    });
  });

  it("does not add Authorization header when token is null", () => {
    const parsed = {
      platform: "github",
      diffEndpoint: "https://api.github.com/repos/foo/bar/pulls/1",
      acceptHeader: "application/vnd.github.v3.diff",
    } as const;

    const { headers } = buildRequest(parsed, null);

    expect(headers.Authorization).toBeUndefined();
  });
});
// ─────────────────────────────────────────────────────────────────────────────

// 测试 parseResponse ─────────────────────────────────────────────────────────────────────────────
describe("parseResponse", () => {
  it("parses Github response as raw text", async () => {
    const res = new Response("raw github diff", {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
    });

    const result = await parseResponse(res, "github");

    expect(result).toBe("raw github diff");
  });

  it("parses Gitlab JSON file diff array", async () => {
    const res = new Response(
      JSON.stringify([
        { diff: "diff --git a/a.ts b/a.ts" },
        { diff: "diff --git a/b.ts b/b.ts" },
      ]),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const result = await parseResponse(res, "gitlab");

    expect(result).toBe("diff --git a/a.ts b/a.ts\ndiff --git a/b.ts b/b.ts");
  });

  it("throws when Gitlab JSON shape is not an array", async () => {
    const res = new Response(JSON.stringify({ diff: "diff --git a/a.ts b/a.ts" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    await expect(parseResponse(res, "gitlab")).rejects.toThrow("Unexpected GitLab diff response shape — expected a JSON array of file diffs.");
  });
});
// ─────────────────────────────────────────────────────────────────────────────

// 测试 fetchDiff ─────────────────────────────────────────────────────────────────────────────
describe("fetchDiff", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches Github diff with correct url and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("raw diff", {
        status: 200,
        headers: {
          "content-type": "text/plain",
        }
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    const parsed = {
      platform: "github",
      diffEndpoint: "https://api.github.com/repos/foo/bar/pulls/1",
      acceptHeader: "application/vnd.github.v3.diff",
    } as const;
    
    const result = await fetchDiff(parsed, "token-123")

    expect(result).toBe("raw diff")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/foo/bar/pulls/1",
      {
        headers: {
          "User-Agent": "diffdeck-cli",
          Authorization: "Bearer token-123",
          Accept: "application/vnd.github.v3.diff",
        }
      }
    )
  })

  it("fetches Gitlab diff with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("raw gitlab diff", {
        status: 200,
        headers: {
          "content-type": "text/plain"
        }
      })
    )

    vi.stubGlobal('fetch', fetchMock)

    const parsed = {
      platform: "gitlab",
      diffEndpoint: "https://gitlab.com/api/v4/projects/foo/bar/merge_requests/1/diffs",
      diffParams: { view: "raw" },
    } as const;

    const result = await fetchDiff(parsed, "token-123")

    expect(result).toBe("raw gitlab diff")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/foo/bar/merge_requests/1/diffs?view=raw",
      {
        headers: {
          "User-Agent": "diffdeck-cli",
          "Authorization": "Bearer token-123"
        }
      }
    )
  })

  it("throws network error when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"))

    vi.stubGlobal('fetch', fetchMock)

    const parsed = {
      platform: "github",
      diffEndpoint: "https://api.github.com/repos/foo/bar/pulls/1",
    } as const 

    await expect(fetchDiff(parsed, null)).rejects.toThrow("Network error fetching diff")
  })

  it("throws actionable error when response is not ok ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Unauthorized", {
        status: 401,
        statusText: "Unauthorized"
      })
    )

    vi.stubGlobal('fetch', fetchMock)

    const parsed = {
      platform: "github",
      diffEndpoint: "https://api.github.com/repos/foo/bar/pulls/1",
    } as const;

    await expect(fetchDiff(parsed, null)).rejects.toThrow("HTTP 401 Unauthorized from github API")
  })
});
// ─────────────────────────────────────────────────────────────────────────────