/**
 * Rate Limit Display Component
 * 
 * Shows users their current rate limit status for a specific feature
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRateLimitStatus, RATE_LIMITS, type FeatureType } from '@/services/RateLimitService';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface RateLimitDisplayProps {
    feature: FeatureType;
    className?: string;
}

export default function RateLimitDisplay({ feature, className = '' }: RateLimitDisplayProps) {
    const { userProfile } = useAuth();
    const [remaining, setRemaining] = useState<number | null>(null);
    const [resetAt, setResetAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) {
            setLoading(false);
            return;
        }

        const checkLimit = async () => {
            try {
                const status = await getRateLimitStatus(userProfile.uid, feature);
                setRemaining(status.remaining);
                setResetAt(status.resetAt);
            } catch (error) {
                console.error('Failed to check rate limit:', error);
            } finally {
                setLoading(false);
            }
        };

        checkLimit();
        // Refresh every 30 seconds
        const interval = setInterval(checkLimit, 30000);
        return () => clearInterval(interval);
    }, [userProfile?.uid, feature]);

    if (loading || !userProfile) return null;

    const limit = RATE_LIMITS[feature];
    const percentage = remaining !== null ? (remaining / limit) * 100 : 100;
    const isLow = percentage < 30;
    const isExhausted = remaining === 0;

    const formatTimeUntilReset = () => {
        if (!resetAt) return '';
        const now = new Date();
        const diff = resetAt.getTime() - now.getTime();
        const minutes = Math.ceil(diff / (1000 * 60));
        
        if (minutes < 1) return 'less than 1 minute';
        if (minutes === 1) return '1 minute';
        if (minutes < 60) return `${minutes} minutes`;
        
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        if (remainingMins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours}h ${remainingMins}m`;
    };

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Icon */}
            <div className="flex-shrink-0">
                {isExhausted ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                ) : isLow ? (
                    <Clock className="w-5 h-5 text-yellow-400" />
                ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                )}
            </div>

            {/* Status Text */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-medium ${
                        isExhausted ? 'text-red-400' : 
                        isLow ? 'text-yellow-400' : 
                        'text-green-400'
                    }`}>
                        {remaining} / {limit}
                    </span>
                    <span className="text-xs text-white/40">generations remaining</span>
                </div>
                
                {resetAt && (
                    <div className="text-xs text-white/30 mt-0.5">
                        Resets in {formatTimeUntilReset()}
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${
                        isExhausted ? 'bg-red-500' :
                        isLow ? 'bg-yellow-500' :
                        'bg-green-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
