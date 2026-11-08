'use client';

import type { CSSProperties } from 'react';
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

const TIER_INK: Record<PlanChangeTier, string> = { starter: 'var(--ochre)', pro: 'var(--orange)', max: 'var(--teal)' };

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
            className="pt-modal-back"
            onClick={() => !busy && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="change-plan-title"
                className="pt-modal pt-modal--wide"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => !busy && onClose()}
                    disabled={busy}
                    className="pt-x"
                    aria-label="Close"
                >
                    <X size={18} aria-hidden />
                </button>

                <h2 id="change-plan-title">Change plan</h2>
                <p>
                    {isUpi
                        ? 'UPI upgrades charge the full new-plan price via a new UPI payment. Existing credits stay until the new billing date. Downgrades apply at cycle end.'
                        : 'Upgrades charge the prorated difference now. Downgrades apply at cycle end. Your billing date never resets.'}
                </p>

                <div className="pt-tiers">
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

                {error && <p className="pt-err" role="alert" style={{ marginTop: 16 }}>{error}</p>}
                {busy && <p className="pt-fine" role="status" style={{ marginTop: 12 }}>Updating plan…</p>}
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
        <div className="pt-tier" style={{ '--spot': TIER_INK[tier] } as CSSProperties}>
            <div>
                <h3>{monthly.name}</h3>
                <p className="pt-price">
                    {formatPlanPrice(monthly.displayedMonthly, currency)}
                    <small> / mo</small>
                </p>
                <p className="pt-fine">
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
            className="pt-pick"
        >
            {disabled && label === 'Current' ? (
                label
            ) : (
                <>
                    {label}
                    {hint ? <span>{hint}</span> : null}
                </>
            )}
        </button>
    );
}
