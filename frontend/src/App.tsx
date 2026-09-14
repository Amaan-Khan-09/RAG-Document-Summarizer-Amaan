import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Tabs, { type Tab } from './components/Tabs'
import ChatView from './components/ChatView'
import SummarizeView from './components/SummarizeView'
import { useTheme } from './hooks/useTheme'
import { getDocuments, getHealth } from './lib/api'
import type { DocumentInfo, HealthStatus } from './types'

const HEALTH_POLL_MS = 15_000

function App() {
  const { theme, toggleTheme } = useTheme()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [excludedFilenames, setExcludedFilenames] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('chat')

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
    <div className="relative flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-indigo-400/10 blur-[120px] dark:bg-indigo-600/10" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-violet-400/10 blur-[120px] dark:bg-violet-600/10" />

      <Sidebar
        health={health}
        documents={documents}
        excludedFilenames={excludedFilenames}
        onToggleDocument={toggleDocument}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Tabs active={tab} onChange={setTab} />
        <div className="min-h-0 flex-1">
          {tab === 'chat' ? (
            <ChatView hasDocuments={documents.length > 0} includedFilenames={includedFilenames} />
          ) : (
            <SummarizeView documents={documents} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
