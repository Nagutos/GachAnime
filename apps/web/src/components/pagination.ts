/** Page buttons of a pager: first, last and a window around the current page; `null` is a gap. */
export function pageItems(page: number, pages: number, around = 1): (number | null)[] {
  const shown = new Set([1, pages])
  for (let item = page - around; item <= page + around; item += 1) {
    if (item >= 1 && item <= pages) shown.add(item)
  }
  const sorted = [...shown].sort((a, b) => a - b)
  const items: (number | null)[] = []
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && item - previous === 2) items.push(item - 1)
    else if (previous !== undefined && item - previous > 2) items.push(null)
    items.push(item)
  })
  return items
}
