import type { I18nMessages } from '../types'

export const zhCNMessages: I18nMessages = {
  meta: {
    htmlLang: 'zh-CN',
    title: 'Diff Deck',
  },
  enums: {
    reviewSide: {
      additions: '新增',
      deletions: '删除',
    },
    draftStatus: {
      accepted: '已接受',
      rejected: '已拒绝',
      pending: '待处理',
    },
  },
  review: {
    loading: '正在加载 patch…',
    loadErrorTitle: '获取 Patch 数据失败',
    reload: '重新加载',
    emptyStateTitle: '暂无 patch',
    emptyStateDescription: 'backend 返回了空的 patch 列表。',
    deckEyebrow: 'Diff Deck',
    pageTitle: 'Patch Review',
    pageDescription:
      'Review拆分后的各个 patch：浏览 diff，在变更行添加 comment，并统一提交。',
    summary: {
      patches: 'Patch',
      comments: 'Comment',
      drafts: 'Draft',
      resolved: 'Resolved',
    },
    patchQueueTitle: 'Patch Queue',
    patchGroupLabel: ({ index }) => `Group ${index}`,
    draftHints: ({ count }) => `${count} 条 draft comment`,
    commentCount: ({ count }) => `${count} 条 comment`,
    patchBadge: ({ index }) => `Patch #${index}`,
    fileCount: ({ count }) => `${count} 个 file`,
    groupIndex: 'Group 索引',
    draftComments: 'Draft Comment',
    agentDraftCommentsTitle: 'Draft Comments',
    agentDraftCommentsHint:
      '每条 Draft Comment 均可标记为：接受、拒绝或待定。',
    linePositionLabel: ({ sideLabel, line }) => `${sideLabel} line ${line}`,
    decisionActions: {
      accepted: '接受',
      rejected: '拒绝',
      pending: '待定',
    },
    diffTitle: 'Diff Review',
    diffDescription:
      '上下文行保持中性，删除行为红色，新增行为绿色。可以在变更行上点击 comment 按钮添加备注。',
    diffLineCount: ({ count }) => `${count} 行`,
    diffParseFallback: '该 patch 未能解析为 file diff。',
    fileState: {
      deleted: '删除文件',
      added: '新增文件',
    },
    addComment: 'Comment',
    agentComment: 'Draft Comment',
    humanComment: 'Human Comment',
    remove: '移除',
    composerTitle: ({ file, line, sideLabel }) =>
      `为 ${file}:${line}（${sideLabel}）添加 comment`,
    composerPlaceholder: '说明本行的问题、风险或后续跟进…',
    saveComment: '保存',
    cancel: '取消',
    floatingSummaryTitle: 'Review Comments',
    floatingSummaryDescription: ({ commentCount, resolvedCount }) =>
      `可提交 ${commentCount} 条 Human Comment，${resolvedCount} 条 Draft Comment。`,
    previewPayload: '预览',
    previewPayloadTitle: '提交内容预览',
    previewPayloadDescription:
      '这是当前点击提交时会发送出去的 JSON payload。',
    submittedSuccess: '已成功提交。',
    submitting: '提交中…',
    submitReview: '提交',
  },
}
