// app/api/files/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { confirmUpload } from '@/app/actions/files'

export async function POST(req: NextRequest) {
    const { r2key, filename, mime, size } = await req.json()
    const result = await confirmUpload(r2key, filename, mime, size)
    return NextResponse.json(result)
}