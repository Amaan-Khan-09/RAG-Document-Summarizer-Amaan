import { Circle } from 'lucide-react'
import type { HealthStatus } from '../types'

export default function StatusBadge({ health }: { health: HealthStatus | null }) {
  if (!health) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Circle className="h-2.5 w-2.5 animate-pulse-dot fill-zinc-500 text-zinc-500" />
        Connecting...
      </div>
    )
  }

  const ok = health.ollama_connected
  const provider = health.provider || 'LLM'

  return (
    <div className="flex items-center gap-2 text-xs">
      <Circle
        className={`h-2.5 w-2.5 ${ok ? 'fill-emerald-500 text-emerald-500' : 'fill-red-500 text-red-500'}`}
      />
      <span className={ok ? 'text-zinc-400' : 'text-red-400'}>
        {ok ? `${provider} connected` : `${provider} unreachable`}
      </span>
    </div>
  )
}
