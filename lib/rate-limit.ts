import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'

const redis = new Redis({
  url: process.env.UPSTASH_URL || '',
  token: process.env.UPSTASH_TOKEN || '',
})

// Auth: 5 login attempts per minute per IP
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1m'),
  prefix: 'rl:auth',
})

// Clipboard push/pull: 30 requests per minute per user
export const clipboardLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1m'),
  prefix: 'rl:clip',
})

// Passcode set/change: 5 attempts per minute per user
export const passcodeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1m'),
  prefix: 'rl:pass',
})

// Bundle generation: 3 per minute per user (expensive Argon2id)
export const bundleLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1m'),
  prefix: 'rl:bundle',
})

// File upload: 10 per minute per user
export const fileLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'),
  prefix: 'rl:file',
})

export async function getClientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
