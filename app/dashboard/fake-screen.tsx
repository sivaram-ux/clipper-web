'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { Loader2 } from 'lucide-react'

export function FakeScreen() {
  const [phase, setPhase] = useState<'loading' | 'signing-out'>('loading')
  const router = useRouter()

  useEffect(() => {
    // Phase 1: Show "Redirecting..." for 2 seconds
    const timer1 = setTimeout(() => {
      setPhase('signing-out')
    }, 2000)

    // Phase 2: After 1.5 more seconds, sign out
    const timer2 = setTimeout(async () => {
      try {
        await signOut(auth)
        await logout()
      } catch {
        // Ignore errors
      }
      router.push('/')
    }, 3500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [router])

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#f5f5f5' }}
    >
      <div
        className="w-full max-w-[380px] p-8 rounded-lg shadow-md text-center"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Firebase Logo */}
        <div className="flex justify-center mb-6">
          <svg className="w-10 h-10" viewBox="0 0 32 32">
            <path fill="#FFA000" d="M7.562 16.146L9.09 2.93c.055-.483.72-.584.906-.138l1.657 3.98 2.242-4.3c.085-.163.305-.163.39 0l8.2 14.674H7.563z"/>
            <path fill="#F57C00" d="M19.357 17.928L16.29 12.89l-2.396-4.59a.297.297 0 0 0-.513 0L7.563 17.93h11.794z"/>
            <path fill="#FFCA28" d="M7.562 17.928l1.528-13.216a.243.243 0 0 1 .453-.069l1.657 3.98 2.242-4.3a.221.221 0 0 1 .39 0l2.458 4.568 3.067 5.038L22.49 17.93l-6.747 3.926-8.182-3.927z"/>
            <path fill="#FFA000" d="M22.485 17.928L19.357 3.553a.298.298 0 0 0-.555-.098l-11.24 14.473 7.182 4.18a.91.91 0 0 0 .91 0l6.83-4.18z"/>
          </svg>
        </div>

        <h1
          className="text-xl font-medium mb-1"
          style={{ color: '#202124' }}
        >
          {phase === 'loading' ? 'Firebase Auth Demo' : 'Signing Out'}
        </h1>

        <p
          className="text-sm mb-6"
          style={{ color: '#5f6368' }}
        >
          {phase === 'loading' ? 'Authentication successful.' : 'You have been signed out.'}
        </p>

        <div
          className="flex items-center justify-center gap-2"
          style={{ color: '#9aa0a6' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">
            {phase === 'loading' ? 'Redirecting...' : 'Please wait...'}
          </span>
        </div>

        <p
          className="text-xs mt-6"
          style={{ color: '#9aa0a6' }}
        >
          A simple authentication demo
        </p>
      </div>
    </main>
  )
}

