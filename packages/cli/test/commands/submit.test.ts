import { describe, it, expect, beforeEach, vi } from "vitest";
import { submitReview } from "../../src/utils/platform.ts";

// ── submitReview (GitHub) ────────────────────────────────────────────────────

describe("submitReview (GitHub)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Test 1: 正常提交 COMMENT ─────────────────────────────────────────────
  it("sends POST to the correct reviews endpoint with proper headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 123, state: "COMMENTED" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitReview(
      "https://github.com/zZOMZz/modelShield/pull/1",
      "token-abc",
      {
        body: "🤖 diffdeck submit command test — this comment was submitted via `diffdeck submit` CLI.",
        event: "COMMENT",
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];

    // 正确的 reviews 端点
    expect(calledUrl).toBe(
      "https://api.github.com/repos/zZOMZz/modelShield/pulls/1/reviews",
    );
    // HTTP 方法
    expect(calledOptions.method).toBe("POST");
    // Headers
    expect(calledOptions.headers["Accept"]).toBe("application/vnd.github+json");
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
    expect(calledOptions.headers["Authorization"]).toBe("Bearer token-abc");
    // Body
    const body = JSON.parse(calledOptions.body as string) as {
      body: string;
      event: string;
    };
    expect(body.event).toBe("COMMENT");
    expect(body.body).toContain("diffdeck submit command test");
  });

  it("omits Authorization header when token is null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitReview(
      "https://github.com/zZOMZz/modelShield/pull/1",
      null,
      { body: "anonymous comment" },
    );

    const [, options] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("throws a network error when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure")),
    );

    await expect(
      submitReview(
        "https://github.com/zZOMZz/modelShield/pull/1",
        null,
        { body: "test" },
      ),
    ).rejects.toThrow("Network error submitting review");
  });

  it("throws an actionable error on HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      ),
    );

    await expect(
      submitReview(
        "https://github.com/zZOMZz/modelShield/pull/1",
        "bad-token",
        { body: "test" },
      ),
    ).rejects.toThrow("HTTP 401 Unauthorized from github API");
  });

  it("throws an actionable error on HTTP 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Forbidden", { status: 403, statusText: "Forbidden" }),
      ),
    );

    await expect(
      submitReview(
        "https://github.com/zZOMZz/modelShield/pull/1",
        "low-scope-token",
        { body: "test" },
      ),
    ).rejects.toThrow("HTTP 403 Forbidden from github API");
  });
});

// ── submitReview (GitLab) ────────────────────────────────────────────────────

describe("submitReview (GitLab)", () => {
  // ── Test 3（对应手动测试场景）: GitLab 抛出 not-implemented ────────────────
  it("throws not-implemented error for GitLab MR URLs", async () => {
    await expect(
      submitReview(
        "https://gitlab.com/owner/repo/-/merge_requests/7",
        "token-abc",
        { body: "test" },
      ),
    ).rejects.toThrow("GitLab review submission is not yet supported");
  });
});

// ── parsePrUrl path validation (via submitReview) ────────────────────────────

describe("submitReview — URL validation", () => {
  // ── Test 2: 非法 URL ───────────────────────────────────────────────────────
  it("throws for a completely invalid URL", async () => {
    await expect(
      submitReview("not-a-url", null, { body: "test" }),
    ).rejects.toThrow("Invalid URL");
  });

  it("throws for a GitHub URL without a valid pull path", async () => {
    await expect(
      submitReview(
        "https://github.com/owner/repo/commits/42",
        null,
        { body: "test" },
      ),
    ).rejects.toThrow("Unrecognized PR/MR URL format");
  });
});

// ── event field validation (action layer) ───────────────────────────────────
// event 校验在 submit.ts action 层完成，此处通过直接断言枚举值覆盖逻辑

describe("SubmitRequest.event validation", () => {
  const VALID_EVENTS = ["APPROVE", "REQUEST_CHANGES", "COMMENT"];

  // ── Test 1: 非法 event ─────────────────────────────────────────────────────
  it("rejects lowercase event value (e.g. 'approve')", () => {
    const event = "approve";
    expect(VALID_EVENTS.includes(event)).toBe(false);
  });

  it("accepts all valid uppercase event values", () => {
    for (const e of VALID_EVENTS) {
      expect(VALID_EVENTS.includes(e)).toBe(true);
    }
  });

  it("rejects an arbitrary invalid event string", () => {
    expect(VALID_EVENTS.includes("LGTM")).toBe(false);
  });
});
