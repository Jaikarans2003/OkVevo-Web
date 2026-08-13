'use client';

import { useMemo, useState } from 'react';
import { cleanNarrativeText } from '@/lib/agent/cleanNarrativeText';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronLeft } from 'lucide-react';

export type CheckpointAnswerPayload = {
  type: 'approve' | 'choice' | 'revision' | 'freeform' | 'skip';
  text: string;
  choiceId?: string;
  answers?: Record<
    string,
    { type: 'approve' | 'choice' | 'revision' | 'freeform' | 'skip'; choiceId?: string; text: string }
  >;
};

export type CheckpointChoice = {
  id: string;
  label: string;
};

export type CheckpointKind = 'single_select' | 'phase_gate';

export type CheckpointQuestionData = {
  id: string;
  prompt: string;
  kind?: CheckpointKind;
  choices?: CheckpointChoice[];
  allowFreeform?: boolean;
  skipDefault?: { choiceId?: string; value?: unknown };
  freeformPlaceholder?: string;
};

export type CheckpointCardData = {
  checkpointId: string;
  /** Legacy 'question' treated as single_select. */
  kind: CheckpointKind | 'question';
  status: 'pending' | 'answered';
  title: string;
  bullets: string[];
  nextLabel: string;
  nextDescription: string;
  question?: string;
  choices?: CheckpointChoice[];
  /** Required on new payloads; omitted on legacy → treated as false. */
  allowFreeform?: boolean;
  freeformPlaceholder?: string;
  questions?: CheckpointQuestionData[];
  answer?: { type: string; text: string; choiceId?: string };
};

function scrub(text: string): string {
  return cleanNarrativeText(text, { scrubStackNames: true });
}

function asKind(raw: unknown): CheckpointKind {
  if (raw === 'phase_gate') return 'phase_gate';
  return 'single_select';
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
  const bullets = (data.bullets ?? []).map(scrub).filter(Boolean);

  return (
    <div className="rounded-xl bg-[#2F2F2F] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium text-white/90">{title}</span>
      </div>
      {bullets.length > 0 ? (
        <ul className="mb-2 space-y-1.5 text-sm text-white/70">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-white/40">{i + 1}.</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {answerText ? (
        <p className="text-sm text-white/60">{answerText}</p>
      ) : null}
    </div>
  );
}

type InternalQuestion = {
  id: string;
  prompt: string;
  kind: CheckpointKind;
  choices?: CheckpointChoice[];
  allowFreeform: boolean;
  skipDefault?: { choiceId?: string; value?: unknown };
  freeformPlaceholder?: string;
};

function normalizeQuestions(data: CheckpointCardData): InternalQuestion[] {
  if (data.questions && data.questions.length > 0) {
    return data.questions.map((q) => ({
      id: q.id,
      prompt: scrub(q.prompt),
      kind: asKind(q.kind ?? data.kind),
      choices: q.choices,
      allowFreeform: q.allowFreeform === true,
      skipDefault: q.skipDefault,
      freeformPlaceholder: q.freeformPlaceholder,
    }));
  }
  const kind = asKind(data.kind);
  return [
    {
      id: '0',
      prompt: scrub(data.question ?? data.title),
      kind,
      choices: data.choices,
      allowFreeform: data.allowFreeform === true,
      freeformPlaceholder: data.freeformPlaceholder,
    },
  ];
}

type DraftAnswer = { choiceId?: string; freeform: string; skipped?: boolean };

function initialDrafts(
  questions: InternalQuestion[]
): Record<string, DraftAnswer> {
  return Object.fromEntries(
    questions.map((q) => [q.id, { freeform: '' }])
  );
}

function draftToAnswer(
  q: InternalQuestion,
  draft: DraftAnswer
): CheckpointAnswerPayload | null {
  if (draft.skipped) {
    const skipId = q.skipDefault?.choiceId;
    const label =
      q.choices?.find((c) => c.id === skipId)?.label ?? skipId ?? 'Skipped';
    return {
      type: 'skip',
      choiceId: skipId,
      text: label,
    };
  }
  if (draft.choiceId) {
    const label =
      q.choices?.find((c) => c.id === draft.choiceId)?.label ?? draft.choiceId;
    return { type: 'choice', choiceId: draft.choiceId, text: label };
  }
  const freeform = draft.freeform.trim();
  if (freeform) return { type: 'freeform', text: freeform };
  return null;
}

function isDraftComplete(
  questions: InternalQuestion[],
  drafts: Record<string, DraftAnswer>
): boolean {
  return questions.every((q) => {
    if (q.kind === 'phase_gate') return true;
    const d = drafts[q.id] ?? { freeform: '' };
    return Boolean(d.choiceId) || Boolean(d.freeform.trim()) || Boolean(d.skipped);
  });
}

function buildBatchPayload(
  questions: InternalQuestion[],
  drafts: Record<string, DraftAnswer>
): CheckpointAnswerPayload | null {
  if (questions.length === 1 && questions[0]!.kind === 'phase_gate') {
    const draft = drafts[questions[0]!.id] ?? { freeform: '' };
    const freeform = draft.freeform.trim();
    if (freeform) return { type: 'revision', text: freeform };
    return { type: 'approve', text: 'Continue' };
  }

  if (questions.length === 1) {
    return draftToAnswer(questions[0]!, drafts[questions[0]!.id] ?? { freeform: '' });
  }

  const answers: NonNullable<CheckpointAnswerPayload['answers']> = {};
  for (const q of questions) {
    const a = draftToAnswer(q, drafts[q.id] ?? { freeform: '' });
    if (!a) return null;
    answers[q.id] = {
      type: a.type,
      text: a.text,
      ...(a.choiceId ? { choiceId: a.choiceId } : {}),
    };
  }
  const first = answers[questions[0]!.id]!;
  return {
    type: first.type,
    text: Object.values(answers)
      .map((a) => a.text)
      .join('; '),
    choiceId: first.choiceId,
    answers,
  };
}

