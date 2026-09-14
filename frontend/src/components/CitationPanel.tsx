import { useEffect } from 'react'
import { FileText, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Source } from '../types'

export default function CitationPanel({
  source,
  onClose,
}: {
  source: Source | null
  onClose: () => void
}) {
  const isMobile = useIsMobile()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const matchPercent = source ? Math.round(source.similarity * 100) : 0

  return (
    <AnimatePresence>
      {source && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className={
              isMobile
                ? 'glass-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t shadow-2xl'
                : 'glass-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl'
            }
          >
            {isMobile && (
              <div className="flex justify-center pt-2.5">
                <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-fuchsia-500/15">
                  <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {source?.filename}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500">Retrieved source</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-black/5 px-5 py-3 dark:border-white/10">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Similarity match
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${matchPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                />
              </div>
              <span className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {matchPercent}%
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Retrieved chunk
              </div>
              <blockquote className="mt-2 whitespace-pre-wrap rounded-xl border border-black/5 bg-black/[0.03] p-4 text-sm leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                {source?.snippet}
              </blockquote>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                This is the exact passage the model retrieved and grounded its answer in — not a
                summary of what it used, the actual text.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
