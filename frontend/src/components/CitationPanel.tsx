import { useEffect } from 'react'
import { FileText, X } from 'lucide-react'
import type { Source } from '../types'

export default function CitationPanel({
  source,
  onClose,
}: {
  source: Source | null
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!source) return null

  const matchPercent = Math.round(source.similarity * 100)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-zinc-900/20 backdrop-blur-[1px] dark:bg-black/40"
        onClick={onClose}
      />
      <aside className="animate-slide-in fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {source.filename}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">Retrieved source</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Similarity match
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{ width: `${matchPercent}%` }}
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
          <blockquote className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {source.snippet}
          </blockquote>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
            This is the exact passage the model retrieved and grounded its answer in — not a
            summary of what it used, the actual text.
          </p>
        </div>
      </aside>
    </>
  )
}
