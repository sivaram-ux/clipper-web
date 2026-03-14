'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { setPasscode, changePasscode } from '@/app/actions/settings'
import { generateAndroidBundle } from '@/app/actions/setup'
import { ArrowLeft, CheckCircle, Loader2, LogOut, Shield, User, HardDrive, Trash2 } from 'lucide-react'

const LOCAL_PASSCODE_SET_KEY = 'clipper_passcode_set'
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
  const router = useRouter()

  const [localStorageView, setLocalStorageView] = useState<LocalStorageView>('default')
  const [hasLocalPlainPasscode, setHasLocalPlainPasscode] = useState(false)
  const [storePasscodeInput, setStorePasscodeInput] = useState('')
  const [removePasscodeInput, setRemovePasscodeInput] = useState('')

  useEffect(() => {
    if (!localStorage.getItem(LOCAL_PASSCODE_SET_KEY) && initialPasscodeSet) {
      localStorage.setItem(LOCAL_PASSCODE_SET_KEY, 'true')
    }
    const plainPasscodeKey = getPlainPasscodeKey(username)
    const storedPlainPasscode = localStorage.getItem(plainPasscodeKey)
    setHasLocalPlainPasscode(!!storedPlainPasscode)
  }, [initialPasscodeSet, username])

  const resetForm = () => {
    setNewPasscode(''); setConfirmPasscode(''); setOldPasscode('')
    setStorePasscodeInput(''); setRemovePasscodeInput('')
    setError(''); setSuccess('')
  }

  const handleSetPasscode = async () => {
    setError('')
    if (newPasscode.length < 4 || newPasscode.length > 32) { setError('Passcode must be 4-32 characters'); return }
    if (newPasscode !== confirmPasscode) { setError('Passcodes do not match'); return }
    setLoading(true)
    const result = await setPasscode(newPasscode)
    setLoading(false)
    if (result.ok) {
      localStorage.setItem(LOCAL_PASSCODE_SET_KEY, 'true')
      setPasscodeSetState(true)
      setPasscodeView('default')
      setSuccess('Passcode set successfully.')
      resetForm()
    } else { setError(result.error || 'Failed to set passcode') }
  }

  const handleChangePasscode = async () => {
    setError('')
    if (newPasscode.length < 4 || newPasscode.length > 32) { setError('Passcode must be 4-32 characters'); return }
    if (newPasscode !== confirmPasscode) { setError('Passcodes do not match'); return }
    setLoading(true)
    const result = await changePasscode(oldPasscode, newPasscode)
    setLoading(false)
    if (result.ok) {
      const plainPasscodeKey = getPlainPasscodeKey(username)
      if (localStorage.getItem(plainPasscodeKey)) localStorage.setItem(plainPasscodeKey, newPasscode)
      setPasscodeView('default')
      setSuccess('Passcode changed successfully')
      resetForm()
    } else { setError(result.error || 'Failed to change passcode') }
  }

  const handleStoreLocalPasscode = () => {
    setError('')
    if (storePasscodeInput.length < 4 || storePasscodeInput.length > 32) { setError('Passcode must be 4-32 characters'); return }
    localStorage.setItem(getPlainPasscodeKey(username), storePasscodeInput)
    setHasLocalPlainPasscode(true)
    setLocalStorageView('default')
    setSuccess('Passcode stored locally for quick access')
    resetForm()
  }

  const handleRemoveLocalPasscode = () => {
    setError('')
    const stored = localStorage.getItem(getPlainPasscodeKey(username))
    if (stored !== removePasscodeInput) { setError('Passcode is incorrect'); return }
    localStorage.removeItem(getPlainPasscodeKey(username))
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
    try { if (auth) await signOut(auth); await logout() } catch { /* ignore */ }
    router.push('/')
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href="/dashboard" className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)]">
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--muted)' }} />
        </Link>
        <span className="font-medium text-lg" style={{ color: 'var(--primary)' }}>Settings</span>
      </header>

      <div className="max-w-[500px] mx-auto p-6 flex flex-col gap-6">

        {/* Success message */}
        {success && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300"
            style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', borderWidth: '1px', borderColor: 'var(--success)', color: 'var(--success)' }}>
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Account Card */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>Your Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
              {username[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--primary)' }}>{email}</p>
              <p style={{ color: 'var(--accent)' }}>@{username}</p>
            </div>
          </div>
          <div className="mt-4 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
            style={{ backgroundColor: 'rgba(124, 106, 247, 0.1)', color: 'var(--accent)' }}>
            <User className="w-3 h-3" />
            Connected via Google
          </div>
        </div>

        {/* Passcode Card */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>Passcode</h2>
          {passcodeView === 'default' && (
            <>
              {passcodeSet ? (
                <>
                  <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--success)' }}>
                    <Shield className="w-5 h-5" /><span className="font-medium">Passcode is set</span>
                  </div>
                  <button onClick={() => { resetForm(); setPasscodeView('change') }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                    Change Passcode
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                    Add an extra layer of security to your clipboard data with a passcode.
                  </p>
                  <button onClick={() => { resetForm(); setPasscodeView('set') }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
                    Set Passcode
                  </button>
                </>
              )}
            </>
          )}
          {passcodeView === 'set' && (
            <div className="flex flex-col gap-4">
              <div>
                <input type="password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)}
                  placeholder="Choose a passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
                {strength.label && <p className="text-xs mt-1.5" style={{ color: strength.color }}>{strength.label}</p>}
              </div>
              <input type="password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)}
                placeholder="Confirm passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setPasscodeView('default')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>Cancel</button>
                <button onClick={handleSetPasscode} disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set Passcode'}
                </button>
              </div>
            </div>
          )}
          {passcodeView === 'change' && (
            <div className="flex flex-col gap-4">
              <input type="password" value={oldPasscode} onChange={e => setOldPasscode(e.target.value)}
                placeholder="Current passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
              <div>
                <input type="password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)}
                  placeholder="New passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
                {strength.label && <p className="text-xs mt-1.5" style={{ color: strength.color }}>{strength.label}</p>}
              </div>
              <input type="password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)}
                placeholder="Confirm new passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setPasscodeView('default')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>Cancel</button>
                <button onClick={handleChangePasscode} disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Change Passcode'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Local Passcode Storage Card */}
        {passcodeSet && (
          <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>Local Passcode Storage</h2>
            {localStorageView === 'default' && (
              <>
                {hasLocalPlainPasscode ? (
                  <>
                    <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
                      <Shield className="w-5 h-5" /><span className="font-medium">Passcode stored locally</span>
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Your passcode is saved on this device for quick access.
                    </p>
                    <button onClick={() => { resetForm(); setLocalStorageView('remove') }}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80 cursor-pointer"
                      style={{ backgroundColor: 'rgba(255, 92, 92, 0.1)', color: 'var(--danger)' }}>
                      <Trash2 className="w-4 h-4" />Remove Local Passcode
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Store your passcode locally for quick access. Only do this on a trusted device.
                    </p>
                    <button onClick={() => { resetForm(); setLocalStorageView('store') }}
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                      <HardDrive className="w-4 h-4 inline mr-2" />Store Passcode Locally
                    </button>
                  </>
                )}
              </>
            )}
            {localStorageView === 'store' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Enter your passcode to store it locally.</p>
                <input type="password" value={storePasscodeInput} onChange={e => setStorePasscodeInput(e.target.value)}
                  placeholder="Enter your passcode"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
                {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setLocalStorageView('default')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>Cancel</button>
                  <button onClick={handleStoreLocalPasscode}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>Store Passcode</button>
                </div>
              </div>
            )}
            {localStorageView === 'remove' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: 'var(--danger)' }}>Enter your passcode to confirm removal.</p>
                <input type="password" value={removePasscodeInput} onChange={e => setRemovePasscodeInput(e.target.value)}
                  placeholder="Enter your passcode to confirm"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties} />
                {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setLocalStorageView('default')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--surface)] cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>Cancel</button>
                  <button onClick={handleRemoveLocalPasscode}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--danger)', color: 'var(--primary)' }}>Remove Passcode</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Android Setup Card ────────────────────────────────────────────── */}
        <AndroidBundleSection username={username} />

        {/* Session Card */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--muted)' }}>Session</h2>
          <button onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: 'rgba(255, 92, 92, 0.1)', color: 'var(--danger)' }}>
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>

      </div>
    </main>
  )
}

