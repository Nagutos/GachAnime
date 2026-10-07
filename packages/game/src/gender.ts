export type GenderClass = 'female' | 'male' | 'unclassified'

/**
 * Maps AniList's free-text gender to a class used by pack rules (Waifus / Husbandos).
 * Only "Female" and "Male" are classified; anything else waits for an admin decision.
 */
export function genderClassFromAniList(gender: string | null | undefined): GenderClass {
  switch (gender?.trim().toLowerCase()) {
    case 'female':
      return 'female'
    case 'male':
      return 'male'
    default:
      return 'unclassified'
  }
}

/** The admin override always wins over the imported class. */
export function effectiveGender(
  genderClass: GenderClass,
  override: GenderClass | null | undefined,
): GenderClass {
  return override ?? genderClass
}
