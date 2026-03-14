'use server'

import { getSession } from './auth'
import argon2 from 'argon2'
import { passcodeLimiter } from '@/lib/rate-limit'

const UPSTASH_URL = process.env.UPSTASH_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || ''

async function upstashGet(key: string): Promise<string | null> {
  const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  })
  const data = await r.json()
  return data.result ?? null
}

async function upstashSet(key: string, value: string) {
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  })
}

export async function hasPasscode(): Promise<boolean> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return false
    }

    const { username } = session
    const stored = await upstashGet(`passcode:${username}`)

    return !!stored
  } catch {
    return false
  }
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return false
    }

    const { username } = session
    const stored = await upstashGet(`passcode:${username}`)

    if (!stored) {
      return false
    }

    return await argon2.verify(stored, passcode)
  } catch {
    return false
  }
}

export async function setPasscode(
  newPasscode: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return { ok: false, error: 'Not authenticated' }
    }

    const { username } = session

    const { success } = await passcodeLimiter.limit(username)
    if (!success) return { ok: false, error: 'Too many attempts — try again shortly' }

    if (newPasscode.length < 4 || newPasscode.length > 32) {
      return { ok: false, error: 'Passcode must be 4-32 characters' }
    }

    // Check if passcode already exists
    const existing = await hasPasscode()
    if (existing) {
      return { ok: false, error: 'Passcode already set. Use change passcode instead.' }
    }

    const hash = await argon2.hash(newPasscode, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    })

    await upstashSet(`passcode:${username}`, hash)

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to set passcode' }
  }
}

export async function changePasscode(
  oldPasscode: string,
  newPasscode: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return { ok: false, error: 'Not authenticated' }
    }

    const { username } = session

    const { success } = await passcodeLimiter.limit(username)
    if (!success) return { ok: false, error: 'Too many attempts — try again shortly' }

    if (newPasscode.length < 4 || newPasscode.length > 32) {
      return { ok: false, error: 'Passcode must be 4-32 characters' }
    }

    // Verify old passcode
    const valid = await verifyPasscode(oldPasscode)
    if (!valid) {
      return { ok: false, error: 'Current passcode is incorrect' }
    }

    const hash = await argon2.hash(newPasscode, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    })

    await upstashSet(`passcode:${username}`, hash)

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to change passcode' }
  }
}


