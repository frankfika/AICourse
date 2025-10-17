import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB

export type UploadType = 'courses' | 'instructors' | 'certificates' | 'banners'

export async function saveUploadedFile(
  file: File,
  type: UploadType
): Promise<string> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds limit')
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.')
  }

  // Create directory if not exists
  const uploadPath = join(UPLOAD_DIR, type)
  if (!existsSync(uploadPath)) {
    await mkdir(uploadPath, { recursive: true })
  }

  // Generate unique filename
  const timestamp = Date.now()
  const originalName = file.name.replace(/\s+/g, '-')
  const filename = `${timestamp}-${originalName}`
  const filepath = join(uploadPath, filename)

  // Save file
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await writeFile(filepath, buffer)

  // Return public URL
  return `/uploads/${type}/${filename}`
}

export async function deleteUploadedFile(url: string): Promise<void> {
  // Implementation for deleting files if needed
  // For now, we'll keep files even after deletion from DB
}

