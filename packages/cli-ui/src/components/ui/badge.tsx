import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-stone-300 bg-stone-100 text-stone-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        destructive: 'border-rose-200 bg-rose-50 text-rose-700',
        accent: 'border-amber-200 bg-amber-50 text-amber-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge }
