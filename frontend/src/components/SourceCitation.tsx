import { FileText, ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Source } from '../types'

export default function SourceCitation({
  source,
  onOpen,
}: {
  source: Source
  onOpen: (source: Source) => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(source)}
      className="group glass-surface flex items-center gap-1.5 rounded-full border border-black/5 px-2.5 py-1 text-[11px] text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:text-zinc-400 dark:hover:border-violet-500/40 dark:hover:text-violet-300"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="max-w-[14rem] truncate">{source.filename}</span>
      <span className="shrink-0 text-zinc-400 dark:text-zinc-600">
        {Math.round(source.similarity * 100)}%
      </span>
      <ArrowUpRight className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
}
