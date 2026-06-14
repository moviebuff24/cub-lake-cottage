'use client'

import { TreePine } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#f7f4ee' }}>
      <div className="text-center max-w-sm">
        <div className="inline-flex p-4 rounded-2xl mb-6" style={{ backgroundColor: 'rgba(61, 90, 60, 0.1)' }}>
          <TreePine className="w-8 h-8" style={{ color: '#3d5a3c' }} />
        </div>
        <h1 className="font-serif text-2xl font-medium mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          Something went wrong
        </h1>
        <p className="text-sm mb-8" style={{ color: '#6b6357' }}>
          The page hit an unexpected error — likely a brief network hiccup with Firebase.
          Your data is safe.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ backgroundColor: '#3d5a3c' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
