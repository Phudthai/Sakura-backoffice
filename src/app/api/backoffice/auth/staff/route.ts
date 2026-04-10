import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

/** POST /api/backoffice/auth/staff — สร้างบัญชี STAFF (เฉพาะ ADMIN; Bearer จาก cookie) */
export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyToBackend(request, `${API_BACKOFFICE_PREFIX}/auth/staff`, { method: 'POST', body })
}
