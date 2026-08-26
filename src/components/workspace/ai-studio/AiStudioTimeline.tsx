'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentActivityTrace } from '@/components/workspace/ai-studio/AgentActivityTrace';
import { AgentConsumerStatus } from '@/components/workspace/ai-studio/AgentConsumerStatus';
import {
  CheckpointCard,
  isCheckpointResolved,
  winningCheckpointIdsByMessage,
  type CheckpointCardData,
} from '@/components/workspace/ai-studio/CheckpointCard';
import {
  AI_STUDIO_CHAT_BODY_CLASS,
  AI_STUDIO_CHAT_COLUMN,
  AI_STUDIO_CHAT_PROSE_CLASS,
} from '@/components/workspace/ai-studio/constants';
import { isAgentDevTrace } from '@/lib/agent/agentTraceMode';
import { cleanNarrativeText } from '@/lib/agent/cleanNarrativeText';
import {
  segmentAssetMentions,
  type TaggedAsset,
} from '@/lib/agent/taggedAssets';
import { cn } from '@/lib/utils';
import { AssetMentionPill } from '@/components/workspace/ai-studio/AssetMentionPill';

const NEAR_BOTTOM_PX = 80;

interface TimelineMessagePart {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
  data?: CheckpointCardData;
}

export interface TimelineMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: TimelineMessagePart[];
  createdAt?: string;
  videoUrl?: string;
  videoName?: string;
  imageUrl?: string;
  mediaUrls?: string[];
  mediaNames?: string[];
  taggedAssets?: TaggedAsset[];
}

const MARKDOWN_PLUGINS = [remarkGfm];

function isLikelyImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function MediaThumb({ url }: { url: string }) {
  if (isLikelyImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="aspect-video w-full bg-black object-cover"
      />
    );
  }
  return (
    <video
      src={url}
      controls
      playsInline
      className="aspect-video w-full bg-black object-cover"
    />
  );
}

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getUserText(parts: TimelineMessagePart[]): string {
  return parts
    .filter((part): part is TimelineMessagePart & { type: 'text'; text: string } =>
      part.type === 'text' && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');
}

function UserBubbleText({
  text,
  taggedAssets,
}: {
  text: string;
  taggedAssets?: TaggedAsset[];
}) {
  const segments = segmentAssetMentions(text, taggedAssets ?? []);
  if (!segments.some((s) => s.kind === 'mention')) {
    return <>{text}</>;
  }
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === 'mention' ? (
          <AssetMentionPill key={`m-${i}-${seg.label}`} asset={seg.asset} />
        ) : (
          <span key={`t-${i}`}>{seg.text}</span>
        )
      )}
    </>
  );
}

function isCheckpointPart(
  part: TimelineMessagePart
): part is TimelineMessagePart & { data: CheckpointCardData } {
  return part.type === 'data-checkpoint' && (part as { data?: unknown }).data != null;
}

function mergeAdjacentText(
  parts: TimelineMessagePart[]
): TimelineMessagePart[] {
  const out: TimelineMessagePart[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (part.type === 'text' && last?.type === 'text') {
      out[out.length - 1] = {
        ...last,
        text: `${last.text ?? ''}${part.text ?? ''}`,
      };
    } else {
      out.push(part);
    }
  }
  return out;
}

function ConsumerAssistantBody({
  parts,
  showTextCursor,
  pendingCheckpointId,
  allowedCheckpointIds,
}: {
  parts: TimelineMessagePart[];
  showTextCursor?: boolean;
  pendingCheckpointId?: string | null;
  allowedCheckpointIds?: Set<string>;
}) {
  const lastTextIndex = parts.reduce((last, part, index) => {
    if (part.type !== 'text' || !part.text?.trim()) return last;
    // ponytail: narrative check after strip so marker-only parts don't steal the cursor
    return cleanNarrativeText(part.text, { scrubStackNames: true }) ? index : last;
  }, -1);

  return (
    <>
      {parts.map((part, index) => {
        if (isCheckpointPart(part)) {
          const data = (part as { data: CheckpointCardData }).data;
          if (allowedCheckpointIds && !allowedCheckpointIds.has(data.checkpointId)) {
            return null;
          }
          // Pending interactive UI lives in the floating card only.
          if (!isCheckpointResolved(data, pendingCheckpointId)) return null;
          return (
            <CheckpointCard
              key={`checkpoint-${data.checkpointId}`}
              data={data}
            />
          );
        }

        if (part.type === 'text' && part.text?.trim()) {
          const cleaned = cleanNarrativeText(part.text, { scrubStackNames: true });
          // Marker-only text: hide entirely (no cursor-only bubble).
          if (!cleaned) return null;
          return (
            <div
              key={`text-${index}`}
              className={cn(AI_STUDIO_CHAT_BODY_CLASS, 'text-white/90')}
            >
              <div className={AI_STUDIO_CHAT_PROSE_CLASS}>
                <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{cleaned}</ReactMarkdown>
                {showTextCursor && index === lastTextIndex ? (
                  <span className="ml-0.5 inline-block animate-pulse text-orange-400">▍</span>
                ) : null}
              </div>
            </div>
          );
        }

        return null;
      })}
    </>
  );
}

