'use client';

import { useMemo, useState } from 'react';
import { cleanNarrativeText } from '@/lib/agent/cleanNarrativeText';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export type CheckpointAnswerPayload = {
  type: 'approve' | 'choice' | 'revision' | 'freeform';
  text: string;
  choiceId?: string;
};

export type CheckpointCardData = {
  checkpointId: string;
  kind: 'phase_gate' | 'question';
  status: 'pending' | 'answered';
  title: string;
  bullets: string[];
  nextLabel: string;
  nextDescription: string;
  question?: string;
  choices?: { id: string; label: string }[];
  allowFreeform?: boolean;
  presentation?: 'buttons' | 'select';
  defaultChoiceId?: string;
  answer?: { type: string; text: string; choiceId?: string };
};

function scrub(text: string): string {
  return cleanNarrativeText(text, { scrubStackNames: true });
}

/** Resolved when not the live pending id, or when the part already carries an answer. */
export function isCheckpointResolved(
  data: CheckpointCardData,
  pendingCheckpointId?: string | null
): boolean {
  if (data.status === 'answered' || Boolean(data.answer)) return true;
  if (pendingCheckpointId == null) return true;
  return data.checkpointId !== pendingCheckpointId;
}

/** Static Q+A summary — no buttons. */
export function CheckpointCard({ data }: { data: CheckpointCardData }) {
  const title = scrub(data.question?.trim() ? data.question : data.title);
  const answerText = data.answer?.text?.trim()
    ? scrub(data.answer.text)
    : undefined;

  return (
    <div className="rounded-xl bg-[#2F2F2F] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium text-white/90">{title}</span>
      </div>
      {answerText ? (
        <p className="text-sm text-white/60">{answerText}</p>
      ) : null}
    </div>
  );
}

type InternalQuestion = {
  id: string;
  prompt: string;
  choices?: { id: string; label: string }[];
  allowFreeform: boolean;
  presentation: 'buttons' | 'select';
  defaultChoiceId?: string;
};

function normalizeQuestions(data: CheckpointCardData): InternalQuestion[] {
  // Backend ships one question; wrap as list so Prev/Next can grow later.
  if (data.kind === 'question') {
    return [
      {
        id: '0',
        prompt: scrub(data.question ?? data.title),
        choices: data.choices,
        allowFreeform: data.allowFreeform !== false,
        presentation: data.presentation === 'select' ? 'select' : 'buttons',
        defaultChoiceId: data.defaultChoiceId,
      },
    ];
  }
  return [
    {
      id: '0',
      prompt: scrub(data.title),
      allowFreeform: true,
      presentation: 'buttons',
    },
  ];
}

type DraftAnswer = { choiceId?: string; freeform: string };

function initialDrafts(
  questions: InternalQuestion[]
): Record<string, DraftAnswer> {
  return Object.fromEntries(
    questions.map((q) => [
      q.id,
      {
        freeform: '',
        ...(q.defaultChoiceId && q.choices?.some((c) => c.id === q.defaultChoiceId)
          ? { choiceId: q.defaultChoiceId }
          : {}),
      },
    ])
  );
}

function buildPayload(
  data: CheckpointCardData,
  draft: DraftAnswer
): CheckpointAnswerPayload | null {
  const freeform = draft.freeform.trim();
  if (data.kind === 'phase_gate') {
    if (freeform) return { type: 'revision', text: freeform };
    return { type: 'approve', text: 'Continue' };
  }
  if (draft.choiceId) {
    const label =
      data.choices?.find((c) => c.id === draft.choiceId)?.label ?? draft.choiceId;
    return { type: 'choice', choiceId: draft.choiceId, text: label };
  }
  if (freeform) return { type: 'freeform', text: freeform };
  return null;
}

function isDraftComplete(
  data: CheckpointCardData,
  questions: InternalQuestion[],
  drafts: Record<string, DraftAnswer>
): boolean {
  if (data.kind === 'phase_gate') return true;
  return questions.every((q) => {
    const d = drafts[q.id] ?? { freeform: '' };
    return Boolean(d.choiceId) || Boolean(d.freeform.trim());
  });
}

