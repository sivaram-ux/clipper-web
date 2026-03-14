'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/firebase'
import { logout } from '@/app/actions/auth'
import { pushClipboard, pullClipboard } from '@/app/actions/clipboard'
import { setPasscode as setPasscodeAction } from '@/app/actions/settings'
import {
  Clipboard, Settings, LogOut, ArrowUpRight, ArrowDownLeft,
  Loader2, CheckCircle, XCircle, Shield, Lock,
  Paperclip, Download, FileText, X
} from 'lucide-react'

const LOCAL_PASSCODE_SET_KEY = 'clipper_passcode_set'
const getPlainPasscodeKey = (username: string) => `plain-passcode-${username}`
const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB

interface DashboardClientProps {
  username: string
  email: string
  initialPasscodeSet: boolean
}

type Status = { type: 'success' | 'error'; message: string } | null
type Mode = 'text' | 'file'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function DashboardClient({ username, initialPasscodeSet }: DashboardClientProps) {
  const [mode, setMode] = useState<Mode>('text')
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [passcodeInput, setPasscodeInput] = useState('')
  const [loading, setLoading] = useState<'send' | 'receive' | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Passcode state
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false)
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [passcodeSet, setPasscodeSet] = useState(initialPasscodeSet)
  const [initialCheckDone, setInitialCheckDone] = useState(false)
  const [hasLocalPlainPasscode, setHasLocalPlainPasscode] = useState(false)
  const [showPasscodeInput, setShowPasscodeInput] = useState(false)

  useEffect(() => {
    const checkPasscode = async () => {
      const localFlag = localStorage.getItem(LOCAL_PASSCODE_SET_KEY)
      if (localFlag === 'true') { setPasscodeSet(true); setInitialCheckDone(true); return }
      if (initialPasscodeSet) {
        localStorage.setItem(LOCAL_PASSCODE_SET_KEY, 'true')
        setPasscodeSet(true)
        setInitialCheckDone(true)
        return
      }
      setShowPasscodeSetup(true)
      setInitialCheckDone(true)
    }
    checkPasscode()
  }, [initialPasscodeSet])

  useEffect(() => {
    const saved = localStorage.getItem(getPlainPasscodeKey(username))
    if (saved) { setPasscodeInput(saved); setHasLocalPlainPasscode(true); setShowPasscodeInput(false) }
    else { setHasLocalPlainPasscode(false); setShowPasscodeInput(true) }
  }, [username])

  useEffect(() => {
    if (status) {
      const t = setTimeout(() => setStatus(null), 4000)
      return () => clearTimeout(t)
    }
  }, [status])

  // ── Passcode error helper ──────────────────────────────────────────────────
  const handlePasscodeError = async () => {
    localStorage.removeItem(getPlainPasscodeKey(username))
    setPasscodeInput('')
    setHasLocalPlainPasscode(false)
    setShowPasscodeInput(true)
    setStatus({ type: 'error', message: 'Wrong passcode — may have changed on another device' })
  }

  // ── Upload file directly to R2 via presigned URL ───────────────────────────
  const uploadFile = async (file: File): Promise<boolean> => {
    const mime = file.type || 'application/octet-stream'
    setUploadProgress(0)

    if (file.size < MULTIPART_THRESHOLD) {
      // Single-part upload
      const res = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime, size: file.size }),
      })
      const { ok, url, r2key, error } = await res.json()
      if (!ok) { setStatus({ type: 'error', message: error || 'Failed to get upload URL' }); return false }

      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: file,
      })
      setUploadProgress(90)

      const confirm = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2key, filename: file.name, mime, size: file.size }),
      })
      const confirmData = await confirm.json()
      if (!confirmData.ok) { setStatus({ type: 'error', message: 'Failed to confirm upload' }); return false }

      setUploadProgress(100)
      return true
    } else {
      // Multipart upload
      const initRes = await fetch('/api/files/multipart-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime }),
      })
      const { ok, uploadId, r2key, error } = await initRes.json()
      if (!ok) { setStatus({ type: 'error', message: error || 'Failed to init upload' }); return false }

      const totalParts = Math.ceil(file.size / CHUNK_SIZE)
      const parts: { ETag: string; PartNumber: number }[] = []

      for (let i = 0; i < totalParts; i++) {
        const partNumber = i + 1
        const start = i * CHUNK_SIZE
        const chunk = file.slice(start, start + CHUNK_SIZE)

        const partRes = await fetch('/api/files/part-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2key, uploadId, partNumber }),
        })
        const { url: partUrl } = await partRes.json()

        const uploadRes = await fetch(partUrl, {
          method: 'PUT',
          body: chunk,
        })
        const etag = uploadRes.headers.get('etag') || ''
        parts.push({ ETag: etag, PartNumber: partNumber })
        setUploadProgress(Math.round((partNumber / totalParts) * 90))
      }

      const finalRes = await fetch('/api/files/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2key, uploadId, parts, filename: file.name, mime, size: file.size }),
      })
      const finalData = await finalRes.json()
      if (!finalData.ok) { setStatus({ type: 'error', message: 'Failed to finalize upload' }); return false }

      setUploadProgress(100)
      return true
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (mode === 'file') {
      if (!selectedFile) { setStatus({ type: 'error', message: 'No file selected' }); return }
      setLoading('send')
      const ok = await uploadFile(selectedFile)
      setLoading(null)
      setUploadProgress(null)
      if (ok) {
        setStatus({ type: 'success', message: `${selectedFile.name} sent` })
        setSelectedFile(null)
      }
      return
    }

    // Text mode
    let textToSend = content
    if (!textToSend.trim()) {
      try {
        textToSend = await navigator.clipboard.readText()
        if (!textToSend.trim()) { setStatus({ type: 'error', message: 'Clipboard is empty' }); return }
        setContent(textToSend)
      } catch {
        setStatus({ type: 'error', message: 'Nothing to send — clipboard access denied' }); return
      }
    }

    setLoading('send')
    const result = await pushClipboard(textToSend, passcodeSet ? passcodeInput : undefined)
    setLoading(null)

    if (result.ok) {
      setStatus({ type: 'success', message: 'Sent to cloud' })
      setContent('')
    } else {
      if (result.error === 'Wrong passcode') await handlePasscodeError()
      else setStatus({ type: 'error', message: result.error || 'Failed to send' })
    }
  }

  // ── Receive ────────────────────────────────────────────────────────────────
  const handleReceive = async () => {
    setLoading('receive')
    const result = await pullClipboard(passcodeSet ? passcodeInput : undefined)
    setLoading(null)

    if (!result.ok) {
      if (result.error === 'Wrong passcode') await handlePasscodeError()
      else setStatus({ type: 'error', message: result.error || 'Failed to receive' })
      return
    }

    // File received
    if (result.type === 'file' && result.downloadUrl) {
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = result.filename || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setStatus({
        type: 'success',
        message: `Downloading ${result.filename} (${formatBytes(result.size || 0)})`
      })
      return
    }

    // Text received
    if (result.type === 'text' || !result.type) {
      if (result.content) {
        setContent(result.content)
        setMode('text')
        try {
          await navigator.clipboard.writeText(result.content)
          setStatus({ type: 'success', message: 'Received & copied to clipboard' })
        } catch {
          setStatus({ type: 'success', message: 'Received from cloud' })
        }
      } else {
        setStatus({ type: 'error', message: 'No clipboard data found' })
      }
    }
  }

  const handleSetupPasscode = async () => {
    setSetupError('')
    if (newPasscode.length < 4 || newPasscode.length > 32) { setSetupError('Passcode must be 4-32 characters'); return }
    if (newPasscode !== confirmPasscode) { setSetupError('Passcodes do not match'); return }
    setSetupLoading(true)
    const result = await setPasscodeAction(newPasscode)
    setSetupLoading(false)
    if (result.ok) {
      localStorage.setItem(LOCAL_PASSCODE_SET_KEY, 'true')
      setPasscodeInput(newPasscode)
      setHasLocalPlainPasscode(false)
      setShowPasscodeInput(true)
      setPasscodeSet(true)
      setShowPasscodeSetup(false)
      setStatus({ type: 'success', message: 'Passcode set successfully' })
    } else {
      setSetupError(result.error || 'Failed to set passcode')
    }
  }

  const handleLogout = async () => {
    try { if (auth) await signOut(auth); await logout() } catch { }
    router.push('/')
  }

  const isBusy = loading !== null

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Clipboard className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <span className="font-serif text-xl" style={{ color: 'var(--primary)' }}>Clipper</span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: 'var(--accent)' }}>@{username}</span>
          <Link href="/settings" className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)]">
            <Settings className="w-5 h-5" style={{ color: 'var(--muted)' }} />
          </Link>
          <button onClick={handleLogout} className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)] cursor-pointer">
            <LogOut className="w-5 h-5" style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[500px] flex flex-col gap-4">

          {/* Mode toggle */}
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {(['text', 'file'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSelectedFile(null); setContent('') }}
                className="flex-1 py-2.5 text-sm font-medium transition-colors capitalize cursor-pointer"
                style={{
                  backgroundColor: mode === m ? 'var(--accent)' : 'var(--card)',
                  color: mode === m ? 'var(--primary-foreground)' : 'var(--muted)',
                }}
              >
                {m === 'text' ? '📝 Text' : '📎 File'}
              </button>
            ))}
          </div>

          {/* Text area */}
          {mode === 'text' && (
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
          )}

          {/* File picker */}
          {mode === 'file' && (
            <div
              onClick={() => !isBusy && fileInputRef.current?.click()}
              className="w-full min-h-[180px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: selectedFile ? 'var(--accent)' : 'var(--border)', backgroundColor: 'var(--card)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <FileText className="w-10 h-10" style={{ color: 'var(--accent)' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--primary)' }}>{selectedFile.name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatBytes(selectedFile.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                    className="mt-1 flex items-center gap-1 text-xs px-3 py-1 rounded-lg cursor-pointer"
                    style={{ color: 'var(--danger)', backgroundColor: 'rgba(255,92,92,0.08)' }}
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <>
                  <Paperclip className="w-8 h-8" style={{ color: 'var(--muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>Click to choose a file</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>Any type · up to 1GB</span>
                </>
              )}
            </div>
          )}

          {/* Upload progress bar */}
          {uploadProgress !== null && (
            <div className="w-full">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
            </div>
          )}

          {/* Passcode input */}
          {passcodeSet && showPasscodeInput && (
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
          )}

          {/* Stored passcode indicator */}
          {passcodeSet && hasLocalPlainPasscode && !showPasscodeInput && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
              style={{ backgroundColor: 'rgba(74, 222, 128, 0.05)', borderColor: 'var(--success)' }}>
              <Shield className="w-4 h-4" style={{ color: 'var(--success)' }} />
              <span className="text-sm" style={{ color: 'var(--success)' }}>Using stored passcode</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSend}
              disabled={isBusy}
              className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading === 'send' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><ArrowUpRight className="w-5 h-5" /> Send {mode === 'file' ? 'File' : ''}</>
              )}
            </button>

            <button
              onClick={handleReceive}
              disabled={isBusy}
              className="w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium border-2 transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: 'transparent', borderColor: 'var(--accent)', color: 'var(--primary)' }}
            >
              {loading === 'receive' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><ArrowDownLeft className="w-5 h-5" /> Receive</>
              )}
            </button>
          </div>

          {/* Status */}
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
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {status.message}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        End-to-end encrypted · AES-256-GCM · clipboard:{username}
      </footer>

      {/* Passcode Setup Modal */}
      {showPasscodeSetup && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-[400px] p-6 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(124, 106, 247, 0.1)' }}>
                <Lock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 className="font-medium" style={{ color: 'var(--primary)' }}>Set Up Passcode</h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Required for encryption</p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              A passcode is required to encrypt your clipboard data. This passcode will be used on all your devices.
            </p>
            <div className="flex flex-col gap-3">
              <input type="password" value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Choose a passcode (4-32 characters)"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
              />
              <input type="password" value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Confirm passcode"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--primary)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
              />
              {setupError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{setupError}</p>}
              <button onClick={handleSetupPasscode} disabled={setupLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' }}>
                {setupLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set Passcode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}