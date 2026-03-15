'use client';

import { useState } from 'react';
import type { UserWithStats } from '@/types/admin';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteUserModalProps {
    user: UserWithStats;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export default function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        if (confirmText !== 'DELETE') {
            setError('Please type DELETE to confirm');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onConfirm();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to delete user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] rounded-lg border border-red-500/30 max-w-md w-full p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">Delete User</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Warning */}
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm font-medium mb-2">
                        ⚠️ This action is irreversible!
                    </p>
                    <p className="text-gray-300 text-sm">
                        Deleting this user will permanently remove:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-400">
                        <li>• User profile and authentication</li>
                        <li>• All subscriptions and payment history</li>
                        <li>• Credit transactions and balance</li>
                        <li>• All generated content (AI Influencer, Product Shoots, etc.)</li>
                        <li>• Job history and metadata</li>
                        <li>• User statistics and analytics</li>
                    </ul>
                </div>

                {/* User Info */}
                <div className="mb-6 p-4 bg-[#141413] rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">User to be deleted</div>
                    <div className="text-white font-medium">{user.email}</div>
                    <div className="text-xs text-gray-500 mt-1">{user.uid}</div>
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <div className="text-gray-500">Plan</div>
                            <div className="text-white">{user.planType || 'free'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">Credits</div>
                            <div className="text-white">{user.creditsRemaining.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* Confirmation Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Type <span className="text-red-400 font-bold">DELETE</span> to confirm
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-4 py-2 bg-[#141413] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                        autoFocus
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-[#141413] border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || confirmText !== 'DELETE'}
                    >
                        {loading ? 'Deleting...' : 'Delete User'}
                    </button>
                </div>
            </div>
        </div>
    );
}