// ── Android Bundle Generator ──────────────────────────────────────────────────
function AndroidBundleSection({ username }: { username: string }) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [bundle, setBundle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setError(''); setBundle('')
    if (!passphrase) { setError('Passphrase is required'); return }
    if (passphrase !== confirm) { setError('Passphrases do not match'); return }
    setLoading(true)
    try {
      const res = await generateAndroidBundle(username, passphrase)
      if (res.ok && res.bundle) { setBundle(res.bundle); setPassphrase(''); setConfirm('') }
      else setError(res.error || 'Failed to generate bundle')
    } catch { setError('Something went wrong') }
    finally { setLoading(false) }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(bundle)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const EyeOn = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  const EyeOff = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>

  return (
    <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-medium mb-1" style={{ color: 'var(--muted)' }}>Android Setup</h2>
      <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Generate a credential bundle to add this account on the Android app</p>

      <div className="flex flex-col gap-4">
        {/* Username — locked */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--muted)' }}>Username</label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--muted)' }} className="text-sm">@</span>
            <span className="text-sm font-mono flex-1" style={{ color: 'var(--primary)' }}>{username}</span>
            <span className="text-xs px-2 py-0.5 rounded-md" style={{ color: 'var(--muted)', backgroundColor: 'var(--bg)' }}>from session</span>
          </div>
        </div>

        {/* Passphrase */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--muted)' }}>Passphrase</label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <input type={showPass ? 'text' : 'password'} value={passphrase} onChange={e => setPassphrase(e.target.value)}
              placeholder="Choose a passphrase"
              className="flex-1 bg-transparent text-sm font-mono outline-none"
              style={{ color: 'var(--primary)' }} />
            <button onClick={() => setShowPass(v => !v)} style={{ color: 'var(--muted)' }} className="hover:opacity-70 transition-opacity">
              {showPass ? <EyeOff /> : <EyeOn />}
            </button>
          </div>
        </div>

        {/* Confirm */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--muted)' }}>Confirm Passphrase</label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat passphrase" onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              className="flex-1 bg-transparent text-sm font-mono outline-none"
              style={{ color: 'var(--primary)' }} />
            <button onClick={() => setShowConfirm(v => !v)} style={{ color: 'var(--muted)' }} className="hover:opacity-70 transition-opacity">
              {showConfirm ? <EyeOff /> : <EyeOn />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Generate Bundle'}
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Your passphrase is never stored — only you know it
        </p>
      </div>

      {/* Bundle output */}
      {bundle && (
        <div className="mt-5 p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--accent)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>Bundle ready</span>
            </div>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer"
              style={{ color: 'var(--accent)', borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: 'var(--bg)' }}>
            <p className="text-xs font-mono break-all leading-relaxed select-all" style={{ color: 'var(--muted)' }}>{bundle}</p>
          </div>

          <div className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
            <p className="font-medium" style={{ color: 'var(--primary)' }}>How to use:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Copy the bundle above</li>
              <li>Open Clipper on Android → <span style={{ color: 'var(--primary)' }}>Add Account</span></li>
              <li>Paste the bundle and enter your passphrase</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
