import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  return proxyToBackend(request, `/api/backoffice/staffs/${params.id}`, { method: 'PATCH', body })
}
