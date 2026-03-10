'use server'

import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { SignJWT, jwtVerify } from 'jose'

const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
const MASTER_SECRET = process.env.MASTER_SECRET || ''

function getMasterSecretKey() {
  return new TextEncoder().encode(MASTER_SECRET)
}

export async function verifyAndLogin(idToken: string): Promise<{ status: string }> {
  try {
    const { adminAuth } = getFirebaseAdmin()
    
    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const email = decodedToken.email?.toLowerCase() || ''
    
    const cookieStore = await cookies()
    
    if (ALLOWED_EMAILS.includes(email)) {
      // Real user - create Firebase session cookie
      const sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      
      cookieStore.set('session', sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      })
    } else {
      // Not in allowed list - create fake session
      const fakeToken = await new SignJWT({ fake: true, email })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(getMasterSecretKey())
      
      cookieStore.set('session', fakeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      })
    }
    
    // ALWAYS return success - attacker cannot distinguish
    return { status: 'success' }
  } catch {
    // Even on error, return success to not leak info
    return { status: 'success' }
  }
}

export type SessionData = {
  real: true
  email: string
  username: string
} | {
  real: false
} | null

export async function getSession(): Promise<SessionData> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value
    
    if (!sessionCookie) {
      return null
    }
    
    const { adminAuth } = getFirebaseAdmin()
    
    // Try Firebase session cookie first
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true)
      const email = decodedClaims.email || ''
      const username = email.split('@')[0]
      return { real: true, email, username }
    } catch {
      // Not a valid Firebase session, try fake JWT
      try {
        const { payload } = await jwtVerify(sessionCookie, getMasterSecretKey())
        if (payload.fake === true) {
          return { real: false }
        }
      } catch {
        // Invalid token
        return null
      }
    }
    
    return null
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
