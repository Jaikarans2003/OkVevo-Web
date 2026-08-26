/**
 * useChat's processUIMessageStream requires text-start / tool-input-start
 * before deltas. A live tail after lastSeq can begin mid-part — prepend the
 * matching start so reconnect does not throw.
 */
export function seedOpenPartStarts(
  chunk: Record<string, unknown>,
  seen: { text: Set<string>; tool: Set<string> }
): Record<string, unknown>[] {
  const type = chunk.type;
  if (type === 'text-start' && typeof chunk.id === 'string') {
    seen.text.add(chunk.id);
    return [chunk];
  }
  if (type === 'text-delta' && typeof chunk.id === 'string' && !seen.text.has(chunk.id)) {
    seen.text.add(chunk.id);
    return [{ type: 'text-start', id: chunk.id }, chunk];
  }
  if (type === 'tool-input-start' && typeof chunk.toolCallId === 'string') {
    seen.tool.add(chunk.toolCallId);
    return [chunk];
  }
  if (
    type === 'tool-input-delta' &&
    typeof chunk.toolCallId === 'string' &&
    !seen.tool.has(chunk.toolCallId)
  ) {
    seen.tool.add(chunk.toolCallId);
    const toolName = typeof chunk.toolName === 'string' ? chunk.toolName : 'tool';
    return [
      { type: 'tool-input-start', toolCallId: chunk.toolCallId, toolName },
      chunk,
    ];
  }
  return [chunk];
}
