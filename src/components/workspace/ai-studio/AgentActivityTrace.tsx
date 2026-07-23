'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, CodeBlockCode } from '@/components/ui/code-block';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ThinkingBar } from '@/components/ui/thinking-bar';
import {
  AI_STUDIO_CHAT_BODY_CLASS,
  AI_STUDIO_CHAT_PROSE_CLASS,
} from '@/components/workspace/ai-studio/constants';
import {
  getToolNameFromPart,
  isPartInFlight,
  isToolActivityPart,
  summarizeToolPart,
} from '@/lib/agent-tool-summaries';
import { cn } from '@/lib/utils';
import {
  CheckpointCard,
  type CheckpointAnswerPayload,
  type CheckpointCardData,
} from '@/components/workspace/ai-studio/CheckpointCard';
import {
  CheckCircle,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from 'lucide-react';

const MARKDOWN_PLUGINS = [remarkGfm];

/** Hide storage/media URLs in chat — assets render as photo/video, not links. */
function stripAssetUrls(text: string): string {
  return text
    .replace(
      /https?:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com|v\d*\.fal\.media)\S*/gi,
      ''
    )
    .replace(
      /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|mkv)(?:\?\S*)?/gi,
      ''
    )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type ActivityPart = {
  type: string;
  text?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
  data?: CheckpointCardData;
};

function isCheckpointPart(part: ActivityPart): part is ActivityPart & { data: CheckpointCardData } {
  return part.type === 'data-checkpoint' && part.data != null;
}

function formatJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStateIcon(state?: string) {
  switch (state) {
    case 'input-streaming':
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />;
    case 'input-available':
      return <Settings className="h-3.5 w-3.5 shrink-0 text-orange-400" />;
    case 'output-available':
      return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    case 'output-error':
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
    default:
      return <Settings className="h-3.5 w-3.5 shrink-0 text-white/40" />;
  }
}

function AssistantMarkdown({
  content,
  showCursor,
}: {
  content: string;
  showCursor?: boolean;
}) {
  const cleaned = stripAssetUrls(content);
  if (!cleaned && !showCursor) return null;
  return (
    <div className={AI_STUDIO_CHAT_PROSE_CLASS}>
      {cleaned ? (
        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{cleaned}</ReactMarkdown>
      ) : null}
      {showCursor ? (
        <span className="ml-0.5 inline-block animate-pulse text-orange-400">▍</span>
      ) : null}
    </div>
  );
}

