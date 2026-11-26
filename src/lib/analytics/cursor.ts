export function decodeCursor(cursor: string | null): { at: string; id: string } | null {
  if (!cursor) return null
  const raw = Buffer.from(cursor, 'base64url').toString('utf8')
  const cut = raw.lastIndexOf('\t')
  if (cut <= 0) return null
  const at = raw.slice(0, cut)
  const id = raw.slice(cut + 1)
  if (!at || !id || Number.isNaN(Date.parse(at))) return null
  return { at, id }
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}\t${id}`, 'utf8').toString('base64url')
}
