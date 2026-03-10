import 'server-only'
import {
    S3Client, CreateMultipartUploadCommand, UploadPartCommand,
    CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
    GetObjectCommand, DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export const BUCKET = process.env.R2_BUCKET_NAME!

// Presigned GET URL — expires in 5 minutes
// ResponseContentDisposition bakes Content-Disposition: attachment into the URL
// so browsers force a download even for cross-origin presigned URLs.
export async function getPresignedDownloadUrl(r2key: string, filename?: string): Promise<string> {
    const disposition = filename
        ? `attachment; filename="${filename.replace(/"/g, '')}"`
        : 'attachment'
    return getSignedUrl(r2, new GetObjectCommand({
        Bucket: BUCKET,
        Key: r2key,
        ResponseContentDisposition: disposition,
    }), { expiresIn: 300 })
}

// Single-part presigned PUT — for files under 100MB
export async function getPresignedUploadUrl(r2key: string, mime: string): Promise<string> {
    const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post')
    // Use plain S3 presigned PUT via getSignedUrl for simplicity
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    return getSignedUrl(r2, new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2key,
        ContentType: mime,
    }), { expiresIn: 300 })
}

// Multipart upload helpers — for files over 100MB
export async function createMultipartUpload(r2key: string, mime: string) {
    const res = await r2.send(new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: r2key,
        ContentType: mime,
    }))
    return res.UploadId!
}

export async function getPresignedPartUrl(r2key: string, uploadId: string, partNumber: number): Promise<string> {
    return getSignedUrl(r2, new UploadPartCommand({
        Bucket: BUCKET,
        Key: r2key,
        UploadId: uploadId,
        PartNumber: partNumber,
    }), { expiresIn: 3600 })
}

export async function completeMultipartUpload(
    r2key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
) {
    await r2.send(new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: r2key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
    }))
}

export async function abortMultipartUpload(r2key: string, uploadId: string) {
    await r2.send(new AbortMultipartUploadCommand({
        Bucket: BUCKET,
        Key: r2key,
        UploadId: uploadId,
    }))
}

export async function deleteObject(r2key: string) {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r2key }))
}