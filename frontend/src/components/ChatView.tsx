import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare, Bot, User, Eraser, Square, Loader2 } from 'lucide-react'
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
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500 dark:text-zinc-500">
        <MessageSquare className="h-8 w-8" />
        <p className="text-sm">Upload a document to start asking questions</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
              <MessageSquare className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Ask anything about your uploaded documents
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-indigo-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-500/50 dark:hover:text-zinc-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.map((msg) => (
            <div key={msg.id} className="group flex animate-fade-in items-start gap-3">
              {msg.role === 'assistant' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}

              {msg.role === 'user' ? (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-950">
                  {msg.content}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm shadow-zinc-200/50 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-black/20">
                    {msg.status && (
                      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {msg.status}
                      </div>
                    )}
                    {!msg.status && (
                      <>
                        <Markdown content={msg.content} />
                        {msg.isStreaming && (
                          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse-dot bg-zinc-400 align-middle dark:bg-zinc-500" />
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
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <User className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
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
              className="max-h-32 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            />
            {messages.length > 0 && !isStreaming && (
              <button
                onClick={() => setMessages([])}
                title="Clear conversation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
              >
                <Eraser className="h-4 w-4" />
              </button>
            )}
            {isStreaming ? (
              <button
                onClick={handleStop}
                title="Stop generating"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => send(input.trim())}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <CitationPanel source={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  )
}
