import type {
  ReviewSide,
  SubPatch,
  AgentDraftComment,
} from "@diffdeck/shared";
import { parsePatch } from '@diffdeck/core'

import type { LocalComment, ParsedDiffFile, ParsedDiffLine } from '../types/review'

export function getCommentsForLine(
  comments: LocalComment[],
  target?: { file: string; line: number; side: ReviewSide },
) {
  if (!target) {
    return []
  }

  return comments.filter(
    (comment) =>
      comment.file === target.file &&
      comment.line === target.line &&
      comment.side === target.side,
  )
}

export function buildRenderedDiff(patch: SubPatch): ParsedDiffFile[] {
  const filePatches = parsePatch(patch.diff);
  const draftCommentsMap = new Map<string, AgentDraftComment>(patch.draftComments.map(comment => {
    const key = `${comment.file}-${comment.line}-${comment.side}`;
    return [key, comment];
  }));

  return filePatches.map((patch, pIdx) => ({
    key: `${patch.srcFile}-${patch.dstFile}-${pIdx}`,
    srcFile: patch.srcFile,
    dstFile: patch.dstFile,
    isDelete: patch.isDelete,
    isNew: patch.isNew,
    hunks: patch.hunks.map((hunk, hIdx) => {
      const header = `@@ -${hunk.srcStart},${hunk.srcCount} +${hunk.dstStart},${hunk.dstCount} @@`;
      let oldLineNumber = hunk.srcStart;
      let newLineNumber = hunk.dstStart;

      return {
        header,
        lines: hunk.lines.map((line, lIdx) => {
          let row: ParsedDiffLine;
          if (line.type === " ") {
            row = {
              key: `${pIdx}-${hIdx}-${lIdx}`,
              kind: "context",
              content: line.content,
              oldLineNumber,
              newLineNumber,
            };
            oldLineNumber += 1;
            newLineNumber += 1;
            return row;
          } else if (line.type === "-") {
            // TODO: 如果删除的是新文件，则需要使用新的行号
            const draftComment = draftCommentsMap.get(`${patch.srcFile}-${oldLineNumber}-deletions`);
            row = {
              key: `${pIdx}-${hIdx}-${lIdx}`,
              kind: "delete",
              content: line.content,
              oldLineNumber,
              commentTarget: {
                file: patch.srcFile,
                line: oldLineNumber,
                side: "deletions",
              },
              draftComment,
            };
            oldLineNumber += 1;
            return row;
          } else if (line.type === "+") {
            const draftCommentLine = patch.isNew ? newLineNumber + 1 : newLineNumber;
            const draftComment = draftCommentsMap.get(`${patch.dstFile}-${draftCommentLine}-additions`);
            row = {
              key: `${pIdx}-${hIdx}-${lIdx}`,
              kind: "add",
              content: line.content,
              newLineNumber,
              commentTarget: {
                file: patch.dstFile,
                line: newLineNumber,
                side: "additions",
              },
              draftComment,
            };
            newLineNumber += 1;
            return row;
          } else if (line.type === '\\') {
            row = {
              key: `${pIdx}-${hIdx}-${lIdx}`,
              kind: 'meta',
              content: 'No newline at end of file',
            }
            return row;
          }

          row = {
            key: `${pIdx}-${hIdx}-${lIdx}`,
            kind: "meta",
            content: line.content,
          };

          return row;
        }),
      };
    }),
  }));
}
