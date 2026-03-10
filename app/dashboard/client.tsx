'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { pushClipboard, pullClipboard } from '@/app/actions/clipboard'
import { setPasscode as setPasscodeAction, getPasscodeHash } from '@/app/actions/settings'
import { Clipboard, Settings, LogOut, ArrowUpRight, ArrowDownLeft, Loader2, CheckCircle, XCircle, Shield, Lock } from 'lucide-react'

const LOCAL_PASSCODE_HASH_KEY = 'clipper_passcode_hash'
const getPlainPasscodeKey = (username: string) => `plain-passcode-${username}`

interface DashboardClientProps {
  username: string
  email: string
  initialPasscodeSet: boolean
}

type Status = {
  type: 'success' | 'error'
  message: string
} | null

export function DashboardClient({ username, initialPasscodeSet }: DashboardClientProps) {
  const [content, setContent] = useState('')
  const [passcodeInput, setPasscodeInput] = useState('')
  const [loading, setLoading] = useState<'send' | 'receive' | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const router = useRouter()
  
  // Passcode setup modal state
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false)
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [passcodeSet, setPasscodeSet] = useState(initialPasscodeSet)
  const [initialCheckDone, setInitialCheckDone] = useState(false)
  
  // Local plain passcode storage state
  const [hasLocalPlainPasscode, setHasLocalPlainPasscode] = useState(false)
  const [showPasscodeInput, setShowPasscodeInput] = useState(false) // Only show when decryption fails

  // Check passcode on mount - only once at login
  useEffect(() => {
    const checkPasscode = async () => {
      // Check local hash first
      const localHash = localStorage.getItem(LOCAL_PASSCODE_HASH_KEY)
      
      if (localHash) {
        // Local hash exists, passcode is set
        setPasscodeSet(true)
        setInitialCheckDone(true)
        return
      }
      
      // No local hash - check Upstash
      if (initialPasscodeSet) {
        // Passcode exists on Upstash but not locally - fetch and store it
        const result = await getPasscodeHash()
        if (result.ok && result.hash) {
          localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, result.hash)
          setPasscodeSet(true)
        }
        setInitialCheckDone(true)
        return
      }
      
      // No passcode set anywhere - prompt to create one
      setShowPasscodeSetup(true)
      setInitialCheckDone(true)
    }
    
    checkPasscode()
  }, [initialPasscodeSet])

  // Load local plain passcode (per-user key) on mount
  useEffect(() => {
    const plainPasscodeKey = getPlainPasscodeKey(username)
    const saved = localStorage.getItem(plainPasscodeKey)
    if (saved) {
      setPasscodeInput(saved)
      setHasLocalPlainPasscode(true)
      setShowPasscodeInput(false) // Hide input since we have stored passcode
    } else {
      setHasLocalPlainPasscode(false)
      setShowPasscodeInput(true) // Show input since no stored passcode
    }
  }, [username])

  // Auto-hide status after 3 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  const handleSend = async () => {
    if (!content.trim()) {
      setStatus({ type: 'error', message: 'Nothing to send' })
      return
    }

    setLoading('send')
    const result = await pushClipboard(content, passcodeSet ? passcodeInput : undefined)
    setLoading(null)

    if (result.ok) {
      setStatus({ type: 'success', message: 'Sent to cloud' })
      setContent('')
    } else {
      // If wrong passcode, sync hash from Upstash (passcode might have changed on another device)
      if (result.error === 'Wrong passcode') {
        const hashResult = await getPasscodeHash()
        if (hashResult.ok && hashResult.hash) {
          localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, hashResult.hash)
          // Clear stored plain passcode since it's now invalid
          const plainPasscodeKey = getPlainPasscodeKey(username)
          localStorage.removeItem(plainPasscodeKey)
          setPasscodeInput('')
          setHasLocalPlainPasscode(false)
          setShowPasscodeInput(true) // Show input so user can enter new passcode
        }
        setStatus({ type: 'error', message: 'Wrong passcode - passcode may have changed on another device' })
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to send' })
      }
    }
  }

  const handleReceive = async () => {
    setLoading('receive')
    const result = await pullClipboard(passcodeSet ? passcodeInput : undefined)
    setLoading(null)

    if (result.ok) {
      if (result.content) {
        setContent(result.content)
        setStatus({ type: 'success', message: 'Received from cloud' })
      } else {
        setStatus({ type: 'error', message: 'No clipboard data found' })
      }
    } else {
      // If wrong passcode, sync hash from Upstash (passcode might have changed on another device)
      if (result.error === 'Wrong passcode') {
        const hashResult = await getPasscodeHash()
        if (hashResult.ok && hashResult.hash) {
          localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, hashResult.hash)
          // Clear stored plain passcode since it's now invalid
          const plainPasscodeKey = getPlainPasscodeKey(username)
          localStorage.removeItem(plainPasscodeKey)
          setPasscodeInput('')
          setHasLocalPlainPasscode(false)
          setShowPasscodeInput(true) // Show input so user can enter new passcode
        }
        setStatus({ type: 'error', message: 'Wrong passcode - passcode may have changed on another device' })
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to receive' })
      }
    }
  }

  const handleSetupPasscode = async () => {
    setSetupError('')
    
    if (newPasscode.length < 4 || newPasscode.length > 32) {
      setSetupError('Passcode must be 4-32 characters')
      return
    }
    
    if (newPasscode !== confirmPasscode) {
      setSetupError('Passcodes do not match')
      return
    }
    
    setSetupLoading(true)
    const result = await setPasscodeAction(newPasscode)
    setSetupLoading(false)
    
    if (result.ok && result.hash) {
      // Store hash locally (always stored for verification)
      localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, result.hash)
      // Do NOT store plaintext automatically - user can opt-in from settings
      setPasscodeInput(newPasscode) // Keep in memory for this session
      setHasLocalPlainPasscode(false)
      setShowPasscodeInput(true) // Show input since plaintext is not stored
      setPasscodeSet(true)
      setShowPasscodeSetup(false)
      setStatus({ type: 'success', message: 'Passcode set successfully. You can store it locally from Settings.' })
    } else {
      setSetupError(result.error || 'Failed to set passcode')
    }
  }

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth)
      await logout()
    } catch {
      // Ignore errors
    }
    router.push('/')
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Clipboard className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <span className="font-serif text-xl" style={{ color: 'var(--primary)' }}>
            Clipper
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--accent)' }}>@{username}</span>
          <Link
            href="/settings"
            className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)]"
          >
            <Settings className="w-5 h-5" style={{ color: 'var(--muted)' }} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)] cursor-pointer"
          >
            <LogOut className="w-5 h-5" style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[500px] flex flex-col gap-4">
          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste text here to Send, or Receive from cloud..."
            className="w-full min-h-[180px] p-4 rounded-xl border resize-none font-mono text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--primary)',
              '--tw-ring-color': 'var(--accent)'
            } as React.CSSProperties}
          />

          {/* Passcode input - only shown when no local plain passcode stored or decryption failed */}
          {passcodeSet && showPasscodeInput && (
            <div className="relative">
              <input
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter passcode"
                className="w-full px-4 py-3 rounded-xl border font-mono text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                  '--tw-ring-color': 'var(--accent)'
                } as React.CSSProperties}
              />
            </div>
          )}
          
          {/* Indicator when using stored local passcode */}
          {passcodeSet && hasLocalPlainPasscode && !showPasscodeInput && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ 
                backgroundColor: 'rgba(74, 222, 128, 0.05)',
                borderColor: 'var(--success)'
              }}
            >
              <Shield className="w-4 h-4" style={{ color: 'var(--success)' }} />
              <span className="text-sm" style={{ color: 'var(--success)' }}>
                Using stored passcode
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSend}
              disabled={loading !== null}
              className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)'
              }}
            >
              {loading === 'send' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  Send
                </>
              )}
            </button>

            <button
              onClick={handleReceive}
              disabled={loading !== null}
              className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium border-2 transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--accent)',
                color: 'var(--primary)'
              }}
            >
              {loading === 'receive' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowDownLeft className="w-5 h-5" />
                  Receive
                </>
              )}
            </button>
          </div>

          {/* Status chip */}
          {status && (
            <div
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{
                backgroundColor: status.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 92, 92, 0.1)',
                borderWidth: '1px',
                borderColor: status.type === 'success' ? 'var(--success)' : 'var(--danger)',
                color: status.type === 'success' ? 'var(--success)' : 'var(--danger)'
              }}
            >
              {status.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {status.message}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer
        className="py-4 text-center text-xs"
        style={{ color: 'var(--muted)' }}
      >
        End-to-end encrypted · AES-256-GCM · clipboard:{username}
      </footer>

      {/* Passcode Setup Modal - Cannot be dismissed */}
      {showPasscodeSetup && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6 z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          <div
            className="w-full max-w-[400px] p-6 rounded-xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(124, 106, 247, 0.1)' }}
              >
                <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 className="font-medium" style={{ color: 'var(--primary)' }}>
                  Set Up Passcode
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Required for encryption
                </p>
              </div>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              A passcode is required to encrypt your clipboard data. This passcode will be used on all your devices.
            </p>

            <div className="flex flex-col gap-3">
              <input
                type="password"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Choose a passcode (4-32 characters)"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                  '--tw-ring-color': 'var(--accent)'
                } as React.CSSProperties}
              />

              <input
                type="password"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Confirm passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                  '--tw-ring-color': 'var(--accent)'
                } as React.CSSProperties}
              />

              {setupError && (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{setupError}</p>
              )}

              <button
                onClick={handleSetupPasscode}
                disabled={setupLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
              >
                {setupLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set Passcode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
