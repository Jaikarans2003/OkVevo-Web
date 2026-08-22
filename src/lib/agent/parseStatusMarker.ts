import {
  getToolNameFromPart,
  isPartInFlight,
  isToolActivityPart,
} from '@/lib/agent-tool-summaries';
import { getToolFriendlyLabel, isInternalTool } from '@/lib/agent/friendlyStatus';

export type ActivityPart = {
  type: string;
  text?: string;
  state?: string;
  toolName?: string;
};

export type StatusLine = {
  text: string;
  timestamp: number;
};

const STATUS_MARKER_RE = /\[\[STATUS:\s*([^\]]+?)\s*\]\]/;
const STATUS_MARKER_GLOBAL_RE = /\[\[STATUS:\s*[^\]]+?\s*\]\]/g;

export function parseStatusMarker(text: string): string | null {
  const match = STATUS_MARKER_RE.exec(text);
  if (!match) return null;
  const phrase = match[1].trim();
  // Reject prompt-template leftovers like "<short plain-English phrase>".
  if (!phrase || /[<>]/.test(phrase)) return null;
  return phrase;
}

export function stripStatusMarkers(text: string): string {
  return text
    .replace(STATUS_MARKER_GLOBAL_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasVisibleNarrativeText(text: string): boolean {
  return Boolean(stripStatusMarkers(text));
}

function normalizeStatusText(text: string): string {
  return text.trim().toLowerCase();
}

function isRedundantAdjacentLine(lines: StatusLine[], nextText: string): boolean {
  const last = lines[lines.length - 1];
  if (!last) return false;
  return normalizeStatusText(last.text) === normalizeStatusText(nextText);
}

function isTextPartEligible(part: ActivityPart, includeStreaming: boolean): boolean {
  if ((part.type !== 'reasoning' && part.type !== 'text') || !part.text) {
    return false;
  }
  if (part.state !== 'streaming') return true;
  if (includeStreaming) return true;
  return parseStatusMarker(part.text) !== null;
}

function pushLine(
  lines: StatusLine[],
  text: string,
  base: number,
  index: number
): number {
  if (isRedundantAdjacentLine(lines, text)) return index;
  lines.push({ text, timestamp: base + index * 1000 });
  return index + 1;
}

export function extractStatusLinesFromParts(
  parts: ActivityPart[],
  baseTimestamp?: number,
  options?: { includeStreaming?: boolean }
): StatusLine[] {
  const base = baseTimestamp ?? Date.now();
  const includeStreaming = options?.includeStreaming ?? false;
  const lines: StatusLine[] = [];
  let index = 0;

  for (const part of parts) {
    if (isTextPartEligible(part, includeStreaming)) {
      const marker = parseStatusMarker(part.text!);
      if (marker) {
        index = pushLine(lines, marker, base, index);
      }
      continue;
    }

    if (isToolActivityPart(part) && !isPartInFlight(part)) {
      const toolName = getToolNameFromPart(part);
      if (isInternalTool(toolName)) continue;
      const label = getToolFriendlyLabel(toolName);
      index = pushLine(lines, label, base, index);
    }
  }

  return lines;
}

export function getLatestStatusMarker(parts: ActivityPart[]): string | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if ((part.type === 'reasoning' || part.type === 'text') && part.text) {
      const marker = parseStatusMarker(part.text);
      if (marker) return marker;
    }
  }
  return null;
}
