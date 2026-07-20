'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

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
  answer?: { type: string; text: string; choiceId?: string };
};

interface CheckpointCardProps {
  data: CheckpointCardData;
  disabled?: boolean;
  onAnswer: (checkpointId: string, answer: CheckpointAnswerPayload) => void;
}

export function CheckpointCard({ data, disabled, onAnswer }: CheckpointCardProps) {
  const isAnswered = data.status === 'answered' || Boolean(data.answer);
  const isQuestion = data.kind === 'question';

  if (isAnswered && data.answer) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">{data.title}</span>
        </div>
        <p className="text-sm text-white/60">
          {data.answer.text}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-4">
      <h4 className="text-sm font-semibold text-white/90">{data.title}</h4>
      {data.bullets.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-white/65">
          {data.bullets.filter(Boolean).map((bullet, i) => (
            <li key={i}>• {bullet}</li>
          ))}
        </ul>
      ) : null}

      {isQuestion && data.question ? (
        <p className="mt-3 text-sm font-medium text-white/80">{data.question}</p>
      ) : null}

      {!isQuestion ? (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-white/35">Up next</p>
          <p className="text-sm font-medium text-white/80">{data.nextLabel}</p>
          <p className="mt-0.5 text-xs text-white/50">{data.nextDescription}</p>
        </div>
      ) : null}

      {!isAnswered && !disabled ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isQuestion && data.choices?.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() =>
                onAnswer(data.checkpointId, {
                  type: 'choice',
                  choiceId: choice.id,
                  text: choice.label,
                })
              }
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
            >
              {choice.label}
            </button>
          ))}
          {!isQuestion ? (
            <button
              type="button"
              onClick={() =>
                onAnswer(data.checkpointId, { type: 'approve', text: 'Continue' })
              }
              className={cn(
                'rounded-full bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400'
              )}
            >
              Continue
            </button>
          ) : null}
        </div>
      ) : null}

      {!isAnswered && disabled ? (
        <p className="mt-3 text-xs text-white/40">Waiting for response…</p>
      ) : null}

      {!isAnswered && !disabled && (isQuestion || data.allowFreeform !== false) ? (
        <p className="mt-3 text-xs text-white/40">
          {isQuestion
            ? 'Or type your answer in the chat bar below.'
            : 'To suggest changes, type a revision in the chat bar.'}
        </p>
      ) : null}
    </div>
  );
}
