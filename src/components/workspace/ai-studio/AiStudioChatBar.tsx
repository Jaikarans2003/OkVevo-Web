'use client';

import {
  ArrowUp,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { SkillsPopup } from '@/components/workspace/ai-studio/SkillsPopup';
import { TypewriterPlaceholder } from '@/components/workspace/ai-studio/TypewriterPlaceholder';

export type PendingAttachment = {
  id: string;
  objectUrl: string;
  downloadUrl: string | null;
  name: string;
  kind: 'video' | 'image';
  progress: number | null;
};

const HERO_ROTATING_PROMPTS = [
  'Generate a short drama',
  'Make a cinematic trailer for my brand',
  'Add karaoke captions to my video',
  'Cut my interview into vertical clips',
] as const;

type ModelOption = { label: string; value: string };

const MODEL_GROUPS: { company: string; models: ModelOption[] }[] = [
  {
    company: 'OkVevo',
    models: [{ label: 'OkVevo', value: 'minimax/minimax-m3' }],
  },
  {
    company: 'Anthropic',
    models: [
      { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
      { label: 'Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
      { label: 'Claude Opus 4.8', value: 'anthropic/claude-opus-4-8' },
    ],
  },
  {
    company: 'OpenAI',
    models: [
      { label: 'GPT-5.3 Codex', value: 'openai/gpt-5.3-codex' },
      { label: 'GPT-5.4', value: 'openai/gpt-5.4' },
      { label: 'GPT-5.5', value: 'openai/gpt-5.5' },
    ],
  },
  {
    company: 'Google',
    models: [{ label: 'Gemini 3.5 Flash', value: 'google/gemini-3.5-flash' }],
  },
  {
    company: 'xAI',
    models: [{ label: 'Grok Build 0.1', value: 'x-ai/grok-build-0.1' }],
  },
  {
    company: 'Moonshot',
    models: [{ label: 'Kimi K2.7 Code', value: 'moonshotai/kimi-k2.7-code' }],
  },
  {
    company: 'MiniMax',
    models: [{ label: 'MiniMax M3', value: 'minimax/minimax-m3' }],
  },
];

const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

const PIPELINE_MODES = [
  { label: 'Ask me', value: 'ask' as const },
  { label: 'Auto Run', value: 'auto' as const },
];

const dropdownPanelClass =
  'absolute bottom-full z-50 mb-2 max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

const selectorBtnClass =
  'inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1c1c20]/80 px-2.5 py-1 text-sm transition hover:border-orange-500/25 hover:text-white/80';

const chatBoxClass =
  'relative overflow-visible rounded-[1.75rem] border border-white/[0.06] bg-[#141414]/95 shadow-[0_4px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm';

const iconBtnClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#222226] text-white/55 transition hover:bg-[#2a2a2e] hover:text-white/85 disabled:opacity-40';

export function AiStudioChatBar({
  variant = 'hero',
  input,
  setInput,
  selectedModel,
  setSelectedModel,
  status,
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
}: {
  variant?: 'hero' | 'default';
  input: string;
  setInput: (value: string) => void;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
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
}) {
  const isHero = variant === 'hero';
  const sending = status === 'submitted' || status === 'streaming';
  const [modelOpen, setModelOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const skillsButtonRef = useRef<HTMLButtonElement>(null);

  const activeModel = ALL_MODELS.find((m) => m.value === selectedModel) ?? ALL_MODELS[0];
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
  const showEduVideoHint =
    activeSkill === 'edu-video' && readyCount > 0 && !isUploading;
  const showRemoveBgHint =
    activeSkill === 'remove-background' && readyCount > 0 && !isUploading;
  const showCompositeHint =
    activeSkill === 'composite-subject' && readyCount >= 2 && !isUploading;

  useEffect(() => {
    if (!modelOpen && !pipelineOpen && !isSkillsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (modelOpen && !modelRef.current?.contains(e.target as Node)) {
        setModelOpen(false);
      }
      if (pipelineOpen && !pipelineRef.current?.contains(e.target as Node)) {
        setPipelineOpen(false);
      }
      if (isSkillsOpen && !skillsRef.current?.contains(e.target as Node)) {
        setIsSkillsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [modelOpen, pipelineOpen, isSkillsOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`mx-auto w-full ${isHero ? 'max-w-4xl' : 'max-w-full'}`}>
      <div className={chatBoxClass}>
        <div className={`relative z-10 px-4 sm:px-5 ${isHero ? 'pb-2 pt-2.5' : 'pb-3 pt-4'}`}>
          {pendingAttachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2">
                  <div className="relative h-[50px] w-[88px] overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
                    {attachment.kind === 'video' ? (
                      <video
                        src={attachment.objectUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.objectUrl}
                        alt={attachment.name}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    )}
                    {attachment.progress !== null ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                        <Loader2 size={22} className="animate-spin text-orange-500" />
                      </div>
                    ) : attachment.downloadUrl ? (
                      <button
                        type="button"
                        onClick={() => onClearAttachment?.(attachment.id)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
                        aria-label={`Remove ${attachment.name}`}
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                  {attachment.downloadUrl ? (
                    <span className="max-w-[140px] truncate rounded-full border border-white/[0.08] bg-[#1c1c20]/80 px-2.5 py-1 text-xs text-white/60">
                      {attachment.name}
                    </span>
                  ) : null}
                </div>
              ))}
              {showEduVideoHint ? (
                <span className="text-xs text-orange-300/80">
                  Video attached — send to start transcription
                </span>
              ) : null}
              {showRemoveBgHint ? (
                <span className="text-xs text-orange-300/80">
                  Video attached — send to remove background
                </span>
              ) : null}
              {showCompositeHint ? (
                <span className="text-xs text-orange-300/80">
                  Cutout + background ready — send to composite
                </span>
              ) : null}
              {activeSkill === 'composite-subject' &&
              readyCount < 2 &&
              !isUploading ? (
                <span className="text-xs text-white/45">
                  Attach {2 - readyCount} more file{2 - readyCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="relative">
            <TypewriterPlaceholder prompts={HERO_ROTATING_PROMPTS} active={showTypewriter} />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || sending}
              placeholder={isHero ? '' : 'Describe your edit…'}
              rows={isHero ? 1 : 2}
              className={`w-full resize-none bg-transparent text-sm leading-normal text-white/90 outline-none disabled:opacity-40 ${
                isHero ? 'min-h-[2.35rem]' : 'min-h-[3rem]'
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
                            key={m.value}
                            type="button"
                            onClick={() => {
                              setSelectedModel(m.value);
                              setModelOpen(false);
                            }}
                            className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-white/[0.05] ${
                              m.value === selectedModel
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
              <div className="relative" ref={skillsRef}>
                <button
                  type="button"
                  ref={skillsButtonRef}
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
                  anchorRef={skillsButtonRef}
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
    </div>
  );
}
