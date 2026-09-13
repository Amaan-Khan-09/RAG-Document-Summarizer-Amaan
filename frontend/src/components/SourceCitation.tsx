import { useState } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import type { Source } from '../types'

export default function SourceCitation({ source }: { source: Source }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <FileText className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{source.filename}</span>
        <span className="shrink-0 text-zinc-600">{Math.round(source.similarity * 100)}% match</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="animate-fade-in border-t border-zinc-800 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-500">
          "{source.snippet}"
        </div>
      )}
    </div>
  )
}
