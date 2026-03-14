'use server'

import { getSession } from './auth'
import { sha256 } from '@/lib/crypto'

const UPSTASH_URL = process.env.UPSTASH_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || ''

async function upstashFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${UPSTASH_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

export async function hasPasscode(): Promise<boolean> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return false
    }
    
    const { username } = session
    const res = await upstashFetch(`/get/passcode:${username}`)
    const data = await res.json()
    
    return !!data.result
  } catch {
    return false
  }
}

export async function getPasscodeHash(): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return { ok: false, error: 'Not authenticated' }
    }
    
    const { username } = session
    const res = await upstashFetch(`/get/passcode:${username}`)
    const data = await res.json()
    
    if (!data.result) {
      return { ok: false, error: 'No passcode set' }
    }
    
    return { ok: true, hash: data.result }
  } catch {
    return { ok: false, error: 'Failed to fetch passcode hash' }
  }
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return false
    }
    
    const { username } = session
    const res = await upstashFetch(`/get/passcode:${username}`)
    const data = await res.json()
    
    if (!data.result) {
      return false
    }
    
    const hash = await sha256(passcode)
    return hash === data.result
  } catch {
    return false
  }
}

export async function setPasscode(
  newPasscode: string
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return { ok: false, error: 'Not authenticated' }
    }
    
    if (newPasscode.length < 4 || newPasscode.length > 32) {
      return { ok: false, error: 'Passcode must be 4-32 characters' }
    }
    
    const { username } = session
    
    // Check if passcode already exists
    const existing = await hasPasscode()
    if (existing) {
      return { ok: false, error: 'Passcode already set. Use change passcode instead.' }
    }
    
    const hash = await sha256(newPasscode)
    
    await upstashFetch(`/set/passcode:${username}/${hash}`, {
      method: 'POST',
    })
    
    // Return the hash so the client can store it locally
    return { ok: true, hash }
  } catch {
    return { ok: false, error: 'Failed to set passcode' }
  }
}

export async function changePasscode(
  oldPasscode: string,
  newPasscode: string
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  try {
    const session = await getSession()
    if (!session || !session.real) {
      return { ok: false, error: 'Not authenticated' }
    }
    
    if (newPasscode.length < 4 || newPasscode.length > 32) {
      return { ok: false, error: 'Passcode must be 4-32 characters' }
    }
    
    // Verify old passcode
    const valid = await verifyPasscode(oldPasscode)
    if (!valid) {
      return { ok: false, error: 'Current passcode is incorrect' }
    }
    
    const { username } = session
    const hash = await sha256(newPasscode)
    
    await upstashFetch(`/set/passcode:${username}/${hash}`, {
      method: 'POST',
    })
    
    // Return the hash so the client can store it locally
    return { ok: true, hash }
  } catch {
    return { ok: false, error: 'Failed to change passcode' }
  }
}


