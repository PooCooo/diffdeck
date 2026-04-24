import * as React from 'react'

import { cn } from '../../lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-stone-400/70 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
