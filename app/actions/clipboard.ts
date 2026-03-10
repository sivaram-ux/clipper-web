'use server'

import { getSession } from './auth'
import { encrypt, decrypt } from '@/lib/crypto'

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

async function upstashSet(key: string, value: unknown): Promise<void> {
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  })
}

async function sha256(input: string): Promise<string> {
  const { webcrypto } = await import('crypto')
  const data = new TextEncoder().encode(input)
  const hash = await webcrypto.subtle.digest('SHA-256', data)
  return Buffer.from(hash).toString('base64')
}

// Single Upstash call — fetch both clipboard and passcode hash in parallel
export async function pushClipboard(
  content: string,
  passcode?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) return { ok: false, error: 'Not authenticated' }

    const { username } = session

    // Fetch passcode hash and do encryption in parallel
    const [storedHash, encryptedContent] = await Promise.all([
      upstashGet(`passcode:${username}`),
      encrypt(content, ENCRYPTION_KEY),
    ])

    // Verify passcode if one is set — no extra round trip
    if (storedHash) {
      if (!passcode) return { ok: false, error: 'Passcode required' }
      const inputHash = await sha256(passcode)
      if (inputHash !== storedHash) return { ok: false, error: 'Wrong passcode' }
    }

    await upstashSet(`clipboard:${username}`, {
      content: encryptedContent,
      device: 'web',
      ts: Date.now() / 1000,
    })

    return { ok: true }
  } catch (error) {
    console.error('Push error:', error)
    return { ok: false, error: 'Failed to push clipboard' }
  }
}

export async function pullClipboard(
  passcode?: string
): Promise<{ ok: boolean; content?: string; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) return { ok: false, error: 'Not authenticated' }

    const { username } = session

    // Fetch clipboard and passcode hash in parallel — single round trip each
    const [clipboardRaw, storedHash] = await Promise.all([
      upstashGet(`clipboard:${username}`),
      upstashGet(`passcode:${username}`),
    ])

    // Verify passcode if one is set — no extra round trip
    if (storedHash) {
      if (!passcode) return { ok: false, error: 'Passcode required' }
      const inputHash = await sha256(passcode)
      if (inputHash !== storedHash) return { ok: false, error: 'Wrong passcode' }
    }

    if (!clipboardRaw) return { ok: true, content: '' }

    const payload = JSON.parse(clipboardRaw)
    const decryptedContent = await decrypt(payload.content, ENCRYPTION_KEY)

    return { ok: true, content: decryptedContent }
  } catch (error) {
    console.error('Pull error:', error)
    return { ok: false, error: 'Failed to pull clipboard' }
  }
}