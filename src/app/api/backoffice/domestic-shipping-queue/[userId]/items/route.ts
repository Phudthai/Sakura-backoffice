import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  return proxyToBackend(
    request,
    `${API_BACKOFFICE_PREFIX}/domestic-shipping-queue/${userId}/items`
  )
}