function ActivityToolCard({
  part,
  defaultOpen,
}: {
  part: ActivityPart;
  defaultOpen: boolean;
}) {
  const summary = summarizeToolPart(part);
  const toolName = getToolNameFromPart(part);
  const output = part.output;
  const input = part.input;
  const isRunCommand = toolName === 'run_command';
  const stdout =
    isRunCommand && output && typeof output === 'object'
      ? (output as Record<string, unknown>).stdout
      : undefined;
  const stderr =
    isRunCommand && output && typeof output === 'object'
      ? (output as Record<string, unknown>).stderr
      : undefined;

  return (
    <Collapsible defaultOpen={defaultOpen} className="group">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.05]">
        {getStateIcon(part.state)}
        <span className="min-w-0 flex-1 truncate font-medium">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-2 space-y-2 rounded-lg border border-white/[0.06] bg-[#141414] p-3">
          <div className="text-xs font-mono uppercase tracking-wide text-white/30">
            {toolName}
          </div>
          {input !== undefined ? (
            <div>
              <p className="mb-1 text-xs text-white/40">Input</p>
              <CodeBlock className="border-white/10 bg-black/40">
                <CodeBlockCode
                  code={formatJson(input)}
                  language="json"
                  theme="github-dark"
                />
              </CodeBlock>
            </div>
          ) : null}
          {output !== undefined ? (
            <div>
              <p className="mb-1 text-xs text-white/40">Output</p>
              {isRunCommand && (stdout || stderr) ? (
                <div className="space-y-2">
                  {typeof stdout === 'string' && stdout.length > 0 ? (
                    <CodeBlock className="border-white/10 bg-black/40">
                      <CodeBlockCode code={stdout} language="bash" theme="github-dark" />
                    </CodeBlock>
                  ) : null}
                  {typeof stderr === 'string' && stderr.length > 0 ? (
                    <CodeBlock className="border-red-500/20 bg-red-950/20">
                      <CodeBlockCode code={stderr} language="bash" theme="github-dark" />
                    </CodeBlock>
                  ) : null}
                </div>
              ) : (
                <CodeBlock className="border-white/10 bg-black/40">
                  <CodeBlockCode
                    code={formatJson(output)}
                    language="json"
                    theme="github-dark"
                  />
                </CodeBlock>
              )}
            </div>
          ) : null}
          {part.state === 'output-error' && part.errorText ? (
            <p className="text-sm text-red-400">{part.errorText}</p>
          ) : null}
          {part.state === 'input-streaming' ? (
            <p className="text-xs text-white/40">Running…</p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningCard({
  text,
  defaultOpen,
}: {
  text: string;
  defaultOpen: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-sm text-white/60 transition-colors hover:bg-white/[0.05]">
        <span className="font-medium">Reasoning</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-[#141414] p-3 text-sm text-white/60">
          {text}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentActivityTrace({
  parts,
  isStreaming = false,
  showTextCursor = false,
  className,
  onCheckpointAnswer,
  checkpointInteractionDisabled = false,
}: {
  parts: ActivityPart[];
  isStreaming?: boolean;
  showTextCursor?: boolean;
  className?: string;
  onCheckpointAnswer?: (checkpointId: string, answer: CheckpointAnswerPayload) => void;
  checkpointInteractionDisabled?: boolean;
}) {
  const hasInFlightTools = parts.some(
    (part) => isToolActivityPart(part) && isPartInFlight(part)
  );

  const lastActivityIndex = parts.reduce(
    (last, part, index) =>
      part.type === 'reasoning' || isToolActivityPart(part) ? index : last,
    -1
  );

  const lastTextIndex = parts.reduce(
    (last, part, index) =>
      part.type === 'text' && part.text?.trim() ? index : last,
    -1
  );

  const hasRenderableParts = parts.some(
    (part) =>
      part.type === 'reasoning' ||
      isToolActivityPart(part) ||
      isCheckpointPart(part) ||
      (part.type === 'text' && part.text?.trim())
  );

  if (!hasRenderableParts) {
    return null;
  }

  const hasActivityParts = parts.some(
    (part) => part.type === 'reasoning' || isToolActivityPart(part)
  );

  return (
    <div className={cn('space-y-3', className)}>
      {isStreaming && hasInFlightTools ? (
        <ThinkingBar text="Working…" className="text-white/50" />
      ) : null}

      {hasActivityParts ? (
        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          {parts.map((part, index) => {
            if (part.type === 'reasoning' && part.text) {
              const isActive =
                isStreaming &&
                index === lastActivityIndex &&
                part.state === 'streaming';
              return (
                <ReasoningCard
                  key={`reasoning-${index}`}
                  text={part.text}
                  defaultOpen={isActive}
                />
              );
            }

            if (isToolActivityPart(part)) {
              const isActive =
                isStreaming && index === lastActivityIndex && isPartInFlight(part);
              return (
                <ActivityToolCard
                  key={part.toolCallId ?? `tool-${index}`}
                  part={part}
                  defaultOpen={isActive}
                />
              );
            }

            return null;
          })}
        </div>
      ) : null}

      {parts.map((part, index) => {
        if (isCheckpointPart(part) && onCheckpointAnswer) {
          return (
            <CheckpointCard
              key={`checkpoint-${part.data.checkpointId}`}
              data={part.data}
              disabled={checkpointInteractionDisabled || isStreaming}
              onAnswer={onCheckpointAnswer}
            />
          );
        }

        if (part.type === 'text' && part.text?.trim()) {
          const cleaned = stripAssetUrls(part.text);
          if (!cleaned && !(showTextCursor && index === lastTextIndex)) {
            return null;
          }
          return (
            <div
              key={`text-${index}`}
              className={cn(AI_STUDIO_CHAT_BODY_CLASS, 'text-white/90')}
            >
              <AssistantMarkdown
                content={part.text}
                showCursor={showTextCursor && index === lastTextIndex}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
