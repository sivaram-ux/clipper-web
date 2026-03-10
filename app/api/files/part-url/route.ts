// app/api/files/part-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPartUrl } from '@/app/actions/files'

export async function POST(req: NextRequest) {
    const { r2key, uploadId, partNumber } = await req.json()
    const result = await getPartUrl(r2key, uploadId, partNumber)
    return NextResponse.json(result)
}