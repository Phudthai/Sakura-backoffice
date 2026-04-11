'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchNotificationsSummary,
  type NotificationsSummaryData,
} from '@/lib/notifications-summary'

const POLL_MS = 30 * 1000

export function useNotificationsSummary(): {
  summary: NotificationsSummaryData | null
  loading: boolean
  refresh: () => void
} {
  const [summary, setSummary] = useState<NotificationsSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await fetchNotificationsSummary()
    setSummary(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => {
      void load()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [load])

  return { summary, loading, refresh: load }
}
