import { useRef, useState } from 'react'
import { ListChecks, Loader2, Sparkles, Square } from 'lucide-react'
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
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500 dark:text-zinc-600">
        <ListChecks className="h-8 w-8" />
        <p className="text-sm">Upload a document to generate a summary</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-5 overflow-y-auto px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="__all__">All documents</option>
          {documents.map((doc) => (
            <option key={doc.filename} value={doc.filename}>
              {doc.filename}
            </option>
          ))}
        </select>

        {isStreaming ? (
          <button
            onClick={() => abortRef.current?.abort()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleSummarize}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate summary
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && hasRun && (
        <div className="group animate-fade-in rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="flex-1">
              {summary ? (
                <Markdown content={summary} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
        </div>
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
