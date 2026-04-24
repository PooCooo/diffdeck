import type { AgentDraftComment, ReviewComment, ReviewSide } from '@diffdeck/shared'

export type ParsedDiffFile = {
  key: string
  srcFile: string
  dstFile: string
  isNew: boolean
  isDelete: boolean
  hunks: ParsedHunk[]
}

export type ParsedHunk = {
  header: string
  lines: ParsedDiffLine[]
}

export type ParsedDiffLine = {
  key: string
  kind: 'context' | 'delete' | 'add' | 'meta'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
  commentTarget?: {
    file: string
    line: number
    side: ReviewSide
  }
  draftComment?: AgentDraftComment
}

export type LocalComment = ReviewComment & { id: string }

export type ComposerState = {
  patchIndex: number
  lineKey: string
  file: string
  line: number
  side: ReviewSide
}