/** Floating interactive card above the composer. */
export function CheckpointFloatingCard({
  data,
  disabled,
  onSubmit,
}: {
  data: CheckpointCardData;
  disabled?: boolean;
  onSubmit: (checkpointId: string, answer: CheckpointAnswerPayload) => void;
}) {
  const questions = useMemo(() => normalizeQuestions(data), [data]);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>(() =>
    initialDrafts(questions)
  );

  const current = questions[index] ?? questions[0];
  const draft = drafts[current?.id ?? '0'] ?? { freeform: '' };
  const canSubmit = !disabled && isDraftComplete(data, questions, drafts);
  const showNav = questions.length > 1;
  const bullets = data.bullets.map(scrub).filter(Boolean);
  const isPhaseGate = data.kind === 'phase_gate';
  const useSelect = current?.presentation === 'select' && (current.choices?.length ?? 0) > 0;

  const setDraft = (patch: Partial<DraftAnswer>) => {
    if (!current) return;
    setDrafts((prev) => {
      const existing = prev[current.id] ?? { freeform: '' };
      return { ...prev, [current.id]: { ...existing, ...patch } };
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || !current) return;
    // Today: one question → one answer payload.
    const payload = buildPayload(data, drafts[current.id] ?? { freeform: '' });
    if (!payload) return;
    onSubmit(data.checkpointId, payload);
  };

  return (
    <div className="mb-3 rounded-2xl bg-[#2F2F2F] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      <h4 className="text-sm font-semibold text-white/90">{scrub(data.title)}</h4>
      {bullets.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-white/65">
          {bullets.map((bullet, i) => (
            <li key={i}>• {bullet}</li>
          ))}
        </ul>
      ) : null}

      {!isPhaseGate && current ? (
        <p className="mt-3 text-sm font-medium text-white/80">{current.prompt}</p>
      ) : null}

      {useSelect && current?.choices ? (
        <select
          value={draft.choiceId ?? ''}
          disabled={disabled}
          onChange={(e) =>
            setDraft({ choiceId: e.target.value || undefined, freeform: '' })
          }
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-orange-500/40 disabled:opacity-50"
        >
          {current.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : current?.choices && current.choices.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {current.choices.map((choice, i) => {
            const selected = draft.choiceId === choice.id;
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setDraft({ choiceId: choice.id, freeform: draft.freeform })
                  }
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                    selected
                      ? 'bg-orange-500/15 text-white'
                      : 'bg-white/[0.03] text-white/80 hover:bg-white/[0.06]',
                    disabled && 'opacity-50'
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{choice.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      {current?.allowFreeform !== false ? (
        <>
          {isPhaseGate ? (
            <p className="mt-3 text-sm font-medium text-white/80">Click Continue Or Customise</p>
          ) : null}
          <textarea
            value={draft.freeform}
            disabled={disabled}
            onChange={(e) =>
              setDraft({
                freeform: e.target.value,
                choiceId: e.target.value.trim() ? undefined : draft.choiceId,
              })
            }
            rows={2}
            placeholder={
              isPhaseGate
                ? 'Describe your revision…'
                : 'Or reply directly…'
            }
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-orange-500/40"
          />
        </>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {showNav ? (
          <>
            <button
              type="button"
              disabled={disabled || index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/70 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              disabled={disabled || index >= questions.length - 1}
              onClick={() =>
                setIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/70 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-white/40">
              {index + 1}/{questions.length}
            </span>
          </>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            'ml-auto rounded-full bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400',
            !canSubmit && 'cursor-not-allowed opacity-40 hover:bg-orange-500'
          )}
        >
          {isPhaseGate && !(drafts[current?.id ?? '0']?.freeform.trim())
            ? 'Continue'
            : 'Submit'}
        </button>
      </div>
    </div>
  );
}
