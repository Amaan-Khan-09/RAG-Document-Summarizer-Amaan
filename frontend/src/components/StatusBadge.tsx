import { Circle } from 'lucide-react'
import type { HealthStatus } from '../types'

export default function StatusBadge({ health }: { health: HealthStatus | null }) {
  if (!health) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Circle className="h-2.5 w-2.5 shrink-0 animate-pulse-dot fill-zinc-400 text-zinc-400" />
        Connecting...
      </div>
    )
  }

  const ok = health.ollama_connected
  const provider = health.provider || 'LLM'
  const label = `${provider} ${ok ? 'connected' : 'unreachable'}`

  return (
    <div className="flex items-center gap-1.5 text-xs" title={label}>
      <Circle
        className={`h-2.5 w-2.5 shrink-0 ${ok ? 'fill-emerald-500 text-emerald-500' : 'fill-red-500 text-red-500'}`}
      />
      <span className={`truncate ${ok ? 'text-zinc-500 dark:text-zinc-400' : 'text-red-500 dark:text-red-400'}`}>
        {label}
      </span>
    </div>
  )
}
