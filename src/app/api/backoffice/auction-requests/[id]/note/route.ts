import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  return proxyToBackend(request, `/api/auction-requests/${id}/note`, {
    method: 'PATCH',
    body,
  })
}
