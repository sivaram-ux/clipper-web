'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { CheckCircle, Lock, Loader2 } from 'lucide-react'

export function FakeScreen() {
  const [phase, setPhase] = useState<'loading' | 'signing-out'>('loading')
  const router = useRouter()

  useEffect(() => {
    // Phase 1: Show "Loading your workspace" for 2 seconds
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
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div 
        className="w-full max-w-[400px] p-8 rounded-2xl border text-center"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {phase === 'loading' ? (
          <>
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)' }}
            >
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--success)' }} />
            </div>
            
            <h2 
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--primary)' }}
            >
              Login Successful!
            </h2>
            
            <p style={{ color: 'var(--muted)' }}>
              Welcome back.
            </p>
            
            <div className="flex items-center justify-center gap-2 mt-6" style={{ color: 'var(--muted)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading your workspace</span>
              <span className="animate-pulse">...</span>
            </div>
          </>
        ) : (
          <>
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <Lock className="w-8 h-8" style={{ color: 'var(--muted)' }} />
            </div>
            
            <h2 
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--primary)' }}
            >
              Signing you out...
            </h2>
            
            <p style={{ color: 'var(--muted)' }}>
              See you next time!
            </p>
            
            <div className="flex items-center justify-center gap-2 mt-6" style={{ color: 'var(--muted)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Securing session</span>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
