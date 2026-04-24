import * as React from 'react'

import { cn } from '../../lib/utils'

function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-stone-300/80 bg-white/95 text-stone-900 shadow-[0_18px_50px_-30px_rgba(68,64,60,0.45)] backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 border-b border-stone-200 px-6 py-5', className)}
      {...props}
    />
  )
}

function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('font-serif text-xl font-semibold tracking-tight text-stone-950', className)}
      {...props}
    />
  )
}

function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-stone-600', className)} {...props} />
  )
}

function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
