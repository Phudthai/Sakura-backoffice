'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await login(email, password)
    setIsSubmitting(false)

    if (result.success) {
      router.push('/')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-slide-in">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-card p-8 border border-card-border">
        {/* Heading */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-header rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-button">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-sakura-900">Admin Login</h1>
          <p className="text-muted-dark text-sm mt-1">Sign in to Sakura Backoffice</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-sakura-900 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                           bg-sakura-50/50 text-sakura-900 text-sm
                           placeholder:text-muted
                           focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent
                           transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-sakura-900 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-card-border
                           bg-sakura-50/50 text-sakura-900 text-sm
                           placeholder:text-muted
                           focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent
                           transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-sakura-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div className="text-right">
            <button type="button" className="text-xs text-sakura-600 hover:text-sakura-700 hover:underline transition-colors">
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gradient w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign in
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-card-border" />
          <span className="text-xs text-muted">or</span>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        {/* Demo account */}
        <div className="space-y-2">
          <p className="text-xs text-muted-dark text-center mb-2">Quick login with test account</p>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@sakura.com')
              setPassword('password123')
              setError('')
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-card-border
                       text-sm text-sakura-800 bg-white
                       hover:bg-sakura-50 hover:border-sakura-400 transition-all
                       flex items-center justify-between"
          >
            <span className="font-medium">Admin</span>
            <span className="text-xs text-muted">admin@sakura.com</span>
          </button>
        </div>
      </div>
    </div>
  )
}

