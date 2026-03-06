import Sidebar from '@/components/backoffice/sidebar'
import BackofficeHeader from '@/components/backoffice/header'

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-body">
      <Sidebar />
      <div className="pl-60">
        <BackofficeHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
