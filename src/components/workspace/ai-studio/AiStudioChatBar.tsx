'use client';

import {
  ArrowUp,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { SkillsPopup } from '@/components/workspace/ai-studio/SkillsPopup';
import { AssetMentionPill } from '@/components/workspace/ai-studio/AssetMentionPill';
import { TypewriterPlaceholder } from '@/components/workspace/ai-studio/TypewriterPlaceholder';
import {
  findMentionAtCaret,
  segmentAssetMentions,
  type TextSegment,
  type TaggedAsset,
} from '@/lib/agent/taggedAssets';

export type PendingAttachment = {
  id: string;
  objectUrl: string;
  downloadUrl: string | null;
  name: string;
  kind: 'video' | 'image';
  progress: number | null;
};

const HERO_ROTATING_PROMPTS = [
  'Generate a Educational Video for my students',
  'Generate LMS Ready Lecture',
  'Add karaoke captions to my video',
] as const;

type ModelOption = { id: string; label: string; value: string };

const MODEL_GROUPS: { company: string; models: ModelOption[] }[] = [
  {
    company: 'OkVevo',
    models: [{ id: 'okvevo', label: 'OkVevo Auto', value: 'anthropic/claude-sonnet-4-6' }],
  },
  {
    company: 'Anthropic',
    models: [
      { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
      { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
      { id: 'anthropic/claude-opus-4-8', label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4-8' },
    ],
  },
  {
    company: 'OpenAI',
    models: [
      { id: 'openai/gpt-5.3-codex', label: 'GPT-5.3 Codex', value: 'openai/gpt-5.3-codex' },
      { id: 'openai/gpt-5.4', label: 'GPT-5.4', value: 'openai/gpt-5.4' },
      { id: 'openai/gpt-5.5', label: 'GPT-5.5', value: 'openai/gpt-5.5' },
    ],
  },
  {
    company: 'Google',
    models: [{ id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', value: 'google/gemini-3.5-flash' }],
  },
  {
    company: 'xAI',
    models: [{ id: 'x-ai/grok-build-0.1', label: 'Grok Build 0.1', value: 'x-ai/grok-build-0.1' }],
  },
  {
    company: 'Moonshot',
    models: [{ id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code', value: 'moonshotai/kimi-k2.7-code' }],
  },
  {
    company: 'MiniMax',
    models: [{ id: 'minimax-m3', label: 'MiniMax M3', value: 'minimax/minimax-m3' }],
  },
];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

/** UI selection id → OpenRouter model slug (aliases share the same value). */
export function resolveModelApiValue(modelId: string): string {
  return ALL_MODELS.find((m) => m.id === modelId)?.value ?? modelId;
}

const PIPELINE_MODES = [
  { label: 'Ask me', value: 'ask' as const },
  { label: 'Auto Run', value: 'auto' as const },
];

const dropdownPanelClass =
  'absolute bottom-full z-50 mb-2 max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

const selectorBtnClass =
  'inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1c1c20]/80 px-2.5 py-1 text-sm transition hover:border-orange-500/25 hover:text-white/80';

const chatBoxClass =
  'relative overflow-visible rounded-[1.75rem] border border-[#222222] bg-[#141414] shadow-[0_8px_24px_rgba(0,0,0,0.55)]';

const iconBtnClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#222226] text-white/55 transition hover:bg-[#2a2a2e] hover:text-white/85 disabled:opacity-40';

function AssetThumb({
  asset,
  className,
}: {
  asset: TaggedAsset;
  className: string;
}) {
  if (asset.type === 'video') {
    return (
      <video
        src={asset.url}
        autoPlay
        muted
        loop
        playsInline
        className={`${className} object-cover`}
      />
    );
  }
  if (asset.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.url} alt={asset.label} className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-[#222226] text-white/45`}>
      <FileText size={16} strokeWidth={1.75} />
    </div>
  );
}

function fuzzyAssets(assets: TaggedAsset[], query: string): TaggedAsset[] {
  const needle = query.toLowerCase();
  return assets
    .flatMap((asset) => {
      const label = asset.label.toLowerCase();
      let cursor = 0;
      for (const char of needle) {
        cursor = label.indexOf(char, cursor);
        if (cursor < 0) return [];
        cursor++;
      }
      return [{ asset, score: label.startsWith(needle) ? 0 : cursor }];
    })
    .sort((a, b) => a.score - b.score || a.asset.label.localeCompare(b.asset.label))
    .map(({ asset }) => asset);
}

/** Overlay pills are wider than `@label` — paint caret from overlay geometry, not the textarea. */
function MentionOverlayContent({
  segments,
  caret,
  showCaret,
}: {
  segments: TextSegment[];
  caret: number;
  showCaret: boolean;
}) {
  const nodes: ReactNode[] = [];
  let pos = 0;
  let placed = false;

  const pushCaret = (key: string) => {
    if (!showCaret || placed) return;
    nodes.push(
      <span
        key={key}
        className="inline-block w-px animate-pulse bg-white align-baseline"
        style={{ height: '1em' }}
      />
    );
    placed = true;
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kind === 'mention') {
      const len = 1 + seg.label.length;
      if (!placed && caret <= pos) pushCaret(`c-before-${i}`);
      nodes.push(
        <AssetMentionPill key={`m-${i}-${seg.label}`} asset={seg.asset} />
      );
      pos += len;
      // Caret inside an atomic mention sits after the pill.
      if (!placed && caret <= pos) pushCaret(`c-after-${i}`);
    } else {
      const text = seg.text;
      if (!placed && caret >= pos && caret <= pos + text.length) {
        const split = caret - pos;
        if (split > 0) {
          nodes.push(<span key={`t-${i}-a`}>{text.slice(0, split)}</span>);
        }
        pushCaret(`c-${i}`);
        if (split < text.length) {
          nodes.push(<span key={`t-${i}-b`}>{text.slice(split)}</span>);
        }
      } else {
        nodes.push(<span key={`t-${i}`}>{text}</span>);
      }
      pos += text.length;
    }
  }
  if (!placed) pushCaret('c-end');
  return <>{nodes}</>;
}

export function AiStudioChatBar({
  variant = 'hero',
  input,
  setInput,
  selectedModel,
  setSelectedModel,
  status,
  isPreparingSend = false,
  durableLive = false,
  onSubmit,
  disabled = false,
  onPlusClick,
  pendingAttachments = [],
  maxAttachments = 2,
  activeSkill = null,
  onClearAttachment,
  pipelineMode = 'ask',
  setPipelineMode,
  onSkillSelect,
  inputRef,
  assets = [],
  onAssetSelect,
  selectedAssets = [],
  onAssetRemove,
}: {
  variant?: 'hero' | 'default';
  input: string;
  setInput: (value: string) => void;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  isPreparingSend?: boolean;
  durableLive?: boolean;
  onSubmit: () => void;
  disabled?: boolean;
  onPlusClick?: () => void;
  pendingAttachments?: PendingAttachment[];
  maxAttachments?: number;
  activeSkill?: string | null;
  onClearAttachment?: (id: string) => void;
  pipelineMode?: 'ask' | 'auto';
  setPipelineMode?: (mode: 'ask' | 'auto') => void;
  onSkillSelect: (skillId: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  assets?: TaggedAsset[];
  onAssetSelect?: (asset: TaggedAsset) => void;
  selectedAssets?: TaggedAsset[];
  onAssetRemove?: (asset: TaggedAsset) => void;
}) {
  const isHero = variant === 'hero';
  const sending =
    isPreparingSend || status === 'submitted' || status === 'streaming' || durableLive;
  const [modelOpen, setModelOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<{
    start: number;
    end: number;
    query: string;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMatches = mention ? fuzzyAssets(assets, mention.query) : [];
  const overlayRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [selCollapsed, setSelCollapsed] = useState(true);

  const activeModel = ALL_MODELS.find((m) => m.id === selectedModel) ?? ALL_MODELS[0];
  const activePipeline =
    PIPELINE_MODES.find((p) => p.value === pipelineMode) ?? PIPELINE_MODES[0];
  const showTypewriter = isHero && !input.trim();
  const readyCount = pendingAttachments.filter((a) => a.downloadUrl).length;
  const isUploading = pendingAttachments.some((a) => a.progress !== null);
  const atMaxAttachments = pendingAttachments.length >= maxAttachments;
  const canSend =
    (input.trim().length > 0 || readyCount > 0) &&
    !isUploading &&
    !sending &&
    status === 'ready';
  const mentionSegments = segmentAssetMentions(input, selectedAssets);
  const hasMentionPills = mentionSegments.some((s) => s.kind === 'mention');
  const showOverlayCaret =
    hasMentionPills && inputFocused && selCollapsed && !disabled && !sending;

  const syncCaretFromEl = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart ?? 0);
    setSelCollapsed(el.selectionStart === el.selectionEnd);
  };

  useEffect(() => {
    if (!modelOpen && !pipelineOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (modelOpen && !modelRef.current?.contains(e.target as Node)) {
        setModelOpen(false);
      }
      if (pipelineOpen && !pipelineRef.current?.contains(e.target as Node)) {
        setPipelineOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [modelOpen, pipelineOpen]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.query, assets]);

  // Grow with content up to max-h, then scroll inside.
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [input, inputRef, isHero]);

  const updateMention = (value: string, caret: number | null) => {
    if (caret === null) return setMention(null);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    if (!match) return setMention(null);
    const query = match[1];
    setMention({ start: caret - query.length - 1, end: caret, query });
  };

  const selectMention = (asset: TaggedAsset) => {
    if (!mention) return;
    const next = `${input.slice(0, mention.start)}@${asset.label} ${input.slice(
      mention.end
    )}`;
    const caret = mention.start + asset.label.length + 2;
    setInput(next);
    onAssetSelect?.(asset);
    setMention(null);
    requestAnimationFrame(() => {
      inputRef?.current?.focus();
      inputRef?.current?.setSelectionRange(caret, caret);
      if (inputRef?.current) syncCaretFromEl(inputRef.current);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const caretPos = e.currentTarget.selectionStart ?? 0;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const direction = e.key === 'Backspace' ? 'backspace' : 'delete';
      const hit = findMentionAtCaret(input, caretPos, selectedAssets, direction);
      if (hit) {
        e.preventDefault();
        const next = input.slice(0, hit.start) + input.slice(hit.end);
        setInput(next);
        onAssetRemove?.(hit.asset);
        requestAnimationFrame(() => {
          inputRef?.current?.focus();
          inputRef?.current?.setSelectionRange(hit.start, hit.start);
          if (inputRef?.current) syncCaretFromEl(inputRef.current);
        });
        return;
      }
    }
    if (mentionMatches.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex(
          (current) =>
            (current + direction + mentionMatches.length) % mentionMatches.length
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectMention(mentionMatches[mentionIndex]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`mx-auto w-full ${isHero ? 'max-w-4xl' : 'max-w-full'}`}>
      <div className={chatBoxClass}>
        <div className={`relative z-10 ${isHero ? 'px-4 pb-2 pt-2.5 sm:px-5' : 'px-4 pb-3.5 pt-4'}`}>
          {pendingAttachments.length > 0 || selectedAssets.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.id} className="relative h-[64px] w-[112px]">
                  {/* overflow-hidden stays on media only — video+spin in same overflow box freezes CSS rotate */}
                  <div className="h-full w-full overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
                    {attachment.kind === 'video' ? (
                      <video
                        src={attachment.objectUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.objectUrl}
                        alt={attachment.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  {attachment.progress !== null ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60">
                      <Loader2 size={22} className="animate-spin text-orange-500" />
                    </div>
                  ) : attachment.downloadUrl ? (
                    <button
                      type="button"
                      onClick={() => onClearAttachment?.(attachment.id)}
                      className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              ))}
              {selectedAssets
                .filter(
                  (asset) =>
                    !pendingAttachments.some((p) => p.downloadUrl === asset.url)
                )
                .map((asset) => (
                  <div
                    key={asset.id ?? asset.url}
                    className="relative h-[64px] w-[112px] overflow-hidden rounded-xl ring-1 ring-white/[0.08]"
                  >
                    <AssetThumb asset={asset} className="h-full w-full rounded-xl" />
                    <button
                      type="button"
                      onClick={() => onAssetRemove?.(asset)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
                      aria-label={`Remove ${asset.label}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
            </div>
          ) : null}
          <div className="relative">
            {mentionMatches.length > 0 ? (
              <div
                role="listbox"
                className="absolute bottom-full left-0 z-50 mb-2 max-h-52 w-72 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              >
                {mentionMatches.map((asset, index) => (
                  <button
                    key={asset.id ?? asset.url}
                    type="button"
                    role="option"
                    aria-selected={index === mentionIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectMention(asset)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${
                      index === mentionIndex
                        ? 'bg-white/[0.07] text-orange-300'
                        : 'text-white/70 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="h-8 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/[0.08]">
                      <AssetThumb asset={asset} className="h-full w-full" />
                    </div>
                    <span className="min-w-0 flex-1 truncate">@{asset.label}</span>
                    <span className="shrink-0 text-[10px] uppercase text-white/35">
                      {asset.type}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <TypewriterPlaceholder prompts={HERO_ROTATING_PROMPTS} active={showTypewriter} />
            {hasMentionPills ? (
              <div
                ref={overlayRef}
                aria-hidden
                className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-sm leading-normal text-white/90 ${
                  isHero ? 'min-h-[2.35rem]' : 'min-h-[3.5rem]'
                }`}
              >
                <MentionOverlayContent
                  segments={mentionSegments}
                  caret={caret}
                  showCaret={showOverlayCaret}
                />
              </div>
            ) : null}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                syncCaretFromEl(e.target);
                updateMention(e.target.value, e.target.selectionStart);
              }}
              onSelect={(e) => {
                syncCaretFromEl(e.currentTarget);
                updateMention(e.currentTarget.value, e.currentTarget.selectionStart);
              }}
              onKeyUp={(e) => syncCaretFromEl(e.currentTarget)}
              onClick={(e) => syncCaretFromEl(e.currentTarget)}
              onFocus={(e) => {
                setInputFocused(true);
                syncCaretFromEl(e.currentTarget);
              }}
              onBlur={() => setInputFocused(false)}
              onScroll={(e) => {
                if (overlayRef.current) {
                  overlayRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled || sending}
              placeholder={isHero ? '' : 'Describe your edit…'}
              rows={1}
              className={`relative z-10 w-full resize-none overflow-y-auto bg-transparent text-sm leading-normal outline-none disabled:opacity-40 ${
                hasMentionPills
                  ? 'text-transparent caret-transparent'
                  : 'text-white/90 caret-white'
              } ${
                isHero ? 'min-h-[2.35rem] max-h-[6rem]' : 'min-h-[3.5rem] max-h-[7rem]'
              }`}
            />
          </div>

          <div className={`flex items-center justify-between gap-3 ${isHero ? 'mt-1.5' : 'mt-2'}`}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className={iconBtnClass}
                aria-label="Upload"
                onClick={onPlusClick}
                disabled={isUploading || atMaxAttachments}
                title={
                  atMaxAttachments
                    ? `Maximum ${maxAttachments} attachments`
                    : 'Upload video or image'
                }
              >
                <Plus size={17} strokeWidth={1.75} />
              </button>

              <div className="relative" ref={modelRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSkillsOpen(false);
                    setPipelineOpen(false);
                    setModelOpen((o) => !o);
                  }}
                  className={selectorBtnClass}
                >
                  <span className="truncate font-medium text-white/75">{activeModel.label}</span>
                  <ChevronDown
                    size={13}
                    className={`shrink-0 text-white/30 transition ${modelOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {modelOpen ? (
                  <div className={`${dropdownPanelClass} left-0 w-56`}>
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.company}>
                        <div className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/35 first:pt-1">
                          {group.company}
                        </div>
                        {group.models.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(m.id);
                              setModelOpen(false);
                            }}
                            className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-white/[0.05] ${
                              m.id === selectedModel
                                ? 'text-orange-300'
                                : 'text-white/70'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {setPipelineMode ? (
                <div className="relative" ref={pipelineRef}>
                  <button
                    type="button"
                  onClick={() => {
                    setIsSkillsOpen(false);
                    setModelOpen(false);
                    setPipelineOpen((o) => !o);
                  }}
                    className={selectorBtnClass}
                  >
                    <span className="truncate font-medium text-white/75">
                      {activePipeline.label}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-white/30 transition ${pipelineOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {pipelineOpen ? (
                    <div className={`${dropdownPanelClass} right-0 w-40`}>
                      {PIPELINE_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => {
                            setPipelineMode(mode.value);
                            setPipelineOpen(false);
                          }}
                          className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-white/[0.05] ${
                            mode.value === pipelineMode
                              ? 'text-orange-300'
                              : 'text-white/70'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setModelOpen(false);
                    setPipelineOpen(false);
                    setIsSkillsOpen((o) => !o);
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-1 py-1 text-sm text-white/45 hover:text-white/70"
                >
                  <span className="hidden sm:inline">Skills</span>
                  <ChevronDown
                    size={13}
                    className={`text-white/30 transition ${isSkillsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <SkillsPopup
                  isOpen={isSkillsOpen}
                  onClose={() => setIsSkillsOpen(false)}
                  onSelectSkill={(skillId) => {
                    onSkillSelect(skillId);
                    setIsSkillsOpen(false);
                  }}
                />
              </div>
              <button
                type="button"
                disabled={!canSend}
                onClick={onSubmit}
                className={`flex items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-400 disabled:bg-white/10 disabled:text-white/30 ${
                  isHero ? 'h-8 w-8' : 'h-9 w-9'
                }`}
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ArrowUp size={17} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      {!isHero ? (
        <p className="mt-1 text-center text-xs text-white/35">
          Nia can make mistakes. Please double-check responses.
        </p>
      ) : null}
    </div>
  );
}
