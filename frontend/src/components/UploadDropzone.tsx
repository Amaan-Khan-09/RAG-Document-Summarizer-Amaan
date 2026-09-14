import { useRef, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { uploadFiles } from '../lib/api'
import type { UploadResult } from '../types'

const ACCEPTED = '.pdf,.docx,.txt'

export default function UploadDropzone({
  onUploaded,
  variant = 'sidebar',
}: {
  onUploaded: () => void
  variant?: 'sidebar' | 'hero'
}) {
  const isHero = variant === 'hero'
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setIsUploading(true)
    setResults([])
    try {
      const results = await uploadFiles(Array.from(fileList))
      setResults(results)
      if (results.some((r) => r.status === 'success')) {
        onUploaded()
      }
    } catch (err) {
      setResults([
        { filename: 'upload', status: 'failed', error: (err as Error).message },
      ])
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-all ${
          isHero ? 'px-8 py-12 sm:px-14 sm:py-16' : 'px-4 py-6'
        } ${
          isDragging
            ? 'scale-[1.02] border-violet-400 bg-violet-500/10 shadow-lg shadow-violet-500/10'
            : 'border-black/10 bg-black/[0.02] hover:border-black/20 hover:bg-black/[0.04] dark:border-white/15 dark:bg-white/[0.02] dark:hover:border-white/25 dark:hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <motion.div
          animate={isDragging ? { y: -3, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={isHero ? 'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-fuchsia-500/15' : undefined}
        >
          {isUploading ? (
            <Loader2 className={`animate-spin text-violet-500 dark:text-violet-400 ${isHero ? 'h-6 w-6' : 'h-5 w-5'}`} />
          ) : (
            <UploadCloud
              className={`${isDragging ? 'text-violet-500 dark:text-violet-400' : isHero ? 'text-violet-500 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-500'} ${isHero ? 'h-6 w-6' : 'h-5 w-5'}`}
            />
          )}
        </motion.div>
        <div className={isHero ? 'mt-1 text-sm text-zinc-600 dark:text-zinc-300' : 'text-xs text-zinc-500 dark:text-zinc-400'}>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">Click to upload</span> or drag files
        </div>
        <div className={isHero ? 'text-xs text-zinc-400 dark:text-zinc-500' : 'text-[10px] text-zinc-400 dark:text-zinc-600'}>
          PDF, DOCX, or TXT
        </div>
      </label>

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <motion.div
              key={r.filename}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-1.5 rounded-md bg-black/[0.03] px-2 py-1.5 text-[11px] dark:bg-white/[0.04]"
            >
              {r.status === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
              )}
              <div className="min-w-0">
                <div className="truncate text-zinc-700 dark:text-zinc-300">{r.filename}</div>
                <div className="text-zinc-500 dark:text-zinc-600">
                  {r.status === 'success' ? `${r.chunks_created} chunks indexed` : r.error}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
