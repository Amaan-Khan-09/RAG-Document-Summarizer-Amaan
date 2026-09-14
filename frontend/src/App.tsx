import { useCallback, useEffect, useState } from 'react'
import { Menu, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Tabs, { type Tab } from './components/Tabs'
import ChatView from './components/ChatView'
import SummarizeView from './components/SummarizeView'
import GradientBackdrop from './components/GradientBackdrop'
import { useTheme } from './hooks/useTheme'
import { useIsMobile } from './hooks/useIsMobile'
import { getDocuments, getHealth } from './lib/api'
import type { DocumentInfo, HealthStatus } from './types'

const HEALTH_POLL_MS = 15_000

function App() {
  const { theme, toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [excludedFilenames, setExcludedFilenames] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const refresh = useCallback(async () => {
    const [healthRes, docsRes] = await Promise.allSettled([getHealth(), getDocuments()])
    if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
    if (docsRes.status === 'fulfilled') setDocuments(docsRes.value)
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

  return (
    <div className="relative flex h-screen overflow-hidden text-zinc-900 dark:text-zinc-100">
      <GradientBackdrop />

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
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
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
                <ChatView hasDocuments={documents.length > 0} includedFilenames={includedFilenames} />
              ) : (
                <SummarizeView documents={documents} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default App
