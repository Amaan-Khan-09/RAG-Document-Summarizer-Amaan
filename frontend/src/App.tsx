import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Tabs, { type Tab } from './components/Tabs'
import ChatView from './components/ChatView'
import SummarizeView from './components/SummarizeView'
import { getDocuments, getHealth } from './lib/api'
import type { DocumentInfo, HealthStatus } from './types'

const HEALTH_POLL_MS = 15_000

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
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

  return (
    <div className="relative flex h-screen overflow-hidden bg-zinc-950">
      <div className="pointer-events-none absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />

      <Sidebar health={health} documents={documents} onRefresh={refresh} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Tabs active={tab} onChange={setTab} />
        <div className="min-h-0 flex-1">
          {tab === 'chat' ? (
            <ChatView hasDocuments={documents.length > 0} />
          ) : (
            <SummarizeView documents={documents} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
