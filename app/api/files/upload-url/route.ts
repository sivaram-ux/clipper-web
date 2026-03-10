// app/api/files/upload-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUploadUrl } from '@/app/actions/files'

export async function POST(req: NextRequest) {
    const { filename, mime, size } = await req.json()
    const result = await getUploadUrl(filename, mime, size)
    return NextResponse.json(result)
}