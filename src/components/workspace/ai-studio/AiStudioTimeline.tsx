'use client';

import { AgentActivityTrace } from '@/components/workspace/ai-studio/AgentActivityTrace';
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
}: {
  messages: TimelineMessage[];
  streamingAssistantId?: string | null;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="ai-studio-timeline-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className={`${AI_STUDIO_CHAT_COLUMN} flex flex-col gap-6 pt-6 pb-4`}>
        {messages.map((message) => {
          const time = message.createdAt ? formatMessageTime(message.createdAt) : null;
          if (message.role === 'user') {
            const text = getUserText(message.parts);
            return (
              <div key={message.id} className="flex w-full justify-end">
                <div className="flex max-w-[min(100%,42rem)] flex-col items-end gap-2">
                  {message.videoUrl ? (
                    <div className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
                      <video
                        src={message.videoUrl}
                        controls
                        playsInline
                        className="max-h-52 w-full max-w-[min(100%,20rem)] bg-black object-cover"
                      />
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
                />
              </div>
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
