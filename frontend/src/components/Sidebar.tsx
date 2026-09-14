import { useState } from 'react'
import { Trash, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import StatusBadge from './StatusBadge'
import UploadDropzone from './UploadDropzone'
import DocumentList from './DocumentList'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'
import { clearAll } from '../lib/api'
import type { Theme } from '../hooks/useTheme'
import type { DocumentInfo, HealthStatus } from '../types'

function SidebarContent({
  health,
  documents,
  excludedFilenames,
  onToggleDocument,
  onRefresh,
  theme,
  onToggleTheme,
  onClose,
  showCloseButton,
}: {
  health: HealthStatus | null
  documents: DocumentInfo[]
  excludedFilenames: Set<string>
  onToggleDocument: (filename: string) => void
  onRefresh: () => void
  theme: Theme
  onToggleTheme: () => void
  onClose?: () => void
  showCloseButton?: boolean
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
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-black/5 px-4 py-4 dark:border-white/10">
        <Logo size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">RAG Summarizer</h1>
          <StatusBadge health={health} />
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        {showCloseButton && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-b border-black/5 px-4 py-4 dark:border-white/10">
        <UploadDropzone onUploaded={onRefresh} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
            Documents {documents.length > 0 && `(${documents.length})`}
          </span>
          {documents.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-400"
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
        <div className="border-t border-black/5 px-4 py-3 text-[10px] text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          {health.total_chunks} chunks indexed across {health.total_documents} document
          {health.total_documents === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
}

export default function Sidebar(props: {
  health: HealthStatus | null
  documents: DocumentInfo[]
  excludedFilenames: Set<string>
  onToggleDocument: (filename: string) => void
  onRefresh: () => void
  theme: Theme
  onToggleTheme: () => void
  isMobile: boolean
  open: boolean
  onClose: () => void
}) {
  const { isMobile, open, onClose, ...rest } = props

  if (!isMobile) {
    return (
      <aside className="glass-panel relative z-10 hidden h-full border-r md:flex">
        <SidebarContent {...rest} />
      </aside>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="glass-panel fixed inset-y-0 left-0 z-50 border-r shadow-2xl md:hidden"
          >
            <SidebarContent {...rest} onClose={onClose} showCloseButton />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
