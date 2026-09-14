import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'rag-summarizer-theme'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (private browsing, etc.) -- fall through to default
  }
  return 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore -- theme still applies for this session, just won't persist
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme }
}
