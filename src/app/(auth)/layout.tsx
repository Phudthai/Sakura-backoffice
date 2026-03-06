import Link from 'next/link'

/**
 * Auth layout — clean centered layout for login/register pages.
 * No header, just the logo and the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-body flex flex-col">
      {/* Mini header with logo */}
      <div className="px-6 py-4">
        <Link
          href="/"
          className="text-2xl font-bold bg-gradient-header bg-clip-text text-transparent
                     hover:opacity-80 transition-opacity select-none"
        >
          Sakura Admin
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        {children}
      </main>

      <footer className="text-center text-xs text-muted py-6">
        © 2026 Sakura Backoffice
      </footer>
    </div>
  )
}

