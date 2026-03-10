import 'server-only'
import { webcrypto } from 'crypto'

const crypto = webcrypto as unknown as Crypto

export async function encrypt(plaintext: string, keyBase64: string): Promise<string> {
  const keyBytes = Buffer.from(keyBase64, 'base64')
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  )
  const blob = new Uint8Array(12 + ct.byteLength)
  blob.set(nonce, 0)
  blob.set(new Uint8Array(ct), 12)
  return Buffer.from(blob).toString('base64')
}

export async function decrypt(blobBase64: string, keyBase64: string): Promise<string> {
  const raw = Buffer.from(blobBase64, 'base64')
  const nonce = raw.slice(0, 12)
  const ct = raw.slice(12)
  const keyBytes = Buffer.from(keyBase64, 'base64')
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    ct
  )
  return new TextDecoder().decode(plain)
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('base64')
}

export async function deriveKeyWithPasscode(userKeyBase64: string, passcodeHash: string): Promise<string> {
  const userKeyBytes = Buffer.from(userKeyBase64, 'base64')
  const passcodeBytes = Buffer.from(passcodeHash, 'base64')
  
  // Import user key as base key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    userKeyBytes,
    'HKDF',
    false,
    ['deriveBits']
  )
  
  // Derive new key using HKDF with passcode hash as salt
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: passcodeBytes,
      info: new TextEncoder().encode('clipper-key-derivation'),
    },
    baseKey,
    256
  )
  
  return Buffer.from(derivedBits).toString('base64')
}

export function generateRandomKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(keyBytes).toString('base64')
}
