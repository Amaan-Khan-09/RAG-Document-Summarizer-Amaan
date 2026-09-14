import { FileText, ArrowUpRight } from 'lucide-react'
import type { Source } from '../types'

export default function SourceCitation({
  source,
  onOpen,
}: {
  source: Source
  onOpen: (source: Source) => void
}) {
  return (
    <button
      onClick={() => onOpen(source)}
      className="group flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="max-w-[14rem] truncate">{source.filename}</span>
      <span className="shrink-0 text-zinc-400 dark:text-zinc-600">
        {Math.round(source.similarity * 100)}%
      </span>
      <ArrowUpRight className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}
