import { useState } from 'react'
import { FileText, Trash2, Loader2, Inbox } from 'lucide-react'
import { deleteDocument } from '../lib/api'
import type { DocumentInfo } from '../types'

export default function DocumentList({
  documents,
  onChanged,
}: {
  documents: DocumentInfo[]
  onChanged: () => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(filename: string) {
    setDeleting(filename)
    try {
      await deleteDocument(filename)
      onChanged()
    } finally {
      setDeleting(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-zinc-600">
        <Inbox className="h-6 w-6" />
        <p className="text-xs">No documents yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {documents.map((doc) => (
        <div
          key={doc.filename}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-900"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-zinc-300">{doc.filename}</div>
            <div className="text-[10px] text-zinc-600">{doc.chunks} chunks</div>
          </div>
          <button
            onClick={() => handleDelete(doc.filename)}
            disabled={deleting === doc.filename}
            className="shrink-0 rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-100"
            title={`Delete ${doc.filename}`}
          >
            {deleting === doc.filename ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
