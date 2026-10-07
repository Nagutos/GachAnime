import { z } from 'zod'
import { localeCodeSchema } from '../locale'

export const roleSchema = z.enum(['user', 'admin'])
export type Role = z.infer<typeof roleSchema>

export const meResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: roleSchema,
  locale: localeCodeSchema.nullable(),
  gemBalance: z.number().int().nonnegative(),
})

export type MeResponse = z.infer<typeof meResponseSchema>

export const updateMeRequestSchema = z.object({
  locale: localeCodeSchema,
})

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>
