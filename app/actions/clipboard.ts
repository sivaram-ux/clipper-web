'use server'

import { getSession } from './auth'
import { verifyPasscode as verifyPasscodeAction } from './settings'
import { encrypt, decrypt } from '@/lib/crypto'
import { getPresignedDownloadUrl } from '@/lib/r2'
import { clipboardLimiter } from '@/lib/rate-limit'

const UPSTASH_URL = process.env.UPSTASH_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || ''
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

async function upstashGet(key: string): Promise<string | null> {
  const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  })
  const data = await r.json()
  return data.result ?? null
}

async function upstashSet(key: string, value: unknown) {
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
}

export async function pushClipboard(
  content: string,
  passcode?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.real) return { ok: false, error: 'Not authenticated' }
    const { username } = session

    const { success } = await clipboardLimiter.limit(username)
    if (!success) return { ok: false, error: 'Too many requests — try again shortly' }

    // Check if passcode is required
    const storedHash = await upstashGet(`passcode:${username}`)
    if (storedHash) {
      if (!passcode) return { ok: false, error: 'Passcode required' }
      if (!(await verifyPasscodeAction(passcode))) return { ok: false, error: 'Wrong passcode' }
    }

    const encryptedContent = await encrypt(content, ENCRYPTION_KEY)

    await upstashSet(`clipboard:${username}`, {
      type: 'text',
      content: encryptedContent,
      device: 'web',
      ts: Date.now() / 1000,
    })

    return { ok: true }
  } catch (e) {
    console.error('Push error:', e)
    return { ok: false, error: 'Failed to push clipboard' }
  }
}

export async function pullClipboard(passcode?: string): Promise<{
  ok: boolean
  type?: 'text' | 'file'
  content?: string        // for text
  downloadUrl?: string    // for file
  filename?: string       // for file
  mime?: string           // for file
  size?: number           // for file
  error?: string
}> {
  try {
    const session = await getSession()
    if (!session?.real) return { ok: false, error: 'Not authenticated' }
    const { username } = session

    const { success } = await clipboardLimiter.limit(username)
    if (!success) return { ok: false, error: 'Too many requests — try again shortly' }

    const [clipboardRaw, storedHash] = await Promise.all([
      upstashGet(`clipboard:${username}`),
      upstashGet(`passcode:${username}`),
    ])

    if (storedHash) {
      if (!passcode) return { ok: false, error: 'Passcode required' }
      if (!(await verifyPasscodeAction(passcode))) return { ok: false, error: 'Wrong passcode' }
    }

    if (!clipboardRaw) return { ok: true, type: 'text', content: '' }

    const payload = JSON.parse(clipboardRaw)

    // ── Text ──────────────────────────────────────────────────────────────
    if (!payload.type || payload.type === 'text') {
      const content = await decrypt(payload.content, ENCRYPTION_KEY)
      return { ok: true, type: 'text', content }
    }

    // ── File ──────────────────────────────────────────────────────────────
    if (payload.type === 'file') {
      const [r2key, filename] = await Promise.all([
        decrypt(payload.r2key, ENCRYPTION_KEY),
        decrypt(payload.filename, ENCRYPTION_KEY),
      ])
      const downloadUrl = await getPresignedDownloadUrl(r2key, filename)
      return {
        ok: true,
        type: 'file',
        downloadUrl,
        filename,
        mime: payload.mime,
        size: payload.size,
      }
    }

    return { ok: false, error: 'Unknown payload type' }
  } catch (e) {
    console.error('Pull error:', e)
    return { ok: false, error: 'Failed to pull clipboard' }
  }
}