function ChoiceList({
  choices,
  draft,
  disabled,
  onChoice,
}: {
  choices: CheckpointChoice[];
  draft: DraftAnswer;
  disabled?: boolean;
  onChoice: (id: string) => void;
}) {
  return (
    <ol className="mt-3 space-y-2">
      {choices.map((choice, i) => {
        const selected = draft.choiceId === choice.id && !draft.skipped;
        return (
          <li key={choice.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoice(choice.id)}
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
              <span className="flex-1 pt-0.5">{choice.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function FreeformBox({
  value,
  disabled,
  placeholder,
  onChange,
  onConfirmEnter,
}: {
  value: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onConfirmEnter?: () => void;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && onConfirmEnter) {
          e.preventDefault();
          onConfirmEnter();
        }
      }}
      rows={2}
      placeholder={placeholder}
      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-orange-500/40"
    />
  );
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
  const canSubmit = !disabled && isDraftComplete(questions, drafts);
  const showNav = questions.length > 1;
  const isPhaseGate = current?.kind === 'phase_gate';
  const isLast = index >= questions.length - 1;

  const setDraft = (patch: Partial<DraftAnswer>) => {
    if (!current) return;
    setDrafts((prev) => {
      const existing = prev[current.id] ?? { freeform: '' };
      return { ...prev, [current.id]: { ...existing, ...patch } };
    });
  };

  const submitAll = (nextDrafts?: Record<string, DraftAnswer>) => {
    const payload = buildBatchPayload(questions, nextDrafts ?? drafts);
    if (!payload) return;
    onSubmit(data.checkpointId, payload);
  };

  const advanceOrSubmit = (nextDrafts: Record<string, DraftAnswer>) => {
    if (isLast) {
      submitAll(nextDrafts);
      return;
    }
    setDrafts(nextDrafts);
    setIndex((i) => Math.min(questions.length - 1, i + 1));
  };

  const handleChoice = (choiceId: string) => {
    if (!current || disabled) return;
    const nextDrafts = {
      ...drafts,
      [current.id]: { choiceId, freeform: '', skipped: false },
    };
    advanceOrSubmit(nextDrafts);
  };

  const handleSkip = () => {
    if (!current || disabled) return;
    const nextDrafts = {
      ...drafts,
      [current.id]: { freeform: '', skipped: true, choiceId: undefined },
    };
    advanceOrSubmit(nextDrafts);
  };

  const handleFreeformConfirm = () => {
    if (!current || disabled) return;
    const freeform = draft.freeform.trim();
    if (!freeform) return;
    const nextDrafts = {
      ...drafts,
      [current.id]: { freeform, choiceId: undefined, skipped: false },
    };
    advanceOrSubmit(nextDrafts);
  };

  const handleSubmit = () => {
    if (isPhaseGate) {
      if (disabled) return;
      submitAll();
      return;
    }
    if (!canSubmit) return;
    submitAll();
  };

  const freeformPlaceholder =
    current?.freeformPlaceholder ??
    (isPhaseGate
      ? 'Describe your revision…'
      : 'Enter brand colors as hex… e.g. #f97316 #fb923c');

  const bullets = (data.bullets ?? []).map(scrub).filter(Boolean);

  return (
    <div className="mb-3 rounded-2xl bg-[#2F2F2F] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      {current ? (
        <p className="text-sm font-medium text-white/80">{current.prompt}</p>
      ) : null}

      {bullets.length > 0 ? (
        <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-sm text-white/70">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-white/40">{i + 1}.</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!isPhaseGate && current?.choices && current.choices.length > 0 ? (
        <ChoiceList
          choices={current.choices}
          draft={draft}
          disabled={disabled}
          onChoice={handleChoice}
        />
      ) : null}

      {current?.allowFreeform ? (
        <div className="mt-3">
          {!isPhaseGate ? (
            <p className="text-xs text-white/45">Something else</p>
          ) : null}
          <FreeformBox
            value={draft.freeform}
            disabled={disabled}
            placeholder={freeformPlaceholder}
            onChange={(value) =>
              setDraft({
                freeform: value,
                choiceId: value.trim() ? undefined : draft.choiceId,
                skipped: false,
              })
            }
            onConfirmEnter={isPhaseGate ? undefined : handleFreeformConfirm}
          />
        </div>
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
            <span className="text-xs text-white/40">
              {index + 1}/{questions.length}
            </span>
          </>
        ) : null}

        {isPhaseGate ? (
          <button
            type="button"
            disabled={disabled}
            onClick={handleSubmit}
            className="ml-auto rounded-full bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={cn(
                'rounded-full bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400',
                !canSubmit && 'cursor-not-allowed opacity-40 hover:bg-orange-500'
              )}
            >
              {isLast ? 'Submit' : 'Next'}
            </button>
            {current?.skipDefault ? (
              <button
                type="button"
                disabled={disabled}
                onClick={handleSkip}
                className="ml-auto rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/60 hover:bg-white/[0.04]"
              >
                Skip
              </button>
            ) : (
              <span className="ml-auto" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
