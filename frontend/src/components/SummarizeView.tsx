import { useRef, useState } from 'react'
import { ListChecks, Loader2, Sparkles, Square } from 'lucide-react'
import { motion } from 'framer-motion'
import { streamSummarize } from '../lib/api'
import Markdown from './Markdown'
import CopyButton from './CopyButton'
import type { DocumentInfo } from '../types'

export default function SummarizeView({ documents }: { documents: DocumentInfo[] }) {
  const [target, setTarget] = useState<string>('__all__')
  const [summary, setSummary] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function handleSummarize() {
    setIsStreaming(true)
    setHasRun(true)
    setSummary('')
    setError(null)

    const filename = target === '__all__' ? null : target
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let content = ''
      await streamSummarize(
        filename,
        (event) => {
          if (event.type === 'token') {
            content += event.data
            setSummary(content)
          } else if (event.type === 'error') {
            setError(event.data)
          }
        },
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-fuchsia-500/15">
          <ListChecks className="h-6 w-6 text-violet-500 dark:text-violet-400" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Upload a document to generate a summary</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-5 overflow-y-auto px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="glass-surface rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-800 transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:text-zinc-200"
        >
          <option value="__all__">All documents</option>
          {documents.map((doc) => (
            <option key={doc.filename} value={doc.filename}>
              {doc.filename}
            </option>
          ))}
        </select>

        {isStreaming ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-1.5 rounded-lg bg-black/5 px-3.5 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-black/10 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/20"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSummarize}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-3.5 py-2 text-sm font-medium text-white shadow-md shadow-violet-500/25 transition-shadow hover:shadow-lg hover:shadow-violet-500/30"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate summary
          </motion.button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && hasRun && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="group glass-surface rounded-xl border border-black/5 p-5 dark:border-white/10"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="flex-1">
              {summary ? (
                <Markdown content={summary} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                  Reading documents...
                </div>
              )}
            </div>
            {summary && !isStreaming && (
              <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyButton text={summary} />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {!hasRun && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-zinc-500 dark:text-zinc-600">
          <ListChecks className="h-8 w-8" />
          <p className="text-sm">Pick a document (or all of them) and generate a summary</p>
        </div>
      )}
    </div>
  )
}
