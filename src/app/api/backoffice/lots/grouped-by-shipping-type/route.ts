import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export async function GET(request: NextRequest) {
  return proxyToBackend(
    request,
    `${API_BACKOFFICE_PREFIX}/lots/grouped-by-shipping-type`
  )
}
