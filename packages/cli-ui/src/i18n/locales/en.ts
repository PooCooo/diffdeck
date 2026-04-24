import type { I18nMessages } from '../types'

export const enMessages: I18nMessages = {
  meta: {
    htmlLang: 'en',
    title: 'Diff Deck',
  },
  enums: {
    reviewSide: {
      additions: 'Addition',
      deletions: 'Deletion',
    },
    draftStatus: {
      accepted: 'Accepted',
      rejected: 'Rejected',
      pending: 'Pending',
    },
  },
  review: {
    loading: 'Loading patches...',
    loadErrorTitle: 'Unable to load patches',
    reload: 'Reload',
    emptyStateTitle: 'No patches available',
    emptyStateDescription: 'The backend returned an empty patch list.',
    deckEyebrow: 'Diff Deck',
    pageTitle: 'Patch Review',
    pageDescription:
      'Review patch metadata, inspect diffs, add line comments, then submit one payload to the CLI server.',
    summary: {
      patches: 'Patches',
      comments: 'Comments',
      drafts: 'Drafts',
      resolved: 'Resolved',
    },
    patchQueueTitle: 'Patch Queue',
    patchGroupLabel: ({ index }) => `Group ${index}`,
    draftHints: ({ count }) => `${count} draft hints`,
    commentCount: ({ count }) => `${count} comments`,
    patchBadge: ({ index }) => `Patch #${index}`,
    fileCount: ({ count }) => `${count} file${count === 1 ? '' : 's'}`,
    groupIndex: 'Group Index',
    draftComments: 'Draft Comments',
    agentDraftCommentsTitle: 'Agent Draft Comments',
    agentDraftCommentsHint:
      'Mark each Agent comment as accepted, rejected, or pending.',
    linePositionLabel: ({ sideLabel, line }) => `${sideLabel} line ${line}`,
    decisionActions: {
      accepted: 'Accept',
      rejected: 'Reject',
      pending: 'Pending',
    },
    diffTitle: 'Diff Review',
    diffDescription:
      'Context lines stay neutral, deletions are red, additions are green. Use the comment action on change lines to add review notes.',
    diffLineCount: ({ count }) => `${count} lines`,
    diffParseFallback: 'This patch did not parse into file diffs.',
    fileState: {
      deleted: 'Deleted',
      added: 'Added',
    },
    addComment: 'Comment',
    agentComment: 'Agent Comment',
    humanComment: 'Human Comment',
    remove: 'Remove',
    composerTitle: ({ file, line, sideLabel }) =>
      `Add comment for ${file}:${line} (${sideLabel})`,
    composerPlaceholder: 'Explain the issue, risk, or follow-up for this line...',
    saveComment: 'Save comment',
    cancel: 'Cancel',
    floatingSummaryTitle: 'Review Summary',
    floatingSummaryDescription: ({ commentCount, resolvedCount }) =>
      `${commentCount} human comments, ${resolvedCount} draft decisions updated.`,
    previewPayload: 'Preview JSON',
    previewPayloadTitle: 'Submission Preview',
    previewPayloadDescription:
      'This is the JSON payload that will be sent if you submit now.',
    submittedSuccess: 'Review submitted successfully.',
    submitting: 'Submitting...',
    submitReview: 'Submit Review',
  },
}
