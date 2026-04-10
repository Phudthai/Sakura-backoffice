'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Loader2, Pencil } from 'lucide-react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatDateBangkok } from '@/lib/date-utils'

const ROLE_OPTIONS = ['CUSTOMER', 'STAFF', 'ADMIN'] as const
type UserRole = (typeof ROLE_OPTIONS)[number]

interface StaffListItem {
  id: string
  name: string
  email: string
  username: string | null
  role: UserRole
  createdAt: string
}

function parseRole(raw: string): UserRole {
  const u = raw.trim().toUpperCase()
  if (u === 'CUSTOMER' || u === 'STAFF' || u === 'ADMIN') return u
  return 'STAFF'
}

/** แปลงแถวจาก GET /api/backoffice/users?role=admin,staff */
function normalizeStaffRow(raw: unknown): StaffListItem | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.id == null) return null
  const roleRaw =
    typeof r.role === 'string'
      ? r.role
      : typeof r.position === 'string'
        ? r.position
        : 'STAFF'
  const name =
    (typeof r.name === 'string' && r.name) ||
    (typeof r.username === 'string' && r.username) ||
    (typeof r.email === 'string' && r.email) ||
    '-'
  const createdAt = r.createdAt ?? r.created_at
  if (createdAt == null) return null
  let username: string | null = null
  if (r.username === null) username = null
  else if (typeof r.username === 'string') username = r.username
  return {
    id: String(r.id),
    name,
    email: typeof r.email === 'string' ? r.email : '',
    username,
    role: parseRole(roleRaw),
    createdAt: String(createdAt),
  }
}

const emptyCreateForm = () => ({
  email: '',
  password: '',
  name: '',
  username: '',
})

type EditSnapshot = {
  role: UserRole
  name: string
  email: string
  username: string | null
}

function buildUserPatch(
  snap: EditSnapshot,
  form: { role: UserRole; name: string; email: string; username: string; password: string }
): { patch: Record<string, unknown> | null; passwordError?: string } {
  const patch: Record<string, unknown> = {}

  if (form.role !== snap.role) patch.role = form.role

  const nameT = form.name.trim()
  if (nameT !== snap.name) patch.name = nameT

  const emailT = form.email.trim()
  if (emailT !== snap.email) patch.email = emailT

  const formU = form.username.trim()
  const snapU = snap.username
  if (snapU == null || snapU === '') {
    if (formU !== '') patch.username = formU
  } else {
    if (formU === '') patch.username = null
    else if (formU !== snapU) patch.username = formU
  }

  if (form.password.length > 0) {
    if (form.password.length < 8) {
      return { patch: null, passwordError: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }
    }
    patch.password = form.password
  }

  if (Object.keys(patch).length === 0) return { patch: null }
  return { patch }
}

