import { Suspense } from 'react'
import Sidebar from '@/components/backoffice/sidebar'
import BackofficeHeader from '@/components/backoffice/header'

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-body">
      <Suspense
        fallback={
          <aside className="fixed inset-y-0 left-0 z-30 w-60 border-r border-card-border bg-white" />
        }
      >
        <Sidebar />
      </Suspense>
      <div className="pl-60">
        <BackofficeHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
