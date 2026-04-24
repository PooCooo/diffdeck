import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { I18nContext } from './context'
import { enMessages } from './locales/en'
import { zhCNMessages } from './locales/zh-CN'
import { supportedLocales, type I18nMessages, type Locale, type I18nKey } from './types'

const dictionaries: Record<Locale, I18nMessages> = {
  en: enMessages,
  'zh-CN': zhCNMessages,
}

function isSupportedLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale)
}

function resolveInitialLocale(): Locale {
  // url 参数优先级最高
  const params = new URLSearchParams(window.location.search)
  const localeFromQuery = params.get('lang')
  if (isSupportedLocale(localeFromQuery)) {
    return localeFromQuery
  }

  // 浏览器语言
  const browserLocale = navigator.language
  if (isSupportedLocale(browserLocale)) {
    return browserLocale
  }

  if (browserLocale.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en'
}

const get = (obj: I18nMessages, path: I18nKey): string | ((args?: Record<string | number, string | number>) => string) => {
  return path.split('.').reduce<any>((acc, key) => acc?.[key], obj)
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(() => resolveInitialLocale())

  const messages = dictionaries[locale]

  useEffect(() => {
    document.documentElement.lang = messages.meta.htmlLang
    document.title = messages.meta.title

    // TODO: 如果后续需要从服务端注入 locale，这里可以改成和外部配置同步。
  }, [messages])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: <K extends I18nKey>(key: K, args?: Record<string | number, string | number>): string => {
        const result = get(messages, key)

        if (typeof result !== 'string' && typeof result === 'function') {
          return result(args)
        }

        if (!args || Object.keys(args).length === 0) return result
        
        return Object.entries(args).reduce<string>(
          (acc, [placeholder, value]) => acc.replaceAll(`{${placeholder}}`, String(value)),
          result,
        )
      }
    }),
    [locale, messages],
  )

  // react19 最新写法, 不需要.provider
  return <I18nContext value={value}>{children}</I18nContext>
}
