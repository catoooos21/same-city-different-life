import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type Lang } from './i18n'

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  /** Arabic text when Arabic is active and present, else English */
  pick: (en: string, ar?: string | null) => string
}
const LangCtx = createContext<Ctx | null>(null)

function initial(): Lang {
  try {
    return localStorage.getItem('lang') === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l)
        try {
          localStorage.setItem('lang', l)
        } catch {
          /* ignore */
        }
      },
      t: (k) => translate(lang, k),
      pick: (e, a) => (lang === 'ar' && a ? a : e),
    }),
    [lang],
  )
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export function useLang(): Ctx {
  const c = useContext(LangCtx)
  if (!c) throw new Error('LangProvider missing')
  return c
}
