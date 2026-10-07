import { z } from 'zod'

export const PAGE_SIZE_MAX = 100

/** Query-string pagination (`?page=2&pageSize=50`), 1-based. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
})

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** `?active=true|false` → boolean; anything else → undefined (no filter). */
export const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()
