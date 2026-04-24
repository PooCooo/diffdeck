import { Check, CircleAlert, X } from 'lucide-react'
import { Button } from '../ui/button'

export function SummaryTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-50">{value}</p>
    </div>
  )
}

export function MetaItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-1 font-medium text-stone-800">{value}</p>
    </div>
  )
}

export function DecisionButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      className={active ? 'border-stone-900 bg-stone-900 text-stone-50 hover:bg-stone-800' : undefined}
      onClick={onClick}
      size="sm"
      type="button"
      variant="secondary"
    >
      {label}
    </Button>
  )
}

export function LineNumberCell({ value }: { value?: number }) {
  return (
    <div className="border-r border-stone-200 px-3 py-2 text-right text-xs text-stone-400">
      {value ?? ''}
    </div>
  )
}

export function SubmitError({ error, onClose }: { error: string, onClose: () => void }) {
  return (
    <div className="flex items-center justify-between relative rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex gap-2.5 items-center">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-rose-200">
          <CircleAlert className="size-3.5" />
        </span>
        <p className="min-w-0 whitespace-pre-wrap break-words leading-6">
          {error}
        </p>
      </div>
      <Button
        aria-label="Close submit error"
        className="size-7 text-rose-200/80 hover:bg-rose-400/10 hover:text-rose-100 p-2"
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

export function SubmitSuccess({ success, onClose }: { success: string, onClose: () => void }) {
  return (
    <div className="flex items-center justify-between relative rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3 text-sm  text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex gap-2.5 items-center">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200">
          <Check className="size-3.5" />
        </span>
        <p className="min-w-0 whitespace-pre-wrap break-words leading-6">
          {success}
        </p>
      </div>
      <Button
        aria-label="Close submit success"
        className="size-7 text-emerald-200/80 hover:bg-emerald-400/10 hover:text-emerald-100 p-2"
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
