'use server'

import { getSession } from './auth'
import { encrypt, decrypt } from '@/lib/crypto'
import {
    r2, BUCKET,
    getPresignedUploadUrl, getPresignedDownloadUrl,
    createMultipartUpload, getPresignedPartUrl,
    completeMultipartUpload, abortMultipartUpload,
} from '@/lib/r2'
import { randomUUID } from 'crypto'
import { fileLimiter } from '@/lib/rate-limit'

const UPSTASH_URL = process.env.UPSTASH_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN || ''
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

// Multipart threshold — 100MB
const MULTIPART_THRESHOLD = 100 * 1024 * 1024
// Chunk size — 10MB per part (R2 minimum is 5MB)
const CHUNK_SIZE = 10 * 1024 * 1024

async function upstashSet(key: string, value: unknown) {
    await fetch(`${UPSTASH_URL}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    })
}

async function upstashGet(key: string): Promise<string | null> {
    const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    })
    const data = await r.json()
    return data.result ?? null
}

// ── Small file upload (< 100MB) ──────────────────────────────────────────────
// Returns a presigned PUT URL — client uploads directly to R2
export async function getUploadUrl(
    filename: string,
    mime: string,
    size: number
): Promise<{ ok: boolean; url?: string; r2key?: string; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        const { success } = await fileLimiter.limit(session.username)
        if (!success) return { ok: false, error: 'Too many uploads — try again shortly' }

        const r2key = `${session.username}/${randomUUID()}/${filename}`
        const url = await getPresignedUploadUrl(r2key, mime)
        return { ok: true, url, r2key }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to generate upload URL' }
    }
}

// ── Multipart upload init (> 100MB) ──────────────────────────────────────────
export async function initMultipartUpload(
    filename: string,
    mime: string
): Promise<{ ok: boolean; uploadId?: string; r2key?: string; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        const { success } = await fileLimiter.limit(session.username)
        if (!success) return { ok: false, error: 'Too many uploads — try again shortly' }

        const r2key = `${session.username}/${randomUUID()}/${filename}`
        const uploadId = await createMultipartUpload(r2key, mime)
        return { ok: true, uploadId, r2key }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to init multipart upload' }
    }
}

// ── Get presigned URL for one part ───────────────────────────────────────────
export async function getPartUrl(
    r2key: string,
    uploadId: string,
    partNumber: number
): Promise<{ ok: boolean; url?: string; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        const url = await getPresignedPartUrl(r2key, uploadId, partNumber)
        return { ok: true, url }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to get part URL' }
    }
}

// ── Finalize multipart upload ─────────────────────────────────────────────────
export async function finalizeUpload(
    r2key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
    filename: string,
    mime: string,
    size: number
): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        await completeMultipartUpload(r2key, uploadId, parts)
        await saveFileMetadata(session.username, r2key, filename, mime, size)
        return { ok: true }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to finalize upload' }
    }
}

// ── Save metadata after single-part upload ────────────────────────────────────
export async function confirmUpload(
    r2key: string,
    filename: string,
    mime: string,
    size: number
): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        await saveFileMetadata(session.username, r2key, filename, mime, size)
        return { ok: true }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to save metadata' }
    }
}

// ── Get download URL ──────────────────────────────────────────────────────────
export async function getDownloadUrl(): Promise<{
    ok: boolean
    url?: string
    filename?: string
    mime?: string
    size?: number
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.real) return { ok: false, error: 'Not authenticated' }

        const raw = await upstashGet(`clipboard:${session.username}`)
        if (!raw) return { ok: false, error: 'Nothing to download' }

        const payload = JSON.parse(raw)
        if (payload.type !== 'file') return { ok: false, error: 'Not a file' }

        const r2key = await decrypt(payload.r2key, ENCRYPTION_KEY)
        const filename = await decrypt(payload.filename, ENCRYPTION_KEY)

        const url = await getPresignedDownloadUrl(r2key)
        return { ok: true, url, filename, mime: payload.mime, size: payload.size }
    } catch (e) {
        console.error(e)
        return { ok: false, error: 'Failed to get download URL' }
    }
}

// ── Internal helper ───────────────────────────────────────────────────────────
async function saveFileMetadata(
    username: string,
    r2key: string,
    filename: string,
    mime: string,
    size: number
) {
    const [encR2key, encFilename] = await Promise.all([
        encrypt(r2key, ENCRYPTION_KEY),
        encrypt(filename, ENCRYPTION_KEY),
    ])
    await upstashSet(`clipboard:${username}`, {
        type: 'file',
        r2key: encR2key,
        filename: encFilename,
        mime,
        size,
        device: 'web',
        ts: Date.now() / 1000,
    })
}