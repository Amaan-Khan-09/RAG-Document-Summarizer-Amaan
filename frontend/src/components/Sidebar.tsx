import { useState } from 'react'
import { Sparkles, Trash } from 'lucide-react'
import StatusBadge from './StatusBadge'
import UploadDropzone from './UploadDropzone'
import DocumentList from './DocumentList'
import ThemeToggle from './ThemeToggle'
import { clearAll } from '../lib/api'
import type { Theme } from '../hooks/useTheme'
import type { DocumentInfo, HealthStatus } from '../types'

export default function Sidebar({
  health,
  documents,
  excludedFilenames,
  onToggleDocument,
  onRefresh,
  theme,
  onToggleTheme,
}: {
  health: HealthStatus | null
  documents: DocumentInfo[]
  excludedFilenames: Set<string>
  onToggleDocument: (filename: string) => void
  onRefresh: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const [clearing, setClearing] = useState(false)
  const includedCount = documents.length - excludedFilenames.size

  async function handleClearAll() {
    if (!confirm('Delete all uploaded documents? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearAll()
      onRefresh()
    } finally {
      setClearing(false)
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">RAG Summarizer</h1>
          <StatusBadge health={health} />
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <UploadDropzone onUploaded={onRefresh} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
            Documents {documents.length > 0 && `(${documents.length})`}
          </span>
          {documents.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <Trash className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
        {documents.length > 1 && (
          <div className="mb-1 px-2 text-[10px] text-zinc-400 dark:text-zinc-600">
            {includedCount} of {documents.length} searched — click to toggle
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DocumentList
            documents={documents}
            excludedFilenames={excludedFilenames}
            onToggleDocument={onToggleDocument}
            onChanged={onRefresh}
          />
        </div>
      </div>

      {health && (
        <div className="border-t border-zinc-200 px-4 py-3 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-600">
          {health.total_chunks} chunks indexed across {health.total_documents} document
          {health.total_documents === 1 ? '' : 's'}
        </div>
      )}
    </aside>
  )
}
