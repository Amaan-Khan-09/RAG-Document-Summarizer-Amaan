const SIZES = {
  sm: { box: 'h-6 w-6', text: 'text-[8px]', radius: 'rounded-md' },
  md: { box: 'h-8 w-8', text: 'text-[10px]', radius: 'rounded-lg' },
  lg: { box: 'h-14 w-14', text: 'text-base', radius: 'rounded-2xl' },
  xl: { box: 'h-16 w-16', text: 'text-lg', radius: 'rounded-2xl' },
}

export default function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 ${s.box} ${s.radius}`}
    >
      <span className={`font-bold tracking-tight text-white ${s.text}`}>RAG</span>
    </div>
  )
}
