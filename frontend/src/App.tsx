import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Tabs, { type Tab } from './components/Tabs'
import ChatView from './components/ChatView'
import SummarizeView from './components/SummarizeView'
import GradientBackdrop from './components/GradientBackdrop'
import EmptyState from './components/EmptyState'
import IntroLoader from './components/IntroLoader'
import Logo from './components/Logo'
import { useTheme } from './hooks/useTheme'
import { useIsMobile } from './hooks/useIsMobile'
import { getDocuments, getHealth } from './lib/api'
import type { DocumentInfo, HealthStatus } from './types'

const HEALTH_POLL_MS = 15_000
const INTRO_KEY = 'rag-summarizer-intro-shown'

function getIntroAlreadyShown() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

function App() {
  const { theme, toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [ready, setReady] = useState(false)
  const [showIntro, setShowIntro] = useState(() => !getIntroAlreadyShown())
  const [excludedFilenames, setExcludedFilenames] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const refresh = useCallback(async () => {
    const [healthRes, docsRes] = await Promise.allSettled([getHealth(), getDocuments()])
    if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
    if (docsRes.status === 'fulfilled') setDocuments(docsRes.value)
    setReady(true)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, HEALTH_POLL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  function toggleDocument(filename: string) {
    setExcludedFilenames((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  const includedFilenames = documents
    .map((d) => d.filename)
    .filter((f) => !excludedFilenames.has(f))

  const hasDocuments = documents.length > 0

  function handleIntroDone() {
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      // ignore -- intro just replays next load, harmless
    }
    setShowIntro(false)
  }

  return (
    <div className="relative flex h-screen overflow-hidden text-zinc-900 dark:text-zinc-100">
      <GradientBackdrop />

      <AnimatePresence>{showIntro && <IntroLoader onDone={handleIntroDone} />}</AnimatePresence>

      <AnimatePresence mode="wait">
        {!ready ? (
          <div key="loading" className="relative z-10 flex h-full w-full items-center justify-center" />
        ) : !hasDocuments ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 h-full w-full"
          >
            <EmptyState health={health} theme={theme} onToggleTheme={toggleTheme} onUploaded={refresh} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 flex h-full w-full"
          >
            <Sidebar
              health={health}
              documents={documents}
              excludedFilenames={excludedFilenames}
              onToggleDocument={toggleDocument}
              onRefresh={refresh}
              theme={theme}
              onToggleTheme={toggleTheme}
              isMobile={isMobile}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            <main className="relative z-10 flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-black/5 px-2 dark:border-white/10 md:hidden">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Logo size="sm" />
                <span className="text-sm font-semibold">RAG Summarizer</span>
              </div>

              <Tabs active={tab} onChange={setTab} />
              <div className="min-h-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="h-full"
                  >
                    {tab === 'chat' ? (
                      <ChatView hasDocuments={hasDocuments} includedFilenames={includedFilenames} />
                    ) : (
                      <SummarizeView documents={documents} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
