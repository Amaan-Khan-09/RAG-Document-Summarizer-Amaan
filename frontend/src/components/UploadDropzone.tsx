import { useRef, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { uploadFiles } from '../lib/api'
import type { UploadResult } from '../types'

const ACCEPTED = '.pdf,.docx,.txt'

export default function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
            : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-zinc-600 dark:hover:bg-zinc-900'
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
        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500 dark:text-indigo-400" />
        ) : (
          <UploadCloud className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
        )}
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Click to upload</span> or drag files
        </div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-600">PDF, DOCX, or TXT</div>
      </label>

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <div
              key={r.filename}
              className="flex items-start gap-1.5 rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] dark:bg-zinc-900/60"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