function AssistantMedia({ message }: { message: TimelineMessage }) {
  const time = message.createdAt ? formatMessageTime(message.createdAt) : null;
  return (
    <>
      {message.imageUrl ? (
        <div className="mt-3 w-full max-w-xl overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.imageUrl}
            alt="Generated image"
            className="aspect-video w-full bg-black object-contain"
          />
        </div>
      ) : null}
      {message.videoUrl ? (
        <div className="mt-3 w-full max-w-xl overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
          <video
            src={message.videoUrl}
            controls
            playsInline
            className="aspect-video w-full bg-black object-cover"
          />
        </div>
      ) : null}
      {time ? (
        <span className="mt-1.5 block text-xs text-white/30">{time}</span>
      ) : null}
    </>
  );
}

export function AiStudioTimeline({
  messages,
  streamingAssistantId,
  isPendingTurn = false,
  isPreparingSend = false,
  durableLive = false,
  chatStatus = 'ready',
  bottomRef,
  pendingCheckpointId,
}: {
  messages: TimelineMessage[];
  streamingAssistantId?: string | null;
  isPendingTurn?: boolean;
  isPreparingSend?: boolean;
  durableLive?: boolean;
  chatStatus?: 'submitted' | 'streaming' | 'ready' | 'error';
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  pendingCheckpointId?: string | null;
}) {
  const devTrace = isAgentDevTrace();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastAssistantIndex = messages.reduce(
    (last, message, index) => (message.role === 'assistant' ? index : last),
    -1
  );
  const allowedByMessage = winningCheckpointIdsByMessage(messages);
  const showLiveStatus =
    !devTrace && (isPreparingSend || isPendingTurn || durableLive);
  const lastAssistant =
    lastAssistantIndex >= 0 ? messages[lastAssistantIndex] : null;
  const pinnedLiveIdRef = useRef<string | null>(null);
  if (!showLiveStatus) {
    pinnedLiveIdRef.current = null;
  } else if (streamingAssistantId) {
    pinnedLiveIdRef.current = streamingAssistantId;
  } else if (
    pinnedLiveIdRef.current == null &&
    durableLive &&
    chatStatus === 'ready' &&
    !isPreparingSend &&
    lastAssistant?.role === 'assistant'
  ) {
    pinnedLiveIdRef.current = lastAssistant.id;
  }
  const liveLast =
    showLiveStatus && pinnedLiveIdRef.current
      ? (messages.find((m) => m.id === pinnedLiveIdRef.current) ?? null)
      : null;
  const liveIndex = liveLast
    ? messages.findIndex((m) => m.id === liveLast.id)
    : -1;
  const visibleMessages =
    liveIndex >= 0 ? messages.slice(0, liveIndex) : messages;

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const updateStickFromScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    if (chatStatus === 'submitted' || isPreparingSend) {
      stickToBottomRef.current = true;
      scrollToBottom();
    }
  }, [chatStatus, isPreparingSend]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom();
  }, [messages, isPendingTurn, isPreparingSend, streamingAssistantId, showLiveStatus]);

  return (
    <div
      ref={scrollRef}
      onScroll={updateStickFromScroll}
      className="ai-studio-timeline-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto"
    >      <div className={`${AI_STUDIO_CHAT_COLUMN} flex flex-col gap-6 pt-6 pb-4`}>
        {visibleMessages.map((message, messageIndex) => {
          const time = message.createdAt ? formatMessageTime(message.createdAt) : null;
          if (message.role === 'user') {
            const text = getUserText(message.parts);
            const urls =
              message.mediaUrls && message.mediaUrls.length > 0
                ? message.mediaUrls
                : message.videoUrl
                  ? [message.videoUrl]
                  : [];
            return (
              <div key={message.id} className="flex w-full justify-end">
                <div className="flex max-w-[min(100%,42rem)] flex-col items-end gap-2">
                  {urls.length > 0 ? (
                    <div className="flex w-full max-w-sm flex-col gap-2">
                      {urls.map((url) => (
                        <div
                          key={url}
                          className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]"
                        >
                          <MediaThumb url={url} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {text ? (
                    <div
                      className={`rounded-3xl bg-[#2f2f2f] px-4 py-3 ${AI_STUDIO_CHAT_BODY_CLASS} whitespace-pre-wrap text-white/95`}
                    >
                      <UserBubbleText
                        text={text}
                        taggedAssets={message.taggedAssets}
                      />
                    </div>
                  ) : null}
                  {time ? (
                    <span className="mt-1.5 px-1 text-xs text-white/30">{time}</span>
                  ) : null}
                </div>
              </div>
            );
          }

          const isStreaming = streamingAssistantId === message.id;
          const isLastAssistant = messageIndex === lastAssistantIndex;
          const isTurnComplete = isLastAssistant ? chatStatus === 'ready' : true;
          const parts = mergeAdjacentText(message.parts);
          const allowedCheckpointIds = allowedByMessage.get(message.id);

          return (
            <div key={message.id} className="w-full">
              <div className={`w-full space-y-3 py-1 ${AI_STUDIO_CHAT_BODY_CLASS}`}>
                {devTrace ? (
                  <AgentActivityTrace
                    parts={parts}
                    isStreaming={isStreaming}
                    showTextCursor={isStreaming}
                    pendingCheckpointId={pendingCheckpointId}
                    allowedCheckpointIds={allowedCheckpointIds}
                  />
                ) : (
                  <>
                    <AgentConsumerStatus
                      variant="history"
                      parts={parts}
                      isTurnComplete={isTurnComplete}
                      messageCreatedAt={message.createdAt}
                    />
                    <ConsumerAssistantBody
                      parts={parts}
                      showTextCursor={isStreaming}
                      pendingCheckpointId={pendingCheckpointId}
                      allowedCheckpointIds={allowedCheckpointIds}
                    />
                  </>
                )}
              </div>
              <AssistantMedia message={message} />
            </div>
          );
        })}
        {showLiveStatus ? (
          <div key="live-consumer-host" className="w-full py-1">
            <AgentConsumerStatus
              variant="live"
              parts={liveLast ? mergeAdjacentText(liveLast.parts) : []}
              isStreaming={chatStatus !== 'ready' || isPreparingSend || durableLive}
              isTurnComplete={false}
              messageCreatedAt={liveLast?.createdAt}
            />
          </div>
        ) : null}
        {liveLast && !devTrace ? (
          <div key={liveLast.id} className="w-full">
            <div className={`w-full space-y-3 py-1 ${AI_STUDIO_CHAT_BODY_CLASS}`}>
              <ConsumerAssistantBody
                parts={mergeAdjacentText(liveLast.parts)}
                showTextCursor={streamingAssistantId === liveLast.id}
                pendingCheckpointId={pendingCheckpointId}
                allowedCheckpointIds={allowedByMessage.get(liveLast.id)}
              />
            </div>
            <AssistantMedia message={liveLast} />
          </div>
        ) : null}
        {liveLast && devTrace ? (
          <div key={liveLast.id} className="w-full">
            <div className={`w-full space-y-3 py-1 ${AI_STUDIO_CHAT_BODY_CLASS}`}>
              <AgentActivityTrace
                parts={mergeAdjacentText(liveLast.parts)}
                isStreaming={streamingAssistantId === liveLast.id}
                showTextCursor={streamingAssistantId === liveLast.id}
                pendingCheckpointId={pendingCheckpointId}
                allowedCheckpointIds={allowedByMessage.get(liveLast.id)}
              />
            </div>
            <AssistantMedia message={liveLast} />
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
