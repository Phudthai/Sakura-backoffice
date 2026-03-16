import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  return proxyToBackend(request, `${API_BACKOFFICE_PREFIX}/auction-requests/${params.id}/bids`, {
    method: 'POST',
    body,
  })
}
