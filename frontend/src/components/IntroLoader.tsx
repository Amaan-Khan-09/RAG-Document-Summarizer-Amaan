import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Logo from './Logo'

const STAGES = ['Embed', 'Retrieve', 'Generate']
const PROGRESS_MS = 1500
const EXIT_DELAY_MS = 350

export default function IntroLoader({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const stageTimers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i), (PROGRESS_MS / STAGES.length) * i),
    )
    const exitTimer = setTimeout(onDone, PROGRESS_MS + EXIT_DELAY_MS)
    return () => {
      stageTimers.forEach(clearTimeout)
      clearTimeout(exitTimer)
    }
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#08070d]"
    >
      <div className="intro-grid" aria-hidden="true" />

      <div className="relative z-10 flex w-[min(88vw,32rem)] flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Logo size="lg" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-5 font-mono text-xs font-semibold uppercase tracking-wider text-violet-400"
        >
          RAG Summarizer · 2026
        </motion.p>

        <h1 className="mt-3 flex flex-col text-4xl font-bold leading-[0.95] text-zinc-100 sm:text-5xl">
          <motion.span
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.2, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            Retrieval-Augmented
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.3, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            className="gradient-text"
          >
            Generation
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-4 text-sm font-medium text-zinc-500"
        >
          Embed · Retrieve · Generate
        </motion.p>

        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ delay: 0.35, duration: PROGRESS_MS / 1000, ease: [0.19, 1, 0.22, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
          />
        </div>

        <div className="mt-3 flex w-full justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-600">
          {STAGES.map((label, i) => (
            <span key={label} className={i === stage ? 'text-violet-400' : undefined}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
