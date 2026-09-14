import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import UploadDropzone from './UploadDropzone'
import ThemeToggle from './ThemeToggle'
import StatusBadge from './StatusBadge'
import type { Theme } from '../hooks/useTheme'
import type { HealthStatus } from '../types'

export default function EmptyState({
  health,
  theme,
  onToggleTheme,
  onUploaded,
}: {
  health: HealthStatus | null
  theme: Theme
  onToggleTheme: () => void
  onUploaded: () => void
}) {
  return (
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <StatusBadge health={health} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-20 text-center sm:px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25"
        >
          <Sparkles className="h-7 w-7 text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            RAG <span className="gradient-text">Summarizer</span>
          </h1>
          <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Upload a document to start chatting with it, ask grounded questions, and generate
            summaries — answers are cited back to the exact passage they came from.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="w-full max-w-md"
        >
          <UploadDropzone onUploaded={onUploaded} variant="hero" />
        </motion.div>
      </div>
    </div>
  )
}
