import { describe, it, expect } from "vitest";
import { convertDraftCommentsToSubmitRequest } from "../../src/commands/render";
import type { ReviewSubmission, SubPatch } from "@diffdeck/shared";

describe("convertDraftCommentsToSubmitRequest", () => {
  const dummySubPatches: SubPatch[] = []; // Currently unused by the conversion logic but required by signature

  it("returns empty comments when submission has no comments", () => {
    const submission: ReviewSubmission = {
      comments: [],
      draftComments: [],
    };

    const result = convertDraftCommentsToSubmitRequest(submission, dummySubPatches);
    expect(result.body).toBe("");
    expect(result.comments).toEqual([]);
  });

  it("maps user-authored comments correctly", () => {
    const submission: ReviewSubmission = {
      comments: [
        {
          sub: 0,
          file: "src/index.ts",
          line: 10,
          side: "additions",
          body: "This looks great!",
          source: "human"
        },
        {
          sub: 1,
          file: "src/utils.ts",
          line: 5,
          side: "deletions",
          body: "Why was this removed?",
          source: "human"
        }
      ],
      draftComments: [],
    };

    const result = convertDraftCommentsToSubmitRequest(submission, dummySubPatches);
    expect(result.comments).toHaveLength(2);
    expect(result.comments?.[0]).toEqual({
      path: "src/index.ts",
      body: "This looks great!",
      line: 10,
      side: "RIGHT"
    });
    expect(result.comments?.[1]).toEqual({
      path: "src/utils.ts",
      body: "Why was this removed?",
      line: 5,
      side: "LEFT"
    });
  });

  it("maps only accepted draft comments correctly", () => {
    const submission: ReviewSubmission = {
      comments: [],
      draftComments: [
        {
          id: "draft-1",
          change: 1,
          status: "accepted",
          sub: 0,
          file: "src/main.ts",
          line: 20,
          side: "additions",
          body: "Agent says: Add type annotation",
          source: "agent"
        },
        {
          id: "draft-2",
          change: 2,
          status: "rejected",
          sub: 0,
          file: "src/main.ts",
          line: 25,
          side: "deletions",
          body: "Agent says: This is wrong",
          source: "agent"
        },
        {
          id: "draft-3",
          change: 3,
          status: "pending",
          sub: 1,
          file: "src/app.ts",
          line: 5,
          side: "additions",
          body: "Agent says: Missing import",
          source: "agent"
        }
      ],
    };

    const result = convertDraftCommentsToSubmitRequest(submission, dummySubPatches);
    expect(result.comments).toHaveLength(1);
    expect(result.comments?.[0]).toEqual({
      path: "src/main.ts",
      body: "Agent says: Add type annotation",
      line: 20,
      side: "RIGHT"
    });
  });

  it("mixes manual comments and accepted draft comments", () => {
    const submission: ReviewSubmission = {
      comments: [
        {
          sub: 0,
          file: "src/manual.ts",
          line: 1,
          side: "additions",
          body: "Manual comment",
          source: "human"
        }
      ],
      draftComments: [
        {
          id: "draft-1",
          change: 1,
          status: "accepted",
          sub: 0,
          file: "src/agent.ts",
          line: 2,
          side: "deletions",
          body: "Agent comment",
          source: "agent"
        }
      ],
    };

    const result = convertDraftCommentsToSubmitRequest(submission, dummySubPatches);
    expect(result.comments).toHaveLength(2);
    expect(result.comments).toEqual([
      {
        path: "src/manual.ts",
        body: "Manual comment",
        line: 1,
        side: "RIGHT"
      },
      {
        path: "src/agent.ts",
        body: "Agent comment",
        line: 2,
        side: "LEFT"
      }
    ]);
  });
});
