import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare, Bot, User, Eraser, Square, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { streamQuery } from '../lib/api'
import Markdown from './Markdown'
import CopyButton from './CopyButton'
import SourceCitation from './SourceCitation'
import CitationPanel from './CitationPanel'
import type { ChatMessage, Source } from '../types'

function randomId() {
  return Math.random().toString(36).slice(2)
}

const SUGGESTIONS = [
  'Summarize the key points',
  'What are the main takeaways?',
  'Are there any numbers or dates I should know?',
]

export default function ChatView({
  hasDocuments,
  includedFilenames,
}: {
  hasDocuments: boolean
  includedFilenames: string[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [openCitation, setOpenCitation] = useState<Source | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const filenamesRef = useRef(includedFilenames)
  filenamesRef.current = includedFilenames

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(question: string) {
    if (!question || isStreaming) return

    setInput('')
    const userMsg: ChatMessage = { id: randomId(), role: 'user', content: question }
    const assistantId = randomId()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    function updateAssistant(patch: Partial<ChatMessage>) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      )
    }

    try {
      let content = ''
      await streamQuery(
        question,
        (event) => {
          if (event.type === 'status') {
            updateAssistant({ status: event.data })
          } else if (event.type === 'sources') {
            updateAssistant({ sources: event.data, status: undefined })
          } else if (event.type === 'token') {
            content += event.data
            updateAssistant({ content, status: undefined })
          } else if (event.type === 'error') {
            updateAssistant({ error: event.data, isStreaming: false, status: undefined })
          } else if (event.type === 'done') {
            updateAssistant({ isStreaming: false, status: undefined })
          }
        },
        controller.signal,
        filenamesRef.current,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        updateAssistant({ error: (err as Error).message, isStreaming: false, status: undefined })
      } else {
        updateAssistant({ isStreaming: false, status: undefined })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  if (!hasDocuments) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-fuchsia-500/15">
          <MessageSquare className="h-6 w-6 text-violet-500 dark:text-violet-400" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upload a document to start asking questions
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25"
            >
              <MessageSquare className="h-6 w-6 text-white" />
            </motion.div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Ask anything about your uploaded documents
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.25 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => send(s)}
                  className="glass-surface rounded-full border border-black/5 px-3.5 py-1.5 text-xs text-zinc-600 shadow-sm transition-colors hover:border-violet-300 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-violet-500/50 dark:hover:text-zinc-100"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="group flex items-start gap-3"
              >
                {msg.role === 'assistant' && (
                  <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/20">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}

                {msg.role === 'user' ? (
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm text-white shadow-md shadow-violet-500/20">
                    {msg.content}
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="glass-surface rounded-2xl rounded-bl-sm border border-black/5 px-4 py-3 shadow-sm dark:border-white/10">
                      <AnimatePresence mode="wait">
                        {msg.status && (
                          <motion.div
                            key={msg.status}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                            {msg.status}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {!msg.status && (
                        <>
                          <Markdown content={msg.content} />
                          {msg.isStreaming && (
                            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse-dot bg-violet-400 align-middle dark:bg-violet-500" />
                          )}
                        </>
                      )}
                      {msg.error && <span className="text-sm text-red-500 dark:text-red-400">{msg.error}</span>}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {msg.sources?.map((s) => (
                          <SourceCitation key={s.filename} source={s} onOpen={setOpenCitation} />
                        ))}
                      </div>
                      {msg.content && !msg.isStreaming && (
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
                          <CopyButton text={msg.content} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {msg.role === 'user' && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
                    <User className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="glass-surface border-t border-black/5 px-4 py-4 dark:border-white/10 md:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input.trim())
                }
              }}
              placeholder="Ask a question about your documents..."
              rows={1}
              className="max-h-32 flex-1 resize-none rounded-xl border border-black/10 bg-white/60 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-violet-500 dark:focus:ring-violet-500/20"
            />
            {messages.length > 0 && !isStreaming && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMessages([])}
                title="Clear conversation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-zinc-500 transition-colors hover:border-black/20 hover:text-zinc-700 dark:border-white/10 dark:text-zinc-500 dark:hover:border-white/20 dark:hover:text-zinc-300"
              >
                <Eraser className="h-4 w-4" />
              </motion.button>
            )}
            {isStreaming ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                title="Stop generating"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-700 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/20"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={input.trim() ? { scale: 1.05 } : undefined}
                whileTap={input.trim() ? { scale: 0.95 } : undefined}
                onClick={() => send(input.trim())}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 transition-opacity disabled:cursor-not-allowed disabled:from-zinc-300 disabled:via-zinc-300 disabled:to-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:from-zinc-800 dark:disabled:via-zinc-800 dark:disabled:to-zinc-800 dark:disabled:text-zinc-600"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <CitationPanel source={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  )
}
