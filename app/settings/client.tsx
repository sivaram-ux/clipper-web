'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { setPasscode, changePasscode, getPasscodeHash } from '@/app/actions/settings'
import { ArrowLeft, CheckCircle, Loader2, LogOut, Shield, User, HardDrive, Trash2 } from 'lucide-react'

const LOCAL_PASSCODE_HASH_KEY = 'clipper_passcode_hash'
const getPlainPasscodeKey = (username: string) => `plain-passcode-${username}`

interface SettingsClientProps {
  username: string
  email: string
  passcodeSet: boolean
}

type PasscodeView = 'default' | 'set' | 'change'
type LocalStorageView = 'default' | 'store' | 'remove'

export function SettingsClient({ username, email, passcodeSet: initialPasscodeSet }: SettingsClientProps) {
  const [passcodeSet, setPasscodeSetState] = useState(initialPasscodeSet)
  const [passcodeView, setPasscodeView] = useState<PasscodeView>('default')
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [oldPasscode, setOldPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasLocalHashStored, setHasLocalHashStored] = useState(false)
  const router = useRouter()
  
  // Local plain passcode storage state
  const [localStorageView, setLocalStorageView] = useState<LocalStorageView>('default')
  const [hasLocalPlainPasscode, setHasLocalPlainPasscode] = useState(false)
  const [storePasscodeInput, setStorePasscodeInput] = useState('')
  const [removePasscodeInput, setRemovePasscodeInput] = useState('')

  useEffect(() => {
    // Check if we have local hash stored
    const storedHash = localStorage.getItem(LOCAL_PASSCODE_HASH_KEY)
    setHasLocalHashStored(!!storedHash)
    
    // Check if we have local plain passcode stored (per-user)
    const plainPasscodeKey = getPlainPasscodeKey(username)
    const storedPlainPasscode = localStorage.getItem(plainPasscodeKey)
    setHasLocalPlainPasscode(!!storedPlainPasscode)
    
    // Sync with Upstash if local is missing but passcode exists on server
    const syncLocalHash = async () => {
      if (!storedHash && initialPasscodeSet) {
        const result = await getPasscodeHash()
        if (result.ok && result.hash) {
          localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, result.hash)
          setHasLocalHashStored(true)
        }
      }
    }
    syncLocalHash()
  }, [initialPasscodeSet, username])

  const resetForm = () => {
    setNewPasscode('')
    setConfirmPasscode('')
    setOldPasscode('')
    setStorePasscodeInput('')
    setRemovePasscodeInput('')
    setError('')
    setSuccess('')
  }

  const handleSetPasscode = async () => {
    setError('')

    if (newPasscode.length < 4 || newPasscode.length > 32) {
      setError('Passcode must be 4-32 characters')
      return
    }

    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }

    setLoading(true)
    const result = await setPasscode(newPasscode)
    setLoading(false)

    if (result.ok && result.hash) {
      // Store hash locally (always stored for verification)
      localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, result.hash)
      setHasLocalHashStored(true)
      // Do NOT store plaintext automatically - user can opt-in from Local Passcode Storage section
      setPasscodeSetState(true)
      setPasscodeView('default')
      setSuccess('Passcode set successfully. You can store it locally below for quick access.')
      resetForm()
    } else {
      setError(result.error || 'Failed to set passcode')
    }
  }

  const handleChangePasscode = async () => {
    setError('')

    if (newPasscode.length < 4 || newPasscode.length > 32) {
      setError('Passcode must be 4-32 characters')
      return
    }

    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }

    setLoading(true)
    const result = await changePasscode(oldPasscode, newPasscode)
    setLoading(false)

    if (result.ok && result.hash) {
      // Update hash locally
      localStorage.setItem(LOCAL_PASSCODE_HASH_KEY, result.hash)
      // Update plaintext passcode for this user if they have it stored
      const plainPasscodeKey = getPlainPasscodeKey(username)
      if (localStorage.getItem(plainPasscodeKey)) {
        localStorage.setItem(plainPasscodeKey, newPasscode)
      }
      setPasscodeView('default')
      setSuccess('Passcode changed successfully')
      resetForm()
    } else {
      setError(result.error || 'Failed to change passcode')
    }
  }

  const handleStoreLocalPasscode = () => {
    setError('')
    
    if (storePasscodeInput.length < 4 || storePasscodeInput.length > 32) {
      setError('Passcode must be 4-32 characters')
      return
    }
    
    const plainPasscodeKey = getPlainPasscodeKey(username)
    localStorage.setItem(plainPasscodeKey, storePasscodeInput)
    setHasLocalPlainPasscode(true)
    setLocalStorageView('default')
    setSuccess('Passcode stored locally for quick access')
    resetForm()
  }

  const handleRemoveLocalPasscode = () => {
    setError('')
    
    const plainPasscodeKey = getPlainPasscodeKey(username)
    const stored = localStorage.getItem(plainPasscodeKey)
    
    if (stored !== removePasscodeInput) {
      setError('Passcode is incorrect')
      return
    }
    
    localStorage.removeItem(plainPasscodeKey)
    setHasLocalPlainPasscode(false)
    setLocalStorageView('default')
    setSuccess('Local passcode removed')
    resetForm()
  }

  const getPasscodeStrength = (pass: string): { label: string; color: string } => {
    if (pass.length === 0) return { label: '', color: '' }
    if (pass.length < 4) return { label: 'Too short', color: 'var(--danger)' }
    if (pass.length < 8) return { label: 'Weak', color: 'var(--danger)' }
    if (pass.length < 12) return { label: 'Medium', color: 'var(--accent)' }
    return { label: 'Strong', color: 'var(--success)' }
  }

  const strength = getPasscodeStrength(newPasscode)

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
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center gap-4 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/dashboard"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)]"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--muted)' }} />
        </Link>
        <span className="font-medium text-lg" style={{ color: 'var(--primary)' }}>
          Settings
        </span>
      </header>

      <div className="max-w-[500px] mx-auto p-6 flex flex-col gap-6">
        {/* Success message */}
        {success && (
          <div
            className="flex items-center gap-2 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              backgroundColor: 'rgba(74, 222, 128, 0.1)',
              borderWidth: '1px',
              borderColor: 'var(--success)',
              color: 'var(--success)'
            }}
          >
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Your Account Card */}
        <div
          className="p-6 rounded-xl border"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>
            Your Account
          </h2>

          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
            >
              {username[0].toUpperCase()}
            </div>

            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--primary)' }}>
                {email}
              </p>
              <p style={{ color: 'var(--accent)' }}>
                @{username}
              </p>
            </div>
          </div>

          <div
            className="mt-4 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
            style={{ backgroundColor: 'rgba(124, 106, 247, 0.1)', color: 'var(--accent)' }}
          >
            <User className="w-3 h-3" />
            Connected via Google
          </div>
        </div>

        {/* Passcode Card */}
        <div
          className="p-6 rounded-xl border"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>
            Passcode
          </h2>

          {passcodeView === 'default' && (
            <>
              {passcodeSet ? (
                <>
                  <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Passcode is set</span>
                  </div>
                  {hasLocalHashStored && (
                    <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--muted)' }}>
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">Hash stored locally for verification</span>
                    </div>
                  )}
                  <button
                    onClick={() => { resetForm(); setPasscodeView('change') }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                  >
                    Change Passcode
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                    Add an extra layer of security to your clipboard data with a passcode.
                  </p>
                  <button
                    onClick={() => { resetForm(); setPasscodeView('set') }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
                  >
                    Set Passcode
                  </button>
                </>
              )}
            </>
          )}

          {passcodeView === 'set' && (
            <div className="flex flex-col gap-4">
              <div>
                <input
                  type="password"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="Choose a passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                    '--tw-ring-color': 'var(--accent)'
                  } as React.CSSProperties}
                />
                {strength.label && (
                  <p className="text-xs mt-1.5" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                )}
              </div>

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

              {error && (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPasscodeView('default')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPasscode}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set Passcode'}
                </button>
              </div>
            </div>
          )}

          {passcodeView === 'change' && (
            <div className="flex flex-col gap-4">
              <input
                type="password"
                value={oldPasscode}
                onChange={(e) => setOldPasscode(e.target.value)}
                placeholder="Current passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                  '--tw-ring-color': 'var(--accent)'
                } as React.CSSProperties}
              />

              <div>
                <input
                  type="password"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="New passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                    '--tw-ring-color': 'var(--accent)'
                  } as React.CSSProperties}
                />
                {strength.label && (
                  <p className="text-xs mt-1.5" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                )}
              </div>

              <input
                type="password"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Confirm new passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                  '--tw-ring-color': 'var(--accent)'
                } as React.CSSProperties}
              />

              {error && (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPasscodeView('default')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePasscode}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Change Passcode'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Local Passcode Storage Card - Only show if passcode is set */}
        {passcodeSet && (
          <div
            className="p-6 rounded-xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>
              Local Passcode Storage
            </h2>

            {localStorageView === 'default' && (
              <>
                {hasLocalPlainPasscode ? (
                  <>
                    <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
                      <Shield className="w-5 h-5" />
                      <span className="font-medium">Passcode stored locally</span>
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Your passcode is saved on this device for quick access. You won&apos;t need to enter it manually.
                    </p>
                    <button
                      onClick={() => { resetForm(); setLocalStorageView('remove') }}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80 cursor-pointer"
                      style={{ backgroundColor: 'rgba(255, 92, 92, 0.1)', color: 'var(--danger)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Local Passcode
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Store your passcode locally for quick access. Only do this if you&apos;re sure no one else can access this device.
                    </p>
                    <button
                      onClick={() => { resetForm(); setLocalStorageView('store') }}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                    >
                      <HardDrive className="w-4 h-4 inline mr-2" />
                      Store Passcode Locally
                    </button>
                  </>
                )}
              </>
            )}

            {localStorageView === 'store' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Enter your passcode to store it locally. This is for convenience only.
                </p>

                <input
                  type="password"
                  value={storePasscodeInput}
                  onChange={(e) => setStorePasscodeInput(e.target.value)}
                  placeholder="Enter your passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                    '--tw-ring-color': 'var(--accent)'
                  } as React.CSSProperties}
                />

                {error && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setLocalStorageView('default')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStoreLocalPasscode}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}
                  >
                    Store Passcode
                  </button>
                </div>
              </div>
            )}

            {localStorageView === 'remove' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: 'var(--danger)' }}>
                  Enter your passcode to confirm removal. You&apos;ll need to enter it manually each time.
                </p>

                <input
                  type="password"
                  value={removePasscodeInput}
                  onChange={(e) => setRemovePasscodeInput(e.target.value)}
                  placeholder="Enter your passcode to confirm"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary)',
                    '--tw-ring-color': 'var(--accent)'
                  } as React.CSSProperties}
                />

                {error && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setLocalStorageView('default')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveLocalPasscode}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--danger)', color: 'var(--primary)' }}
                  >
                    Remove Passcode
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Card */}
        <div
          className="p-6 rounded-xl border"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>
            Session
          </h2>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: 'rgba(255, 92, 92, 0.1)', color: 'var(--danger)' }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </main>
  )
}
