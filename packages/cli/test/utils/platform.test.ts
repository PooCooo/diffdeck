import { describe, it, expect, beforeEach, vi } from "vitest";
import { parsePrUrl, fetchDiff } from "../../src/utils/platform.ts";

// ── parsePrUrl ────────────────────────────────────────────────────────────────
// parsePrUrl now returns a PlatformClient — we verify it constructs the correct
// endpoint by stubbing fetch and inspecting what URL was actually requested.

describe("parsePrUrl", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  describe("GitHub", () => {
    it("requests the correct github.com API endpoint", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl("https://github.com/owner/repo/pull/42");
      await client.fetchDiff(null);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/pulls/42",
        expect.any(Object)
      );
    });

    it("strips trailing slash from URL before parsing", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl("https://github.com/owner/repo/pull/42/");
      await client.fetchDiff(null);

      const [calledUrl] = fetchMock.mock.calls[0] as [string];
      expect(calledUrl).toContain("/pulls/42");
    });

    it("uses /api/v3 prefix for GitHub Enterprise (non-github.com host)", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl("https://git.company.com/owner/repo/pull/99");
      await client.fetchDiff(null);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://git.company.com/api/v3/repos/owner/repo/pulls/99",
        expect.any(Object)
      );
    });

    it("throws for an invalid PR path", () => {
      expect(() =>
        parsePrUrl("https://github.com/owner/repo/commits/42")
      ).toThrow("Unrecognized PR/MR URL format");
    });
  });

  describe("GitLab", () => {
    it("requests the correct gitlab.com diffs endpoint", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200, headers: { "content-type": "text/plain" } })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl(
        "https://gitlab.com/owner/repo/-/merge_requests/7"
      );
      await client.fetchDiff(null);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://gitlab.com/api/v4/projects/owner%2Frepo/merge_requests/7/diffs?view=raw",
        expect.any(Object)
      );
    });

    it("handles multi-level namespace (subgroup)", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200, headers: { "content-type": "text/plain" } })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl(
        "https://gitlab.com/group/subgroup/repo/-/merge_requests/3"
      );
      await client.fetchDiff(null);

      const [calledUrl] = fetchMock.mock.calls[0] as [string];
      expect(calledUrl).toContain("group%2Fsubgroup%2Frepo/merge_requests/3/diffs");
    });

    it("uses self-hosted GitLab base URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("raw diff", { status: 200, headers: { "content-type": "text/plain" } })
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = parsePrUrl(
        "https://w.src.corp.qihoo.net/sord/www_so_com/-/merge_requests/1027"
      );
      await client.fetchDiff(null);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://w.src.corp.qihoo.net/api/v4/projects/sord%2Fwww_so_com/merge_requests/1027/diffs?view=raw",
        expect.any(Object)
      );
    });

    it("throws for an invalid MR path", () => {
      expect(() =>
        parsePrUrl("https://gitlab.com/owner/repo/-/issues/7")
      ).toThrow("Unrecognized PR/MR URL format");
    });
  });

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

// ── fetchDiff — GitHub ────────────────────────────────────────────────────────

describe("fetchDiff (GitHub)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches diff with correct URL and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("raw diff", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff(
      "https://github.com/foo/bar/pull/1",
      "token-123"
    );

    expect(result).toBe("raw diff");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/foo/bar/pulls/1",
      {
        headers: {
          "User-Agent": "diffdeck-cli",
          Accept: "application/vnd.github.v3.diff",
          Authorization: "Bearer token-123",
        },
      }
    );
  });

  it("omits Authorization header when token is null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("raw diff", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchDiff("https://github.com/foo/bar/pull/1", null);

    const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("throws a network error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    await expect(
      fetchDiff("https://github.com/foo/bar/pull/1", null)
    ).rejects.toThrow("Network error fetching diff");
  });

  it("throws an actionable error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
      )
    );

    await expect(
      fetchDiff("https://github.com/foo/bar/pull/1", null)
    ).rejects.toThrow("HTTP 401 Unauthorized from github API");
  });
});

// ── fetchDiff — GitLab primary path ──────────────────────────────────────────

describe("fetchDiff (GitLab — primary /diffs)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches diff with ?view=raw and correct headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("raw gitlab diff", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff(
      "https://gitlab.com/owner/repo/-/merge_requests/7",
      "token-123"
    );

    expect(result).toBe("raw gitlab diff");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/owner%2Frepo/merge_requests/7/diffs?view=raw",
      {
        headers: {
          "User-Agent": "diffdeck-cli",
          Authorization: "Bearer token-123",
        },
      }
    );
  });

  it("parses JSON array response from /diffs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { diff: "diff --git a/a.ts b/a.ts" },
            { diff: "diff --git a/b.ts b/b.ts" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await fetchDiff(
      "https://gitlab.com/owner/repo/-/merge_requests/7",
      null
    );

    expect(result).toBe(
      "diff --git a/a.ts b/a.ts\ndiff --git a/b.ts b/b.ts"
    );
  });

  it("throws when /diffs JSON body is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ diff: "oops" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    await expect(
      fetchDiff("https://gitlab.com/owner/repo/-/merge_requests/7", null)
    ).rejects.toThrow("Unexpected GitLab /diffs response");
  });
});

// ── fetchDiff — GitLab fallback /changes ──────────────────────────────────────

describe("fetchDiff (GitLab — fallback /changes)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to /changes when /diffs returns 404", async () => {
    const fetchMock = vi
      .fn()
      // first call → /diffs 404
      .mockResolvedValueOnce(new Response("Not Found", { status: 404, statusText: "Not Found" }))
      // second call → /changes 200
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            changes: [
              { diff: "diff --git a/a.ts b/a.ts" },
              { diff: "diff --git a/b.ts b/b.ts" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff(
      "https://gitlab.com/owner/repo/-/merge_requests/7",
      "token-123"
    );

    expect(result).toBe(
      "diff --git a/a.ts b/a.ts\ndiff --git a/b.ts b/b.ts"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("/changes");
  });

  it("falls back to /changes when /diffs returns 422", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Unprocessable", { status: 422, statusText: "Unprocessable Entity" }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ changes: [{ diff: "diff --git a/x.ts b/x.ts" }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff(
      "https://gitlab.com/owner/repo/-/merge_requests/7",
      null
    );

    expect(result).toBe("diff --git a/x.ts b/x.ts");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to /changes when /diffs returns an empty body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("   ", { status: 200, headers: { "content-type": "text/plain" } })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ changes: [{ diff: "diff --git a/y.ts b/y.ts" }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff(
      "https://gitlab.com/owner/repo/-/merge_requests/7",
      null
    );

    expect(result).toBe("diff --git a/y.ts b/y.ts");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when /changes response body is not a JSON object with changes array", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDiff("https://gitlab.com/owner/repo/-/merge_requests/7", null)
    ).rejects.toThrow("Unexpected GitLab /changes response");
  });

  it("throws when /diffs fails with a non-fallback HTTP error (e.g. 401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
      )
    );

    await expect(
      fetchDiff("https://gitlab.com/owner/repo/-/merge_requests/7", null)
    ).rejects.toThrow("HTTP 401 Unauthorized from gitlab API");
  });
});
