'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

export default function Pagination({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: PaginationProps) {
  if (!hasPrev && !hasNext) return null

  return (
    <div className="flex justify-center items-center gap-3 mt-8 mb-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="btn-gradient flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!hasNext}
        className="btn-gradient flex items-center gap-2"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

