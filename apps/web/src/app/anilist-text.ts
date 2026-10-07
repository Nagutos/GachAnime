/** A run of description text; spoilers (`~!…!~` on AniList) are hidden until revealed. */
export interface DescriptionBlock {
  spoiler: boolean
  paragraphs: string[]
}

/** AniList markdown/HTML → plain text (Vue escapes the result). */
function toPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/~~~/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function paragraphs(value: string): string[] {
  return toPlainText(value)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/[ \t]+\n/g, '\n').trim())
    .filter(Boolean)
}

/** Splits an AniList description into plain and spoiler blocks of paragraphs. */
export function parseAniListDescription(raw: string | null | undefined): DescriptionBlock[] {
  if (!raw) return []
  const blocks: DescriptionBlock[] = []
  const pattern = /~!([\s\S]*?)!~/g
  let cursor = 0
  for (let match = pattern.exec(raw); match; match = pattern.exec(raw)) {
    blocks.push({ spoiler: false, paragraphs: paragraphs(raw.slice(cursor, match.index)) })
    blocks.push({ spoiler: true, paragraphs: paragraphs(match[1] ?? '') })
    cursor = match.index + match[0].length
  }
  blocks.push({ spoiler: false, paragraphs: paragraphs(raw.slice(cursor)) })
  return blocks.filter((block) => block.paragraphs.length > 0)
}