export default function StaffsPage() {
  const [staffs, setStaffs] = useState<StaffListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState(emptyCreateForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editTarget, setEditTarget] = useState<StaffListItem | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<EditSnapshot | null>(null)
  const [editForm, setEditForm] = useState({
    role: 'STAFF' as UserRole,
    name: '',
    email: '',
    username: '',
    password: '',
  })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchStaffs = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ role: 'admin,staff' })
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/users?${qs}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data
          .map(normalizeStaffRow)
          .filter((s: StaffListItem | null): s is StaffListItem => s != null)
        setStaffs(rows)
        setListError('')
      } else if (json.success) {
        setStaffs([])
        setListError('')
      } else {
        setListError(json.error?.message ?? 'Failed to load staffs')
      }
    } catch {
      setListError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaffs()
  }, [fetchStaffs])

  const canSubmitCreate =
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.name.trim().length >= 2 &&
    form.name.trim().length <= 100

  const closeAddModal = () => {
    setAddModalOpen(false)
    setForm(emptyCreateForm())
    setCreateError('')
  }

  const openEdit = (s: StaffListItem) => {
    setEditTarget(s)
    setEditSnapshot({
      role: s.role,
      name: s.name,
      email: s.email,
      username: s.username,
    })
    setEditForm({
      role: s.role,
      name: s.name,
      email: s.email,
      username: s.username ?? '',
      password: '',
    })
    setEditError('')
  }

  const closeEdit = () => {
    setEditTarget(null)
    setEditSnapshot(null)
    setEditError('')
    setEditForm({
      role: 'STAFF',
      name: '',
      email: '',
      username: '',
      password: '',
    })
  }

  const handleAdd = async () => {
    if (!canSubmitCreate) return
    setIsSubmitting(true)
    setCreateError('')
    try {
      const body: Record<string, string> = {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: 'STAFF',
      }
      const u = form.username.trim()
      if (u) body.username = u

      const res = await fetch(`${API_BACKOFFICE_PREFIX}/auth/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (res.status === 201 || (res.ok && json.success !== false)) {
        closeAddModal()
        fetchStaffs()
        return
      }

      if (res.status === 409) {
        setCreateError(json.error?.message ?? 'อีเมลหรือชื่อผู้ใช้ซ้ำในระบบ')
        return
      }

      if (res.status === 403) {
        setCreateError(
          json.error?.message ?? 'เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สร้างบัญชีพนักงานได้'
        )
        return
      }

      setCreateError(json.error?.message ?? 'ไม่สามารถสร้างบัญชีพนักงานได้')
    } catch {
      setCreateError('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editTarget || !editSnapshot) return
    setEditError('')
    const { patch, passwordError } = buildUserPatch(editSnapshot, editForm)
    if (passwordError) {
      setEditError(passwordError)
      return
    }
    if (!patch || Object.keys(patch).length === 0) {
      setEditError('แก้อย่างน้อยหนึ่งฟิลด์')
      return
    }

    setEditSaving(true)
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const json = await res.json()

      if (res.status === 200 || (res.ok && json.success !== false)) {
        closeEdit()
        fetchStaffs()
        return
      }

      if (res.status === 404) {
        setEditError(json.error?.message ?? 'ไม่พบผู้ใช้')
        return
      }
      if (res.status === 409) {
        setEditError(json.error?.message ?? 'อีเมลหรือชื่อผู้ใช้ซ้ำในระบบ')
        return
      }
      if (res.status === 400) {
        setEditError(json.error?.message ?? 'ข้อมูลไม่ถูกต้อง')
        return
      }
      if (res.status === 403) {
        setEditError(json.error?.message ?? 'เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่แก้ไขได้')
        return
      }

      setEditError(json.error?.message ?? 'บันทึกไม่สำเร็จ')
    } catch {
      setEditError('Network error')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">รายชื่อพนักงาน</h1>
        <button
          type="button"
          onClick={() => {
            setAddModalOpen(true)
            setCreateError('')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> เพิ่มพนักงาน
        </button>
      </div>

      {listError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start justify-between gap-2">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError('')} className="shrink-0 underline">
            ปิด
          </button>
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isSubmitting && closeAddModal()}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-modal-title"
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="add-staff-modal-title" className="text-lg font-bold text-sakura-900">
                  สร้างบัญชีพนักงาน
                </h2>
                <p className="text-xs text-muted-dark mt-1">
                  บทบาทจะถูกตั้งเป็น STAFF เสมอ · เฉพาะ ADMIN สร้างบัญชีได้
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && closeAddModal()}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors shrink-0"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start justify-between gap-2">
                <span>{createError}</span>
                <button
                  type="button"
                  onClick={() => setCreateError('')}
                  className="shrink-0 text-red-500 hover:text-red-700 font-medium"
                >
                  ปิด
                </button>
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <label htmlFor="staff-email" className="block text-xs font-medium text-sakura-700 mb-1">
                  อีเมล <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label htmlFor="staff-password" className="block text-xs font-medium text-sakura-700 mb-1">
                  รหัสผ่าน <span className="text-red-500">*</span>
                  <span className="text-muted-dark font-normal"> (อย่างน้อย 8 ตัวอักษร)</span>
                </label>
                <input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="staff-name" className="block text-xs font-medium text-sakura-700 mb-1">
                  ชื่อแสดง <span className="text-red-500">*</span>
                  <span className="text-muted-dark font-normal"> (2–100 ตัวอักษร)</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div>
                <label htmlFor="staff-username" className="block text-xs font-medium text-sakura-700 mb-1">
                  ชื่อผู้ใช้ <span className="text-muted-dark font-normal">(ไม่บังคับ ต้องไม่ซ้ำ)</span>
                </label>
                <input
                  id="staff-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                  placeholder="เว้นว่างได้"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => !isSubmitting && closeAddModal()}
                className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-sakura-800 hover:bg-sakura-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canSubmitCreate || isSubmitting}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                สร้างบัญชี
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && editSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !editSaving && closeEdit()}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-modal-title"
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="edit-staff-modal-title" className="text-lg font-bold text-sakura-900">
                  แก้ไขผู้ใช้
                </h2>
                <p className="text-xs text-muted-dark mt-1">
                  ส่งเฉพาะฟิลด์ที่เปลี่ยน · เว้นรหัสผ่านว่างหากไม่ต้องการเปลี่ยน · เว้นชื่อผู้ใช้ว่างเพื่อล้าง
                </p>
              </div>
              <button
                type="button"
                onClick={() => !editSaving && closeEdit()}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors shrink-0"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start justify-between gap-2">
                <span>{editError}</span>
                <button
                  type="button"
                  onClick={() => setEditError('')}
                  className="shrink-0 text-red-500 hover:text-red-700 font-medium"
                >
                  ปิด
                </button>
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <label htmlFor="edit-staff-role" className="block text-xs font-medium text-sakura-700 mb-1">
                  บทบาท
                </label>
                <select
                  id="edit-staff-role"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))
                  }
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-staff-name" className="block text-xs font-medium text-sakura-700 mb-1">
                  ชื่อแสดง
                </label>
                <input
                  id="edit-staff-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="edit-staff-email" className="block text-xs font-medium text-sakura-700 mb-1">
                  อีเมล
                </label>
                <input
                  id="edit-staff-email"
                  type="email"
                  autoComplete="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="edit-staff-username" className="block text-xs font-medium text-sakura-700 mb-1">
                  ชื่อผู้ใช้ <span className="text-muted-dark font-normal">(เว้นว่างเพื่อล้าง)</span>
                </label>
                <input
                  id="edit-staff-username"
                  type="text"
                  autoComplete="username"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="edit-staff-password" className="block text-xs font-medium text-sakura-700 mb-1">
                  รหัสผ่านใหม่{' '}
                  <span className="text-muted-dark font-normal">(เว้นว่างหากไม่เปลี่ยน · อย่างน้อย 8 ตัว)</span>
                </label>
                <input
                  id="edit-staff-password"
                  type="password"
                  autoComplete="new-password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => !editSaving && closeEdit()}
                className="rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-sakura-800 hover:bg-sakura-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                  <th className="px-5 py-3 font-medium">ชื่อ</th>
                  <th className="px-5 py-3 font-medium">อีเมล</th>
                  <th className="px-5 py-3 font-medium">บทบาท</th>
                  <th className="px-5 py-3 font-medium">วันที่สร้าง</th>
                  <th className="px-5 py-3 font-medium w-28 text-right">การทำงาน</th>
                </tr>
              </thead>
              <tbody>
                {staffs.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-sakura-900">{staff.name}</td>
                    <td className="px-5 py-3 text-sakura-700">{staff.email || '—'}</td>
                    <td className="px-5 py-3 text-sakura-700">{staff.role}</td>
                    <td className="px-5 py-3 text-muted-dark">
                      {formatDateBangkok(staff.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(staff)}
                        className="inline-flex items-center gap-1 rounded-lg border border-card-border px-2.5 py-1.5 text-xs font-medium text-sakura-800 hover:bg-sakura-100 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
                {staffs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-dark">
                      ไม่พบพนักงาน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
