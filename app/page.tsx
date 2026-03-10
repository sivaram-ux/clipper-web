'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, googleProvider, signInWithPopup, isConfigured } from '@/lib/firebase'
import { verifyAndLogin } from './actions/auth'
import { Clipboard, Loader2, AlertTriangle } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return
    
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const idToken = await result.user.getIdToken()
      
      await verifyAndLogin(idToken)
      
      // Always navigate to dashboard - stealth security
      router.push('/dashboard')
    } catch (error) {
      console.error('Sign in error:', error)
      setLoading(false)
    }
  }

  // Show setup screen if Firebase is not configured
  if (!isConfigured) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div 
          className="w-full max-w-[500px] p-8 rounded-2xl border"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div 
            className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--danger)' }} />
          </div>
          
          <h1 
            className="text-2xl text-center mb-2 font-serif"
            style={{ color: 'var(--primary)' }}
          >
            Setup Required
          </h1>
          
          <p 
            className="text-center mb-6"
            style={{ color: 'var(--muted)' }}
          >
            Configure the following environment variables to get started:
          </p>
          
          <div 
            className="rounded-lg p-4 font-mono text-sm space-y-1"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
          >
            <p>NEXT_PUBLIC_FIREBASE_API_KEY</p>
            <p>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</p>
            <p>NEXT_PUBLIC_FIREBASE_PROJECT_ID</p>
            <p>NEXT_PUBLIC_FIREBASE_APP_ID</p>
            <p className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>FIREBASE_PROJECT_ID</p>
            <p>FIREBASE_CLIENT_EMAIL</p>
            <p>FIREBASE_PRIVATE_KEY</p>
            <p className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>UPSTASH_URL</p>
            <p>UPSTASH_TOKEN</p>
            <p className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>MASTER_SECRET</p>
            <p>ALLOWED_EMAILS</p>
          </div>
          
          <p 
            className="text-center text-xs mt-6"
            style={{ color: 'var(--border)' }}
          >
            Add these in Settings &rarr; Vars
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f5f5f5' }}>
      <div 
        className="w-full max-w-[380px] p-8 rounded-lg shadow-md"
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
        
        {/* Title */}
        <h1 
          className="text-xl text-center mb-1 font-medium"
          style={{ color: '#202124' }}
        >
          Firebase Auth Demo
        </h1>
        
        {/* Subtitle */}
        <p 
          className="text-center text-sm mb-6"
          style={{ color: '#5f6368' }}
        >
          Sign in to continue
        </p>
        
        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded border flex items-center justify-center gap-3 transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          style={{ 
            backgroundColor: '#ffffff', 
            borderColor: '#dadce0',
            color: '#3c4043'
          }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#5f6368' }} />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        
        {/* Footer */}
        <p 
          className="text-center text-xs mt-6"
          style={{ color: '#9aa0a6' }}
        >
          A simple authentication demo
        </p>
      </div>
    </main>
  )
}
