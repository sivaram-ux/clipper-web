'use server'

// app/actions/setup.ts
// Generates Android credential bundle server-side.
// UPSTASH_TOKEN and ENCRYPTION_KEY come from env — never exposed to browser.

import argon2 from 'argon2'
import { randomBytes, createCipheriv } from 'crypto'

const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || ''
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

// AES-256-GCM encrypt — same format as Python (nonce[12] + ciphertext + tag[16])
function encryptValue(plaintext: string, key: Buffer): string {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([nonce, ct, tag]).toString('base64')
}

export async function generateAndroidBundle(
    username: string,
    passphrase: string
): Promise<{ ok: boolean; bundle?: string; error?: string }> {
    try {
        if (!username || !passphrase) return { ok: false, error: 'Username and passphrase are required' }
        if (passphrase.length < 6) return { ok: false, error: 'Passphrase must be at least 6 characters' }
        if (!UPSTASH_TOKEN) return { ok: false, error: 'Server misconfigured: missing UPSTASH_TOKEN' }
        if (!ENCRYPTION_KEY) return { ok: false, error: 'Server misconfigured: missing ENCRYPTION_KEY' }

        // 1. Generate random salt
        const salt = randomBytes(32)
        const saltB64 = salt.toString('base64')

        // 2. Derive master key with Argon2id — same params as setup.py
        const masterKey = await argon2.hash(passphrase, {
            type: argon2.argon2id,
            salt,
            timeCost: 3,
            memoryCost: 65536,
            parallelism: 4,
            hashLength: 32,
            raw: true,   // returns raw Buffer, not encoded string
        }) as unknown as Buffer

        // 3. Encrypt UPSTASH_TOKEN and ENCRYPTION_KEY with master key
        const encToken = encryptValue(UPSTASH_TOKEN, masterKey)
        const encKey = encryptValue(ENCRYPTION_KEY, masterKey)

        // 4. Build bundle: CLIPPER::{username}::{salt}::{enc_token}::{enc_key}
        const raw = `CLIPPER::${username}::${saltB64}::${encToken}::${encKey}`
        const bundle = Buffer.from(raw).toString('base64')

        return { ok: true, bundle }
    } catch (e) {
        console.error('generateAndroidBundle error:', e)
        return { ok: false, error: 'Failed to generate bundle' }
    }
}