/** RFC 4180 cell. Text that Excel would treat as a formula gets a leading quote. */

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined, kind: 'text' | 'number' = 'text'): string {
  if (kind === 'number') {
    const n = typeof value === 'number' ? value : Number(value)
    return `"${Number.isFinite(n) ? String(n) : '0'}"`
  }
  let text = value == null ? '' : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function csvLine(cells: string[]): string {
  return `${cells.join(',')}\r\n`
}
