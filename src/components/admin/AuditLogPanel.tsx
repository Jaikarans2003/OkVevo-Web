'use client';

import { useEffect, useState } from 'react';
import type { AdminAction } from '@/types/admin';
import { Clock, User, Trash2, Edit, Eye } from 'lucide-react';

interface AuditLogPanelProps {
    logs: AdminAction[];
    loading?: boolean;
}

export default function AuditLogPanel({ logs, loading }: AuditLogPanelProps) {
    const getActionIcon = (action: string) => {
        switch (action) {
            case 'delete_user':
                return <Trash2 className="w-4 h-4 text-red-400" />;
            case 'update_credits':
                return <Edit className="w-4 h-4 text-blue-400" />;
            case 'view_users':
            case 'view_audit_logs':
                return <Eye className="w-4 h-4 text-gray-400" />;
            default:
                return <User className="w-4 h-4 text-gray-400" />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'delete_user':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            case 'update_credits':
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
            case 'view_users':
            case 'view_audit_logs':
                return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
            default:
                return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'delete_user':
                return 'User Deleted';
            case 'update_credits':
                return 'Credits Updated';
            case 'view_users':
                return 'Viewed Users';
            case 'view_audit_logs':
                return 'Viewed Audit Logs';
            default:
                return action;
        }
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-[#1a1a1a] rounded-lg border border-gray-700 animate-pulse">
                        <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No audit logs yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {logs.map((log) => (
                <div
                    key={log.id}
                    className="p-4 bg-[#1a1a1a] rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg border ${getActionColor(log.action)}`}>
                                {getActionIcon(log.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-white">
                                        {getActionLabel(log.action)}
                                    </span>
                                    {log.targetUserEmail && (
                                        <span className="text-sm text-gray-400">
                                            → {log.targetUserEmail}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500">
                                    by {log.adminEmail}
                                </div>
                                {log.details && Object.keys(log.details).length > 0 && (
                                    <div className="mt-2 text-xs text-gray-400 font-mono bg-[#141413] p-2 rounded border border-gray-700 overflow-x-auto">
                                        {log.action === 'update_credits' && log.details.operation && (
                                            <div>
                                                {log.details.operation}: {log.details.amount} credits
                                                {log.details.reason && ` - ${log.details.reason}`}
                                            </div>
                                        )}
                                        {log.action === 'delete_user' && (
                                            <div>
                                                User type: {log.details.userType || 'unknown'}
                                            </div>
                                        )}
                                        {(log.action === 'view_users' || log.action === 'view_audit_logs') && log.details.userCount !== undefined && (
                                            <div>
                                                {log.details.userCount} users
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
