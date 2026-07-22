'use client';

import { AgentActivityTrace } from '@/components/workspace/ai-studio/AgentActivityTrace';
import type { CheckpointAnswerPayload } from '@/components/workspace/ai-studio/CheckpointCard';
import {
  AI_STUDIO_CHAT_BODY_CLASS,
  AI_STUDIO_CHAT_COLUMN,
} from '@/components/workspace/ai-studio/constants';

interface TimelineMessagePart {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
}

export interface TimelineMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: TimelineMessagePart[];
  createdAt?: string;
  videoUrl?: string;
  videoName?: string;
  mediaUrls?: string[];
  mediaNames?: string[];
}

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

export function AiStudioTimeline({
  messages,
  streamingAssistantId,
  bottomRef,
  onCheckpointAnswer,
  pendingCheckpointId,
}: {
  messages: TimelineMessage[];
  streamingAssistantId?: string | null;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  onCheckpointAnswer?: (checkpointId: string, answer: CheckpointAnswerPayload) => void;
  pendingCheckpointId?: string | null;
}) {
  return (
    <div className="ai-studio-timeline-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className={`${AI_STUDIO_CHAT_COLUMN} flex flex-col gap-6 pt-6 pb-4`}>
        {messages.map((message) => {
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
                      className={`rounded-3xl bg-[#2f2f2f] px-4 py-3 ${AI_STUDIO_CHAT_BODY_CLASS} text-white/95`}
                    >
                      {text}
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

          return (
            <div key={message.id} className="w-full">
              <div className={`w-full py-1 ${AI_STUDIO_CHAT_BODY_CLASS}`}>
                <AgentActivityTrace
                  parts={message.parts}
                  isStreaming={isStreaming}
                  showTextCursor={isStreaming}
                  onCheckpointAnswer={onCheckpointAnswer}
                  checkpointInteractionDisabled={
                    pendingCheckpointId != null &&
                    !message.parts.some(
                      (p) =>
                        p.type === 'data-checkpoint' &&
                        (p as { data?: { checkpointId?: string } }).data?.checkpointId ===
                          pendingCheckpointId
                    )
                  }
                />
              </div>
              {message.videoUrl ? (
                <div className="mt-3 w-full max-w-xl overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
                  <video
                    src={message.videoUrl}
                    controls
                    playsInline
                    className="aspect-video w-full bg-black object-cover"
                  />
                  <a
                    href={message.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white/[0.03] px-3 py-2 text-xs text-orange-300/90 transition hover:text-orange-200"
                  >
                    Open video URL
                  </a>
                </div>
              ) : null}
              {time ? (
                <span className="mt-1.5 block text-xs text-white/30">{time}</span>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
