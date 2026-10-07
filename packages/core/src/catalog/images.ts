import { randomBytes } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import { IMAGE_UPLOAD_MAX_BYTES } from '@gachanime/shared'
import sharp from 'sharp'
import { AppError } from '../errors'

/** Public URL prefix of the uploads directory (served by Caddy, or by Vite in development). */
export const MEDIA_URL_PREFIX = '/media/'

/** Image to display: the uploaded file when there is one, else the remote URL. */
export function publicImageUrl(imagePath: string | null, imageUrl: string | null): string | null {
  return imagePath ? `${MEDIA_URL_PREFIX}${imagePath}` : imageUrl
}

const SIZES = {
  characters: { width: 460, height: 650 },
  series: { width: 460, height: 650 },
} as const

export type ImageKind = keyof typeof SIZES

/**
 * Validates, resizes (fit inside, never enlarged) and stores an uploaded image as WebP.
 * Returns its path relative to the uploads directory. Animated GIFs keep only the first frame.
 */
export async function storeUploadedImage(
  uploadsDir: string,
  kind: ImageKind,
  id: number,
  data: Uint8Array,
): Promise<string> {
  if (data.byteLength === 0 || data.byteLength > IMAGE_UPLOAD_MAX_BYTES) {
    throw new AppError('INVALID_IMAGE', 'Image is empty or too large')
  }
  let output: Buffer
  try {
    output = await sharp(data, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ ...SIZES[kind], fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new AppError('INVALID_IMAGE', 'Unsupported or corrupted image')
  }
  // A random suffix busts browser caches when an image is replaced.
  const relativePath = `${kind}/${id}-${randomBytes(4).toString('hex')}.webp`
  const absolutePath = join(uploadsDir, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, output)
  return relativePath
}

/** Deletes a previously stored image; missing files are ignored. */
export async function deleteUploadedImage(uploadsDir: string, relativePath: string): Promise<void> {
  const normalized = normalize(relativePath)
  if (normalized.startsWith('..') || normalized.startsWith('/')) return
  await rm(join(uploadsDir, normalized), { force: true })
}
