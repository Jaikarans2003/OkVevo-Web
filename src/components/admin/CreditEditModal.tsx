'use client';

import { useState } from 'react';
import type { UserWithStats, CreditOperation } from '@/types/admin';
import { X } from 'lucide-react';

interface CreditEditModalProps {
    user: UserWithStats;
    onClose: () => void;
    onSave: (operation: CreditOperation, amount: number, reason: string) => Promise<void>;
}

export default function CreditEditModal({ user, onClose, onSave }: CreditEditModalProps) {
    const [operation, setOperation] = useState<CreditOperation>('add');
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const amountNum = parseInt(amount, 10);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Amount must be a positive number');
            return;
        }

        if (!reason.trim()) {
            setError('Reason is required');
            return;
        }

        setLoading(true);
        try {
            await onSave(operation, amountNum, reason);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update credits');
        } finally {
            setLoading(false);
        }
    };

    const getNewBalance = () => {
        const amountNum = parseInt(amount, 10);
        if (isNaN(amountNum)) return user.creditsRemaining;

        switch (operation) {
            case 'add':
                return user.creditsRemaining + amountNum;
            case 'deduct':
                return Math.max(0, user.creditsRemaining - amountNum);
            case 'set':
                return amountNum;
            default:
                return user.creditsRemaining;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] rounded-lg border border-gray-700 max-w-md w-full p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Edit User Credits</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* User Info */}
                <div className="mb-6 p-4 bg-[#141413] rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">User</div>
                    <div className="text-white font-medium">{user.email}</div>
                    <div className="text-sm text-gray-500 mt-2">
                        Current Balance: <span className="text-white font-medium">{user.creditsRemaining.toLocaleString()}</span> credits
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Operation */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Operation
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setOperation('add')}
                                className={`px-4 py-2 rounded-lg border transition-colors ${
                                    operation === 'add'
                                        ? 'bg-green-500/20 border-green-500 text-green-400'
                                        : 'bg-[#141413] border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setOperation('deduct')}
                                className={`px-4 py-2 rounded-lg border transition-colors ${
                                    operation === 'deduct'
                                        ? 'bg-red-500/20 border-red-500 text-red-400'
                                        : 'bg-[#141413] border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Deduct
                            </button>
                            <button
                                type="button"
                                onClick={() => setOperation('set')}
                                className={`px-4 py-2 rounded-lg border transition-colors ${
                                    operation === 'set'
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                        : 'bg-[#141413] border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Set
                            </button>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Amount
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            className="w-full px-4 py-2 bg-[#141413] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            required
                            min="1"
                        />
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Reason (for audit log)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Refund for failed job, Promotional credits, etc."
                            rows={3}
                            className="w-full px-4 py-2 bg-[#141413] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                            required
                        />
                    </div>

                    {/* Preview */}
                    {amount && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="text-sm text-blue-400 mb-1">New Balance Preview</div>
                            <div className="text-2xl font-bold text-white">
                                {getNewBalance().toLocaleString()} credits
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                {operation === 'add' && `+${parseInt(amount).toLocaleString()} credits`}
                                {operation === 'deduct' && `-${parseInt(amount).toLocaleString()} credits`}
                                {operation === 'set' && `Set to ${parseInt(amount).toLocaleString()} credits`}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-[#141413] border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
