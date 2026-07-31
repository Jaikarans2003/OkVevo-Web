'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Clock } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { IDLE_STATUS_WORDS, getToolFriendlyLabel } from '@/lib/agent/friendlyStatus';
import {
  extractStatusLinesFromParts,
  getLatestStatusMarker,
  type ActivityPart,
  type StatusLine,
} from '@/lib/agent/parseStatusMarker';
import {
  getToolNameFromPart,
  isPartInFlight,
  isToolActivityPart,
} from '@/lib/agent-tool-summaries';

const IDLE_ROTATION_MS = 2500;
const LOADING_VIDEO = '/videos/OkVevo_Loading_GIF.mp4';

function getLatestCompletedToolLabel(parts: ActivityPart[]): string | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (!isToolActivityPart(part) || isPartInFlight(part)) continue;
    return getToolFriendlyLabel(getToolNameFromPart(part));
  }
  return null;
}

function hasInFlightTools(parts: ActivityPart[]): boolean {
  return parts.some((part) => isToolActivityPart(part) && isPartInFlight(part));
}

function StatusToggleRow({
  label,
  showChevron,
  showVideo,
}: {
  label: string;
  showChevron: boolean;
  showVideo: boolean;
}) {
  return (
    <CollapsibleTrigger className="flex min-w-0 items-center gap-2 text-left text-sm text-white/80 transition-opacity hover:opacity-90">
      {showVideo ? (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-[0_3px_10px_rgba(0,0,0,0.5),0_0_14px_-3px_rgba(249,115,22,0.55)] ring-1 ring-orange-500/30">
          <video
            src={LOADING_VIDEO}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <span className="truncate font-medium">{label}</span>
      {showChevron ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-data-[state=open]:rotate-180" />
      ) : null}
    </CollapsibleTrigger>
  );
}

export function AgentConsumerStatus({
  variant,
  parts,
  isStreaming = false,
  isTurnComplete = false,
  messageCreatedAt,
}: {
  variant: 'live' | 'history';
  parts: ActivityPart[];
  isStreaming?: boolean;
  isTurnComplete?: boolean;
  messageCreatedAt?: string;
}) {
  const [idleIndex, setIdleIndex] = useState(0);
  const [liveLines, setLiveLines] = useState<StatusLine[]>([]);
  const emittedTrailCountRef = useRef(0);

  const baseTimestamp = useMemo(() => {
    if (messageCreatedAt) {
      const parsed = new Date(messageCreatedAt).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Date.now();
  }, [messageCreatedAt]);

  const historyLines = useMemo(
    () => extractStatusLinesFromParts(parts, baseTimestamp),
    [parts, baseTimestamp]
  );

  useEffect(() => {
    if (variant !== 'live') return;

    const trail = extractStatusLinesFromParts(parts);
    if (trail.length > emittedTrailCountRef.current) {
      const newLines = trail.slice(emittedTrailCountRef.current);
      setLiveLines((prev) => [
        ...prev,
        ...newLines.map((line) => ({ ...line, timestamp: Date.now() })),
      ]);
    }
    emittedTrailCountRef.current = trail.length;
  }, [parts, variant]);

  const statusLines =
    variant === 'history'
      ? historyLines.length > 0
        ? historyLines
        : liveLines
      : liveLines;
  const showDone =
    isTurnComplete && !hasInFlightTools(parts) && (variant === 'history' || !isStreaming);
  const dropdownLines = showDone
    ? [...statusLines, { text: 'Done', timestamp: Date.now() }]
    : statusLines;

  const latestMarker = getLatestStatusMarker(parts);
  const latestToolLabel = getLatestCompletedToolLabel(parts);
  const showLiveHeader = variant === 'live';

  const collapsedLabel =
    latestMarker ?? latestToolLabel ?? IDLE_STATUS_WORDS[idleIndex];

  useEffect(() => {
    if (variant !== 'live' || latestMarker || latestToolLabel) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIdleIndex((current) => (current + 1) % IDLE_STATUS_WORDS.length);
    }, IDLE_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [variant, latestMarker, latestToolLabel]);

  if (variant === 'history' && dropdownLines.length === 0) {
    return null;
  }

  const historyToggleLabel =
    latestMarker ?? latestToolLabel ?? statusLines[0]?.text ?? 'Done';

  return (
    <Collapsible defaultOpen={false} className="group">
      {showLiveHeader ? (
        <div className="mb-1">
          <StatusToggleRow label={collapsedLabel} showChevron showVideo />
        </div>
      ) : (
        <StatusToggleRow
          label={historyToggleLabel}
          showChevron
          showVideo={false}
        />
      )}

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <ul className="mt-2">
          {dropdownLines.map((line, index) => {
            const isDoneLine = showDone && index === dropdownLines.length - 1;
            const isLast = index === dropdownLines.length - 1;
            return (
              <li
                key={`${line.text}-${line.timestamp}-${index}`}
                className="flex gap-2.5 text-sm text-white/70"
              >
                <div className="flex w-3.5 shrink-0 flex-col items-center">
                  {isDoneLine ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 text-white/50" />
                  ) : (
                    <Clock className="mt-0.5 h-3.5 w-3.5 text-white/35" />
                  )}
                  {!isLast ? (
                    <span aria-hidden className="mt-1 w-px flex-1 bg-white/15" />
                  ) : null}
                </div>
                <span className={`min-w-0 flex-1 ${isLast ? '' : 'pb-2.5'}`}>
                  {line.text}
                </span>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
