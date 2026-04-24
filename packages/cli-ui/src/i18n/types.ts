export const supportedLocales = ['en', 'zh-CN'] as const

export type Locale = (typeof supportedLocales)[number]

export type I18nMessages = {
  meta: {
    htmlLang: string
    title: string
  }
  enums: {
    reviewSide: {
      additions: string
      deletions: string
    }
    draftStatus: {
      accepted: string
      rejected: string
      pending: string
    }
  }
  review: {
    loading: string
    loadErrorTitle: string
    reload: string
    emptyStateTitle: string
    emptyStateDescription: string
    deckEyebrow: string
    pageTitle: string
    pageDescription: string
    summary: {
      patches: string
      comments: string
      drafts: string
      resolved: string
    }
    patchQueueTitle: string
    patchGroupLabel: ({ index }: { index: number }) => string
    draftHints: ({ count }: { count: number }) => string
    commentCount: ({ count }: { count: number }) => string
    patchBadge: ({ index }: { index: number }) => string
    fileCount: ({ count }: { count: number }) => string
    groupIndex: string
    draftComments: string
    agentDraftCommentsTitle: string
    agentDraftCommentsHint: string
    linePositionLabel: ({ sideLabel, line }: { sideLabel: string, line: number }) => string
    decisionActions: {
      accepted: string
      rejected: string
      pending: string
    }
    diffTitle: string
    diffDescription: string
    diffLineCount: ({ count }: { count: number }) => string
    diffParseFallback: string
    fileState: {
      deleted: string
      added: string
    }
    addComment: string
    agentComment: string
    humanComment: string
    remove: string
    composerTitle: ({ file, line, sideLabel }: { file: string, line: number, sideLabel: string }) => string
    composerPlaceholder: string
    saveComment: string
    cancel: string
    floatingSummaryTitle: string
    floatingSummaryDescription: ({ commentCount, resolvedCount }: { commentCount: number, resolvedCount: number }) => string
    previewPayload: string
    previewPayloadTitle: string
    previewPayloadDescription: string
    submittedSuccess: string
    submitting: string
    submitReview: string
  }
}

type Join<K, P> = K extends string | number ? P extends string | number ? `${K}.${P}` : never : never

type NestedKeys<T> = T extends object ? {
  [K in keyof T & string]: T[K] extends object ? K | Join<K, NestedKeys<T[K]>> : K
}[keyof T & string] : never

export type I18nKey = NestedKeys<I18nMessages>
