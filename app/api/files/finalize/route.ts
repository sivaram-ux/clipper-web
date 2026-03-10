// app/api/files/finalize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { finalizeUpload } from '@/app/actions/files'

export async function POST(req: NextRequest) {
    const { r2key, uploadId, parts, filename, mime, size } = await req.json()
    const result = await finalizeUpload(r2key, uploadId, parts, filename, mime, size)
    return NextResponse.json(result)
}