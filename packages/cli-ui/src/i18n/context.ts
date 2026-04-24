import { createContext } from 'react'

import type { Locale, I18nKey } from './types'

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: <K extends I18nKey>(key: K, args?: Record<string | number, string | number>) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
