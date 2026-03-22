import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString()
  const query = searchParams ? `?${searchParams}` : ''
  return proxyToBackend(
    request,
    `${API_BACKOFFICE_PREFIX}/overview/stats${query}`
  )
}
