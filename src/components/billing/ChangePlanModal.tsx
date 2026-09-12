'use client';

import { X } from 'lucide-react';
import {
    formatPlanPrice,
    getPlanDetailsByPeriod,
    type BillingCurrency,
    type BillingPeriod,
    type SelfServePlanType,
} from '@/config/razorpay';
import {
    isSamePlan,
    planChangeCopy,
    scheduleChangeAt,
    SELF_SERVE_TIERS,
    toBillingPeriod,
    type PlanChangeTier,
} from '@/lib/billing/planChange';

type ChangePlanModalProps = {
    currentPlan: string | null;
    currentCycle: string | null;
    currency: BillingCurrency;
    paymentMethod: string | null;
    periodEndLabel: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: (plan: SelfServePlanType, period: BillingPeriod) => void;
};

export default function ChangePlanModal({
    currentPlan,
    currentCycle,
    currency,
    paymentMethod,
    periodEndLabel,
    busy,
    error,
    onClose,
    onConfirm,
}: ChangePlanModalProps) {
    const currentPeriod = toBillingPeriod(currentCycle);
    const isUpi = paymentMethod === 'upi' || paymentMethod === 'emandate';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !busy && onClose()}
        >
            <div
                role="dialog"
                aria-labelledby="change-plan-title"
                className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => !busy && onClose()}
                    disabled={busy}
                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                    aria-label="Close"
                >
                    <X className="w-5 h-5 text-white/50" />
                </button>

                <h2 id="change-plan-title" className="text-3xl font-black text-white mb-2">
                    Change Plan
                </h2>
                <p className="text-white/60 mb-6 text-sm">
                    {isUpi
                        ? 'UPI upgrades charge the full new-plan price via a new UPI payment. Existing credits stay until the new billing date. Downgrades apply at cycle end.'
                        : 'Upgrades charge the prorated difference now. Downgrades apply at cycle end. Your billing date never resets.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {SELF_SERVE_TIERS.map((tier) => (
                        <TierPick
                            key={tier}
                            tier={tier}
                            currentPlan={currentPlan}
                            currentPeriod={currentPeriod}
                            currency={currency}
                            periodEndLabel={periodEndLabel}
                            busy={busy}
                            upi={isUpi}
                            onConfirm={onConfirm}
                        />
                    ))}
                </div>

                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                {busy && <p className="text-white/50 text-sm mt-3">Updating plan…</p>}
            </div>
        </div>
    );
}

function TierPick({
    tier,
    currentPlan,
    currentPeriod,
    currency,
    periodEndLabel,
    busy,
    upi,
    onConfirm,
}: {
    tier: PlanChangeTier;
    currentPlan: string | null;
    currentPeriod: BillingPeriod;
    currency: BillingCurrency;
    periodEndLabel: string;
    busy: boolean;
    upi: boolean;
    onConfirm: (plan: SelfServePlanType, period: BillingPeriod) => void;
}) {
    const monthly = getPlanDetailsByPeriod(tier, 'monthly', currency);
    const annual = getPlanDetailsByPeriod(tier, 'annual', currency);
    const isCurrentMonthly = isSamePlan(currentPlan, currentPeriod, tier, 'monthly');
    const isCurrentAnnual = isSamePlan(currentPlan, currentPeriod, tier, 'annual');
    const upgradeMonthly = scheduleChangeAt(currentPlan, currentPeriod, tier, 'monthly');
    const upgradeAnnual = scheduleChangeAt(currentPlan, currentPeriod, tier, 'annual');

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div>
                <p className="text-lg font-black text-white">{monthly.name}</p>
                <p className="text-sm text-[#FF4D00] font-bold">
                    {formatPlanPrice(monthly.displayedMonthly, currency)}
                    <span className="text-white/40 font-medium"> / mo</span>
                </p>
                <p className="text-xs text-white/40 mt-1">
                    Yearly {formatPlanPrice(annual.displayedMonthly, currency)}/mo
                </p>
            </div>
            <PeriodButton
                disabled={busy || isCurrentMonthly}
                label={isCurrentMonthly ? 'Current' : 'Monthly'}
                hint={
                    isCurrentMonthly
                        ? null
                        : hintFor(upgradeMonthly, periodEndLabel, upi)
                }
                onClick={() => onConfirm(tier, 'monthly')}
            />
            <PeriodButton
                disabled={busy || isCurrentAnnual}
                label={isCurrentAnnual ? 'Current' : 'Yearly'}
                hint={isCurrentAnnual ? null : hintFor(upgradeAnnual, periodEndLabel, upi)}
                onClick={() => onConfirm(tier, 'annual')}
            />
        </div>
    );
}

function hintFor(when: 'now' | 'cycle_end', periodEndLabel: string, upi: boolean): string {
    const base = planChangeCopy(when, { upi });
    return when === 'cycle_end' && periodEndLabel !== '—' ? `${base} (${periodEndLabel})` : base;
}

function PeriodButton({
    disabled,
    label,
    hint,
    onClick,
}: {
    disabled: boolean;
    label: string;
    hint: string | null;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            title={hint ?? undefined}
            onClick={onClick}
            className="w-full px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
            {disabled && label === 'Current' ? (
                label
            ) : (
                <>
                    {label}
                    {hint ? <span className="block mt-1 normal-case tracking-normal font-medium text-white/50 text-[10px] leading-snug">{hint}</span> : null}
                </>
            )}
        </button>
    );
}
