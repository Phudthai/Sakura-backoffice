'use client'

import { useState, useCallback } from 'react'
import { Search } from 'lucide-react'

interface SearchInputProps {
  onSearch: (keyword: string) => void
  placeholder?: string
  defaultValue?: string
}

export default function SearchInput({
  onSearch,
  placeholder = 'Search items...',
  defaultValue = '',
}: SearchInputProps) {
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = useCallback(() => {
    onSearch(value.trim())
  }, [value, onSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex flex-1 max-w-[600px] gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-2.5 pl-10 pr-4 border-none rounded-full text-sm
                     outline-none bg-white/90 text-sakura-900
                     placeholder:text-muted focus:ring-2 focus:ring-white/50"
        />
      </div>
      <button
        onClick={handleSubmit}
        className="px-5 py-2.5 bg-white text-sakura-600 border-none rounded-full
                   font-semibold cursor-pointer text-sm transition-opacity
                   hover:opacity-85"
      >
        Search
      </button>
    </div>
  )
}

