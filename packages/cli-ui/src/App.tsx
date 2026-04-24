import { useEffect, useState } from 'react'
import {
  Check,
  ChevronRight,
  Eye,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react'

import type {
  AgentDraftCommentDecision,
  ReviewSide,
  ReviewSubmission,
  SubPatch
} from '@diffdeck/shared'

import {
  DecisionButton,
  LineNumberCell,
  MetaItem,
  SubmitError,
  SubmitSuccess,
  SummaryTile,
} from './components/review/review-primitives'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Textarea } from './components/ui/textarea'
import {
  getCommentsForLine,
  buildRenderedDiff,
} from './lib/review-utils'
import { useI18n } from './i18n/useI18n'
import type { ComposerState, LocalComment } from './types/review'
import { getErrorMessage } from './lib/utils'

function App() {
  const { t } = useI18n()
  const [patches, setPatches] = useState<SubPatch[]>([])
  const [selectedPatchId, setSelectedPatchId] = useState<number | null>(null)
  const [commentsByPatch, setCommentsByPatch] = useState<
    Record<number, LocalComment[]>
  >({})
  const [draftDecisions, setDraftDecisions] = useState<
    Record<string, AgentDraftCommentDecision>
  >({})
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [composerText, setComposerText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // 获取patches数据
  useEffect(() => {
    let cancelled = false

    const loadPatches = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const response = await fetch('/api/patches')
        if (!response.ok) {
          throw new Error(`Failed to load patches (${response.status})`)
        }

        const data = (await response.json()) as SubPatch[]
        if (cancelled) {
          return
        }

        setPatches(data)
        setSelectedPatchId(data[0]?.index ?? null)

        const nextDraftDecisions: Record<string, AgentDraftCommentDecision> = {}
        for (const patch of data) {
          for (const draftComment of patch.draftComments) {
            nextDraftDecisions[draftComment.id] = {
              ...draftComment,
              status: 'pending',
            }
          }
        }

        setDraftDecisions(nextDraftDecisions)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load patches')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPatches()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedPatch =
    patches.find((patch) => patch.index === selectedPatchId) ?? null
  const selectedPatchFiles = selectedPatch ? buildRenderedDiff(selectedPatch) : []
  const selectedComments = selectedPatch
    ? commentsByPatch[selectedPatch.index] ?? []
    : []

  const totalCommentCount = Object.values(commentsByPatch).reduce(
    (count, patchComments) => count + patchComments.length,
    0,
  )
  const totalResolvedDrafts = Object.values(draftDecisions).filter(
    (draft) => draft.status !== 'pending',
  ).length

  const reviewPayload: ReviewSubmission = {
    comments: Object.values(commentsByPatch).flat(),
    draftComments: Object.values(draftDecisions),
  }

  const totalHunkLines = selectedPatchFiles.reduce((count, file) => count + file.hunks.reduce((c, h) => c + h.lines.length, 0), 0)

  const handleDraftDecisionChange = (
    draftId: string,
    status: AgentDraftCommentDecision['status'],
  ) => {
    setDraftDecisions((current) => {
      const draftComment = current[draftId]
      if (!draftComment) {
        return current
      }

      return {
        ...current,
        [draftId]: {
          ...draftComment,
          status,
        },
      }
    })
  }

  const openComposer = (
    patchIndex: number,
    lineKey: string,
    file: string,
    line: number,
    side: ReviewSide,
  ) => {
    setComposer({
      patchIndex,
      lineKey,
      file,
      line,
      side,
    })
    setComposerText('')
  }

  const saveComment = () => {
    if (!composer) {
      return
    }

    const body = composerText.trim()
    if (!body) {
      return
    }

    const newComment: LocalComment = {
      id: `${composer.patchIndex}-${composer.file}-${composer.side}-${composer.line}-${Date.now()}`,
      sub: composer.patchIndex,
      file: composer.file,
      line: composer.line,
      side: composer.side,
      body,
      source: 'human',
    }

    setCommentsByPatch((current) => ({
      ...current,
      [composer.patchIndex]: [...(current[composer.patchIndex] ?? []), newComment],
    }))
    setComposer(null)
    setComposerText('')
  }

  const removeComment = (patchIndex: number, commentId: string) => {
    setCommentsByPatch((current) => ({
      ...current,
      [patchIndex]: (current[patchIndex] ?? []).filter(
        (comment) => comment.id !== commentId,
      ),
    }))
  }

  // 提交review结果
  const submitReview = async () => {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitted(false)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(reviewPayload),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit review (${response.status})`)
      }

      setSubmitted(true)
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Failed to submit review'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-stone-600">
            <LoaderCircle className="size-5 animate-spin" />
            {t('review.loading')}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t('review.loadErrorTitle')}</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              {t('review.reload')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!selectedPatch) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t('review.emptyStateTitle')}</CardTitle>
            <CardDescription>
              {t('review.emptyStateDescription')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row lg:items-start">
        <aside className="review-aside-scrollbar flex flex-col justify-between border-b border-stone-300/80 bg-stone-950 text-stone-100 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[340px] lg:shrink-0 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="top-0 flex flex-col gap-6 bg-stone-950/95 p-6 backdrop-blur">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.32em] text-amber-300/80">
                {t('review.deckEyebrow')}
              </p>
              <h1 className="font-serif text-3xl font-semibold text-stone-50">
                {t('review.pageTitle')}
              </h1>
              <p className="text-sm text-stone-400">
                {t('review.pageDescription')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SummaryTile
                label={t('review.summary.patches')}
                value={String(patches.length)}
              />
              <SummaryTile
                label={t('review.summary.comments')}
                value={String(totalCommentCount)}
              />
              <SummaryTile
                label={t('review.summary.drafts')}
                value={String(Object.keys(draftDecisions).length)}
              />
              <SummaryTile
                label={t('review.summary.resolved')}
                value={String(totalResolvedDrafts)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
                {t('review.patchQueueTitle')}
              </p>
              <div className="space-y-2">
                {patches.map((patch) => {
                  const isSelected = patch.index === selectedPatch.index
                  const patchComments = commentsByPatch[patch.index] ?? []

                  return (
                    <button
                      key={patch.index}
                      className={[
                        'w-full rounded-2xl border p-4 text-left transition-colors',
                        isSelected
                          ? 'border-amber-300 bg-amber-50 text-stone-950'
                          : 'border-stone-800 bg-stone-900/80 text-stone-100 hover:border-stone-700 hover:bg-stone-900',
                      ].join(' ')}
                      onClick={() => {
                        setSelectedPatchId(patch.index)
                        setComposer(null)
                        setComposerText('')
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={isSelected ? 'accent' : 'default'}>
                              #{patch.index}
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                              {t('review.patchGroupLabel', { index: patch.index })}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-6">
                            {patch.description}
                          </p>
                        </div>
                        <ChevronRight
                          className={[
                            'mt-0.5 size-4 shrink-0',
                            isSelected ? 'text-amber-700' : 'text-stone-500',
                          ].join(' ')}
                        />
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
                        <span>{t('review.draftHints', { count: patch.draftComments.length })}</span>
                        <span className="size-1 rounded-full bg-current opacity-50" />
                        <span>{t('review.commentCount', { count: patchComments.length })}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-stone-800/80 bg-stone-950/95 p-4 shadow-[0_-20px_48px_-36px_rgba(251,191,36,0.45)] backdrop-blur lg:sticky lg:bottom-0">
            <Card className="overflow-hidden border-stone-800 bg-stone-900/90 text-stone-50 shadow-[0_22px_70px_-38px_rgba(0,0,0,0.9)]">
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                      {t('review.floatingSummaryTitle')}
                    </p>
                    <p className="text-sm leading-6 text-stone-300">
                      {t('review.floatingSummaryDescription', { commentCount: totalCommentCount, resolvedCount: totalResolvedDrafts })}
                    </p>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
                    <Send className="size-4" />
                  </div>
                </div>

                {submitError ? (
                  <SubmitError error={submitError} onClose={() => setSubmitError(null)} />
                ) : submitted ? (
                  <SubmitSuccess success={t('review.submittedSuccess')} onClose={() => setSubmitted(false)} />
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button
                    className="h-10 w-full border-stone-700 bg-stone-950/70 text-stone-300 hover:bg-stone-800 hover:text-stone-50"
                    onClick={() => setPreviewOpen(true)}
                    type="button"
                    variant="secondary"
                  >
                    <Eye className="size-4" />
                    {t('review.previewPayload')}
                  </Button>
                  <Button
                    className="h-11 w-full bg-amber-300 font-semibold text-stone-950 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.9)] hover:bg-amber-200"
                    disabled={submitting}
                    onClick={submitReview}
                    type="button"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        {t('review.submitting')}
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        {t('review.submitReview')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {previewOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payload-preview-title"
          >
            <Card className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden border-stone-800 bg-stone-950 text-stone-50 shadow-2xl">
              <CardHeader className="flex-row items-start justify-between gap-4 border-stone-800 bg-stone-900/90">
                <div>
                  <CardTitle
                    className="text-stone-50"
                    id="payload-preview-title"
                  >
                    {t('review.previewPayloadTitle')}
                  </CardTitle>
                  <CardDescription className="mt-1 text-stone-400">
                    {t('review.previewPayloadDescription')}
                  </CardDescription>
                </div>
                <Button
                  className="shrink-0 text-stone-300 hover:bg-stone-800 hover:text-stone-50"
                  onClick={() => setPreviewOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 overflow-auto p-0">
                <pre className="min-h-full overflow-auto p-5 font-mono text-xs leading-6 text-stone-200">
                  {JSON.stringify(reviewPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-4 pb-40 sm:px-6 lg:flex-1 lg:px-8 lg:pb-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
            <Card>
              <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{t('review.patchBadge', { index: selectedPatch.index })}</Badge>
                    <Badge>{t('review.fileCount', { count: selectedPatchFiles.length })}</Badge>
                    <Badge>{t('review.commentCount', { count: selectedComments.length })}</Badge>
                  </div>
                  <div>
                    <CardTitle>{selectedPatch.description}</CardTitle>
                  </div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600 sm:grid-cols-2">
                  <MetaItem label={t('review.groupIndex')} value={String(selectedPatch.index)} />
                  <MetaItem label={t('review.draftComments')} value={String(selectedPatch.draftComments.length)} />
                </div>
              </CardHeader>
              {selectedPatch.draftComments.length > 0 ? (
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
                      {t('review.agentDraftCommentsTitle')}
                    </h3>
                    <span className="text-sm text-stone-500">
                      {t('review.agentDraftCommentsHint')}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedPatch.draftComments.map((draftComment: SubPatch['draftComments'][number]) => {
                      const decision = draftDecisions[draftComment.id]

                      return (
                        <div
                          key={draftComment.id}
                          className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                        >
                          <div className='flex flex-col'>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>{draftComment.file}</Badge>
                              <Badge variant="accent">
                                {t('review.linePositionLabel', { sideLabel: draftComment.side === 'additions' ? 'Addition' : 'Deletion', line: draftComment.line })}
                              </Badge>
                              <Badge variant={decision?.status === 'accepted' ? 'success' : decision?.status === 'rejected' ? 'destructive' : 'default'}>
                                {t(`review.decisionActions.${decision?.status ?? 'pending'}`)}
                              </Badge>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                              {draftComment.body}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="gap-3 border-b border-stone-200 bg-stone-50/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{t('review.diffTitle')}</CardTitle>
                    <CardDescription className="mt-1">
                      {t('review.diffDescription')}
                    </CardDescription>
                  </div>
                  <Badge>{t('review.diffLineCount', { count: totalHunkLines })}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {selectedPatchFiles.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-stone-500">
                    {t('review.diffParseFallback')}
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200">
                    {selectedPatchFiles.map((file) => (
                      <section key={file.key} className="bg-white">
                        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                          <Badge>{file.srcFile}</Badge>
                          {file.srcFile !== file.dstFile ? (
                            <>
                              <ChevronRight className="size-4 text-stone-400" />
                              <Badge>{file.dstFile}</Badge>
                            </>
                          ) : null}

                          {file.isDelete ? (
                            <Badge variant="destructive">{t('review.fileState.deleted')}</Badge>
                          ) : file.isNew ? (
                            <Badge variant="success">{t('review.fileState.added')}</Badge>
                          ) : null}
                        </div>

                        {file.hunks.map((hunk) => (
                          <div key={hunk.header} className="border-b border-stone-200 last:border-b-0">
                            <div className="border-b border-stone-200 bg-stone-950 px-4 py-2 font-mono text-xs text-stone-300">
                              {hunk.header}
                            </div>
                            <div className="overflow-x-auto">
                              <div className="min-w-[780px] font-mono text-sm">
                                {hunk.lines.map((line) => {
                                  const commentTarget = line.commentTarget
                                  const draftComment = line.draftComment
                                  const lineComments = getCommentsForLine(
                                    selectedComments,
                                    commentTarget,
                                  )
                                  const isComposerLine =
                                    composer?.patchIndex === selectedPatch.index &&
                                    composer.lineKey === line.key

                                  return (
                                    <div key={line.key} className="border-b border-stone-100 last:border-b-0">
                                      <div
                                        className={[
                                          'group grid grid-cols-[72px_72px_minmax(0,1fr)_96px] items-start gap-0',
                                          line.kind === 'add'
                                            ? 'bg-emerald-50/90'
                                            : line.kind === 'delete'
                                              ? 'bg-rose-50/90'
                                              : line.kind === 'meta'
                                                ? 'bg-stone-100'
                                                : 'bg-white',
                                        ].join(' ')}
                                      >
                                        <LineNumberCell value={line.oldLineNumber} />
                                        <LineNumberCell value={line.newLineNumber} />
                                        <pre className="overflow-x-auto px-4 py-2 whitespace-pre-wrap break-words text-stone-800">
                                          <span className="mr-3 select-none text-stone-400">
                                            {line.kind === 'add'
                                              ? '+'
                                              : line.kind === 'delete'
                                                ? '-'
                                                : line.kind === 'meta'
                                                  ? '\\'
                                                  : ' '}
                                          </span>
                                          {line.content}
                                        </pre>
                                        <div className="flex items-center justify-end px-3 py-2">
                                          {commentTarget ? (
                                            <Button
                                              className="opacity-0 transition-opacity group-hover:opacity-100"
                                              onClick={() =>
                                                openComposer(
                                                  selectedPatch.index,
                                                  line.key,
                                                  commentTarget.file,
                                                  commentTarget.line,
                                                  commentTarget.side,
                                                )
                                              }
                                              size="sm"
                                              type="button"
                                              variant="ghost"
                                            >
                                              <MessageSquarePlus className="size-3.5" />
                                              {t('review.addComment')}
                                            </Button>
                                          ) : null}
                                        </div>
                                      </div>

                                      {draftComment ? (
                                        <div className="space-y-2 border-t border-stone-100 bg-stone-50 px-4 py-3 shadow-sm">
                                          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                                            <div className='flex items-center justify-between gap-3'>
                                              <div className='flex items-center gap-2 text-xs uppercase tracking-[0.22rem] text-stone-500'>
                                                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50/90 px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-indigo-500">
                                                  {t('review.agentComment')}
                                                </span>
                                                <span className="size-1 rounded-full bg-stone-300" />
                                                <span>{draftComment.side}</span>
                                              </div>
                                              <div className='flex items-center gap-2'>
                                                <DecisionButton active={draftDecisions[draftComment.id]?.status === 'accepted'} label={t('review.decisionActions.accepted')} onClick={() => handleDraftDecisionChange(draftComment.id, 'accepted')} />
                                                <DecisionButton active={draftDecisions[draftComment.id]?.status === 'rejected'} label={t('review.decisionActions.rejected')} onClick={() => handleDraftDecisionChange(draftComment.id, 'rejected')} />
                                                <DecisionButton active={draftDecisions[draftComment.id]?.status === 'pending'} label={t('review.decisionActions.pending')} onClick={() => handleDraftDecisionChange(draftComment.id, 'pending')} />
                                              </div>
                                            </div>
                                            <p className="text-sm leading-6 mt-2 text-stone-700">{draftComment.body}</p>
                                          </div>
                                        </div>
                                      ) : null}

                                      {lineComments.length > 0 ? (
                                        <div className="space-y-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                                          {lineComments.map((comment) => (
                                            <div
                                              key={comment.id}
                                              className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                                            >
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-stone-500">
                                                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-emerald-700">
                                                    {t('review.humanComment')}
                                                  </span>
                                                  <span className="size-1 rounded-full bg-stone-300" />
                                                  <span>{comment.side}</span>
                                                </div>
                                                <Button
                                                  onClick={() =>
                                                    removeComment(selectedPatch.index, comment.id)
                                                  }
                                                  size="sm"
                                                  type="button"
                                                  variant="ghost"
                                                >
                                                  {t('review.remove')}
                                                </Button>
                                              </div>
                                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                                                {comment.body}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}

                                      {isComposerLine ? (
                                        <div className="border-t border-amber-200 bg-amber-50 px-4 py-4">
                                          <div className="max-w-3xl space-y-3">
                                            <p className="text-sm font-medium text-amber-900">
                                              {t('review.composerTitle', { file: composer?.file, line: composer?.line, sideLabel: composer?.side })}
                                            </p>
                                            <Textarea
                                              onChange={(event) => setComposerText(event.target.value)}
                                              placeholder={t('review.composerPlaceholder')}
                                              value={composerText}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                              <Button
                                                disabled={!composerText.trim()}
                                                onClick={saveComment}
                                                type="button"
                                              >
                                                <Check className="size-4" />
                                                {t('review.saveComment')}
                                              </Button>
                                              <Button
                                                onClick={() => {
                                                  setComposer(null)
                                                  setComposerText('')
                                                }}
                                                type="button"
                                                variant="secondary"
                                              >
                                                {t('review.cancel')}
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
