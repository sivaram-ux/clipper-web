// app/api/files/multipart-init/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { initMultipartUpload } from '@/app/actions/files'

export async function POST(req: NextRequest) {
    const { filename, mime } = await req.json()
    const result = await initMultipartUpload(filename, mime)
    return NextResponse.json(result)
}