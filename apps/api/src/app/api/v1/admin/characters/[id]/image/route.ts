import {
  deleteUploadedImage,
  publicImageUrl,
  setCharacterImage,
  storeUploadedImage,
} from '@gachanime/core'
import { adminRoute, parseId, readUploadedFile } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { getEnv } from '@/lib/env'

export const POST = adminRoute<{ id: string }>(async ({ request, actor, params }) => {
  const id = parseId(params.id)
  const { UPLOADS_DIR } = getEnv()
  const path = await storeUploadedImage(
    UPLOADS_DIR,
    'characters',
    id,
    await readUploadedFile(request),
  )
  try {
    const { previousPath } = await setCharacterImage(getDb(), id, path, actor)
    if (previousPath) await deleteUploadedImage(UPLOADS_DIR, previousPath)
  } catch (error) {
    await deleteUploadedImage(UPLOADS_DIR, path)
    throw error
  }
  return Response.json({ imageUrl: publicImageUrl(path, null) })
})
